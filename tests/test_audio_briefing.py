import asyncio
import io
import os
import sys
import unittest
import wave
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from backend.server.app import app
import audio.service as audio_service_mod
from audio.routes import _parse_byte_range
from audio.service import (
    DEFAULT_VOICE_ID,
    AudioBriefingService,
    clean_markdown_for_briefing,
    pcm_l16_to_wav,
    split_speech_segments,
)


class AudioBriefingServiceTests(unittest.TestCase):
    def test_clean_markdown_strips_tables_urls_brackets_and_references(self):
        raw = (
            "# Quantum Migration Overview\n\n"
            "NIST standardized **ML-KEM** [1] and [SLH-DSA](https://example.com/nist) in 2024 [2, 3].\n\n"
            "| Algorithm | Status |\n"
            "| --- | --- |\n"
            "| ML-KEM | Standardized |\n\n"
            "```python\nprint('secret')\n```\n\n"
            "## References\n"
            "1. https://example.com/ref1\n"
        )
        cleaned = clean_markdown_for_briefing(raw, title="Quantum Migration Overview")
        self.assertNotIn("https://example.com", cleaned)
        self.assertNotIn("[1]", cleaned)
        self.assertNotIn("[2, 3]", cleaned)
        self.assertNotIn("|", cleaned)
        self.assertNotIn("References", cleaned)
        self.assertIn("ML-KEM", cleaned)
        self.assertIn("SLH-DSA", cleaned)
        self.assertIn("comparison table", cleaned.lower())

    def test_split_speech_segments_respects_max_chars(self):
        text = ". ".join([f"Sentence number {i} contains concise verified findings" for i in range(60)]) + "."
        segments = split_speech_segments(text, max_chars=400)
        self.assertGreater(len(segments), 3)
        for seg in segments:
            self.assertLessEqual(len(seg), 400)

    def test_pcm_l16_to_wav_produces_valid_riff_wav(self):
        pcm = b"\x00\x01" * 1200
        wav_bytes = pcm_l16_to_wav(pcm, sample_rate=24000)
        self.assertTrue(wav_bytes.startswith(b"RIFF"))
        with wave.open(io.BytesIO(wav_bytes), "rb") as wf:
            self.assertEqual(wf.getframerate(), 24000)
            self.assertEqual(wf.getnchannels(), 1)
            self.assertEqual(wf.getsampwidth(), 2)

    def test_parse_byte_range(self):
        self.assertEqual(_parse_byte_range("bytes=0-99", 500), (0, 99))
        self.assertEqual(_parse_byte_range("bytes=100-", 500), (100, 499))
        self.assertEqual(_parse_byte_range("bytes=-50", 500), (450, 499))
        self.assertIsNone(_parse_byte_range("bytes=600-700", 500))
        self.assertIsNone(_parse_byte_range("invalid", 500))

    def test_create_briefing_caches_and_isolates_by_user(self):
        svc = AudioBriefingService(max_cache_entries=4)

        async def run():
            with patch(
                "audio.service.companion_service.complete_text",
                new=AsyncMock(return_value="Welcome to your InquireX executive audio briefing. " + "Verified finding one. " * 40),
            ), patch.object(
                svc,
                "_synthesize_edge_tts",
                new=AsyncMock(return_value=b"ID3_FAKE_MP3_STREAM_BYTES" * 10),
            ) as synth_mock:
                meta = await svc.create_briefing(
                    user_id="user_a",
                    report_id="rep_1",
                    title="Fusion Energy Outlook",
                    content="# Fusion\n\nProgress accelerated significantly across superconducting magnets.",
                    mode="executive",
                    voice_id=DEFAULT_VOICE_ID,
                )
                self.assertTrue(meta["audio_available"])
                self.assertEqual(meta["engine"], "edge_neural")
                self.assertTrue(meta["audio_url"].startswith("/api/audio/briefing/"))
                self.assertGreaterEqual(meta["parts_count"], 1)
                self.assertTrue(meta["part_urls"][0].startswith(meta["audio_url"] + "/part/0"))
                first_calls = synth_mock.await_count
                await asyncio.sleep(0.05)

                # Cache hit for same user does not re-synthesize
                meta2 = await svc.create_briefing(
                    user_id="user_a",
                    report_id="rep_1",
                    title="Fusion Energy Outlook",
                    content="# Fusion\n\nProgress accelerated significantly across superconducting magnets.",
                    mode="executive",
                    voice_id=DEFAULT_VOICE_ID,
                )
                self.assertEqual(meta2["briefing_id"], meta["briefing_id"])
                self.assertEqual(synth_mock.await_count, first_calls)

                # Part 0 and full bytes belong strictly to user_a
                part0 = await svc.get_part_bytes(meta["briefing_id"], 0, "user_a")
                self.assertIsNotNone(part0)
                self.assertIsNone(await svc.get_part_bytes(meta["briefing_id"], 0, "user_b"))

                # User isolation check
                own = await svc.get_briefing_entry(meta["briefing_id"], "user_a")
                other = await svc.get_briefing_entry(meta["briefing_id"], "user_b")
                self.assertIsNotNone(own)
                self.assertIsNone(other)

        asyncio.run(run())


class AudioBriefingRoutesTests(unittest.TestCase):
    def test_auth_required_and_range_stream_flow(self):
        with TestClient(app) as client:
            # Unauthenticated request returns 401
            unauth = client.get("/api/audio/voices")
            self.assertEqual(unauth.status_code, 401)

            with patch("auth.middleware.decode_access_token", return_value={"sub": "u_audio_1", "email": "u@example.com"}), \
                 patch(
                     "audio.service.companion_service.complete_text",
                     new=AsyncMock(return_value="Good afternoon. " + "Key finding verified by source data. " * 35),
                 ), \
                 patch.object(
                     audio_service_mod.audio_briefing_service,
                     "_synthesize_edge_tts",
                     new=AsyncMock(return_value=b"0123456789ABCDEF" * 20),
                 ):
                client.cookies.set("gptr_session", "fake-valid-jwt")
                voices_res = client.get("/api/audio/voices")
                self.assertEqual(voices_res.status_code, 200)
                self.assertGreaterEqual(len(voices_res.json()["voices"]), 8)

                post_res = client.post(
                    "/api/audio/briefing",
                    json={
                        "report_id": "r100",
                        "title": "Solid-State Batteries",
                        "content": "## Overview\n\nSolid-state electrolytes improve energy density and thermal stability.",
                        "mode": "executive",
                        "voice": "en-US-AndrewNeural",
                    },
                )
                self.assertEqual(post_res.status_code, 200)
                data = post_res.json()
                self.assertTrue(data["audio_available"])
                self.assertTrue(data["part_urls"])

                # Progressive Part 0 fetch returns 200 OK
                part0_res = client.get(data["part_urls"][0])
                self.assertEqual(part0_res.status_code, 200)
                self.assertEqual(part0_res.content, b"0123456789ABCDEF" * 20)

                # Byte-range request returns 206 Partial Content
                stream_res = client.get(data["audio_url"], headers={"Range": "bytes=0-15"})
                self.assertEqual(stream_res.status_code, 206)
                self.assertEqual(stream_res.content, b"0123456789ABCDEF")

                # Download disposition works
                dl_res = client.get(data["download_url"])
                self.assertEqual(dl_res.status_code, 200)
                self.assertIn("attachment; filename=", dl_res.headers.get("content-disposition", ""))

            # Another authenticated user cannot access the first user's briefing
            with patch("auth.middleware.decode_access_token", return_value={"sub": "u_audio_2", "email": "other@example.com"}):
                client.cookies.set("gptr_session", "other-jwt")
                denied_res = client.get(data["audio_url"])
                self.assertEqual(denied_res.status_code, 404)
                denied_part = client.get(data["part_urls"][0])
                self.assertEqual(denied_part.status_code, 404)


if __name__ == "__main__":
    unittest.main()
