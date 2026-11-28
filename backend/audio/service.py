"""
InquireX Studio Audio Briefing Service
Transforms research reports into broadcast-ready executive scripts, synthesizes
neural studio audio (Edge Neural Voices with Gemini Native TTS fallback),
and caches per-user audio artifacts with byte-range streaming support.
"""

from __future__ import annotations

import asyncio
import hashlib
import io
import logging
import os
import re
import time
import uuid
import wave
from collections import OrderedDict
from typing import Any, Dict, List, Optional, Tuple

try:
    from companion.service import SlidingWindowRateLimiter, companion_service
except ImportError:
    from backend.companion.service import SlidingWindowRateLimiter, companion_service

logger = logging.getLogger(__name__)

# Curated, runtime-verified Neural studio voices
VOICE_PRESETS: List[Dict[str, str]] = [
    {
        "id": "en-US-AndrewNeural",
        "label": "Andrew (US · Executive Anchor)",
        "locale": "en-US",
        "gender": "Male",
        "engine": "edge",
    },
    {
        "id": "en-US-AvaNeural",
        "label": "Ava (US · Clear Analyst)",
        "locale": "en-US",
        "gender": "Female",
        "engine": "edge",
    },
    {
        "id": "en-US-AriaNeural",
        "label": "Aria (US · Broadcast Host)",
        "locale": "en-US",
        "gender": "Female",
        "engine": "edge",
    },
    {
        "id": "en-US-GuyNeural",
        "label": "Guy (US · Editorial Narrator)",
        "locale": "en-US",
        "gender": "Male",
        "engine": "edge",
    },
    {
        "id": "en-GB-SoniaNeural",
        "label": "Sonia (UK · Executive Brief)",
        "locale": "en-GB",
        "gender": "Female",
        "engine": "edge",
    },
    {
        "id": "en-GB-RyanNeural",
        "label": "Ryan (UK · Crisp Analytical)",
        "locale": "en-GB",
        "gender": "Male",
        "engine": "edge",
    },
    {
        "id": "en-IN-NeerjaNeural",
        "label": "Neerja (IN · Clear Studio)",
        "locale": "en-IN",
        "gender": "Female",
        "engine": "edge",
    },
    {
        "id": "en-IN-PrabhatNeural",
        "label": "Prabhat (IN · Executive Brief)",
        "locale": "en-IN",
        "gender": "Male",
        "engine": "edge",
    },
    {
        "id": "gemini:Kore",
        "label": "Kore (Gemini Native Studio)",
        "locale": "en-US",
        "gender": "Female",
        "engine": "gemini",
    },
]

VOICE_MAP: Dict[str, Dict[str, str]] = {v["id"]: v for v in VOICE_PRESETS}
DEFAULT_VOICE_ID = "en-US-AndrewNeural"

ALLOWED_MODES = {"executive", "detailed", "full"}


def pcm_l16_to_wav(pcm_bytes: bytes, sample_rate: int = 24000, channels: int = 1, sample_width: int = 2) -> bytes:
    """Wrap raw 16-bit linear PCM bytes in a standard RIFF WAV container."""
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(channels)
        wf.setsampwidth(sample_width)
        wf.setframerate(sample_rate)
        wf.writeframes(pcm_bytes)
    return buf.getvalue()


def _strip_reference_sections(md_text: str) -> str:
    """Remove trailing bibliography/reference lists so they are never read aloud verbatim."""
    pattern = re.compile(
        r"(?im)^\s{0,3}#{1,4}\s+(?:references|sources|bibliography|works\s+cited|citations)\b[\s\S]*$"
    )
    return pattern.sub("", md_text).strip()


def _replace_markdown_tables(md_text: str) -> str:
    """Replace pipe-delimited Markdown tables with a clean verbal cue."""
    lines = md_text.splitlines()
    out: List[str] = []
    in_table = False
    for line in lines:
        stripped = line.strip()
        is_table_row = stripped.startswith("|") and stripped.endswith("|") and stripped.count("|") >= 2
        is_separator = bool(re.match(r"^\s*\|?[\s:\-]+\|[\s:\-\|]*$", stripped))
        if is_table_row or is_separator:
            if not in_table:
                out.append("A structured data comparison table is included in the written report.")
                in_table = True
            continue
        in_table = False
        out.append(line)
    return "\n".join(out)


def clean_markdown_for_briefing(raw_text: str, title: str = "", *, max_chars: int = 12000) -> str:
    """Convert raw Markdown or article text into clean, natural-speech prose."""
    text = str(raw_text or "").replace("\r\n", "\n")
    text = _strip_reference_sections(text)

    # Remove mermaid/diagram blocks and code fences gracefully
    text = re.sub(
        r"```[\w-]*\n[\s\S]*?```",
        " A technical diagram or code listing appears in the written report. ",
        text,
    )
    text = _replace_markdown_tables(text)

    # Remove inline images ![alt](url) and clean markdown links [label](url)
    text = re.sub(r"!\[[^\]]*\]\([^\)]*\)", "", text)
    text = re.sub(
        r"\[([^\]]+)\]\((https?://[^\)]+)\)",
        lambda m: "" if m.group(1).strip().isdigit() or "http" in m.group(1).lower() else m.group(1).strip(),
        text,
    )

    # Strip bare citation brackets like [1], [2, 3], [Source] and bare URLs
    text = re.sub(r"\(\s*(?:https?://\S+|[0-9,\s]+)\s*\)", "", text)
    text = re.sub(r"\[\s*\d+(?:\s*[-,]\s*\d+)*\s*\]", "", text)
    text = re.sub(r"https?://\S+", "", text)

    # Convert headings into clean spoken section pauses
    text = re.sub(r"(?m)^\s{0,3}#{1,6}\s+(.+?)\s*$", r"\n\n\1.\n", text)
    # Clean markdown formatting markers while keeping sentence flow
    text = re.sub(r"`([^`]+)`", r"\1", text)
    text = re.sub(r"[*_~]+", "", text)
    text = re.sub(r"(?m)^\s*>\s*", "", text)
    text = re.sub(r"(?m)^\s*[-*•]\s+", "", text)
    text = re.sub(r"(?m)^\s*\d+\.\s+", "", text)
    text = re.sub(r"(?m)^\s*[-]{3,}\s*$", "", text)

    # Normalize spacing & punctuation for natural cadence
    text = re.sub(r"\.\.+", ".", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()

    clean_title = re.sub(r"\s+", " ", str(title or "")).strip().rstrip(".")
    if clean_title and not text.lower().startswith(clean_title.lower()[:24]):
        text = f"InquireX Research Briefing: {clean_title}.\n\n{text}"

    if len(text) > max_chars:
        cutoff = text.rfind(".", 0, max_chars)
        text = text[: (cutoff + 1 if cutoff > max_chars // 2 else max_chars)].strip()
    return text


def _build_extractive_briefing(cleaned_text: str, title: str, *, mode: str) -> str:
    """Deterministic spoken executive script fallback when no LLM is available."""
    target_chars = 2400 if mode == "executive" else 4800
    paragraphs = [p.strip() for p in re.split(r"\n{2,}", cleaned_text) if len(p.strip()) > 35]
    clean_title = re.sub(r"\s+", " ", str(title or "this research topic")).strip().rstrip(".")

    selected: List[str] = [f"Welcome to your InquireX {'executive' if mode == 'executive' else 'detailed'} audio briefing on {clean_title}."]
    total = len(selected[0])
    for para in paragraphs:
        if para.lower().startswith("inquirex research briefing:"):
            continue
        if total + len(para) > target_chars and len(selected) >= 3:
            break
        selected.append(para)
        total += len(para)

    selected.append("This concludes your InquireX audio briefing. Consult the written report for full source citations and visual matrices.")
    return "\n\n".join(selected)


def split_speech_segments(script: str, max_chars: int = 2100) -> List[str]:
    """Split script into natural sentence-aligned segments safe for TTS synthesis."""
    text = re.sub(r"\s+", " ", str(script or "")).strip()
    if not text:
        return []
    if len(text) <= max_chars:
        return [text]

    sentences = re.findall(r"[^.!?]+[.!?]+|[^.!?]+$", text) or [text]
    segments: List[str] = []
    current = ""
    for sent in sentences:
        part = sent.strip()
        if not part:
            continue
        if len(current) + len(part) + 1 <= max_chars:
            current = f"{current} {part}".strip()
        else:
            if current:
                segments.append(current)
            if len(part) <= max_chars:
                current = part
            else:
                words = part.split()
                sub = ""
                for w in words:
                    if len(sub) + len(w) + 1 <= max_chars:
                        sub = f"{sub} {w}".strip()
                    else:
                        if sub:
                            segments.append(sub)
                        sub = w
                current = sub
    if current:
        segments.append(current)
    return segments


class AudioBriefingService:
    """Generates broadcast-style executive scripts and synthesizes neural studio audio."""

    def __init__(self, max_cache_entries: int = 24):
        self._cache: "OrderedDict[str, Dict[str, Any]]" = OrderedDict()
        self._content_index: Dict[str, str] = {}
        self._max_cache_entries = max_cache_entries
        self._lock = asyncio.Lock()
        self._rate_limiter = SlidingWindowRateLimiter(
            max_requests=int(os.getenv("AUDIO_BRIEFING_RATE_LIMIT", "12")),
            window_seconds=60,
        )

    def get_voices(self) -> Dict[str, Any]:
        edge_ready = False
        try:
            import edge_tts  # noqa: F401
            edge_ready = True
        except Exception:
            edge_ready = False

        gemini_ready = bool(os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY"))
        return {
            "default_voice": DEFAULT_VOICE_ID,
            "edge_tts_available": edge_ready,
            "gemini_tts_available": gemini_ready,
            "voices": VOICE_PRESETS,
        }

    async def _generate_spoken_script(self, title: str, raw_content: str, mode: str) -> Tuple[str, str]:
        cleaned = clean_markdown_for_briefing(raw_content, title, max_chars=14000)
        if not cleaned:
            raise ValueError("Report contains no readable content for an audio briefing.")

        if mode == "full":
            return cleaned, "cleaned_full"

        word_target = "160 to 230 words (~1 to 1.5 minutes spoken)" if mode == "executive" else "400 to 560 words (~3 minutes spoken)"
        system_prompt = (
            "You are an elite executive research broadcaster for InquireX. "
            "Transform the written research report into a polished, natural-sounding spoken audio briefing.\n"
            "STRICT RULES:\n"
            "1. Output ONLY pure spoken prose separated into clear paragraphs — NO Markdown, NO headings (#), "
            "NO bullet points (- or *), NO bold/italics, NO citation brackets like [1], NO URLs, NO tables.\n"
            "2. Open directly with a crisp professional introduction introducing the topic, followed by the core "
            "findings, key numbers/metrics expressed smoothly for listeners (e.g., 'nearly four billion dollars' or 'around 14 percent'), "
            "critical risks or trade-offs, and a decisive closing takeaway.\n"
            "3. Never fabricate facts, figures, or sources not present in the provided report.\n"
            f"4. Target length: {word_target}."
        )
        source_excerpt = cleaned[:8500]
        user_prompt = (
            f"Report Title: {title or 'Research Report'}\n\n"
            f"Report Content:\n{source_excerpt}\n\n"
            "Write the spoken executive audio briefing script now."
        )

        llm_script = await companion_service.complete_text(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            detail_level="detailed" if mode == "detailed" else "concise",
            timeout_seconds=6.5,
            total_budget_seconds=8.5,
            max_tokens_override=380 if mode == "executive" else 760,
        )
        if llm_script:
            sanitized = clean_markdown_for_briefing(llm_script, "", max_chars=12000)
            sanitized = re.sub(r"^InquireX Research Briefing:[^\n]*\n+", "", sanitized).strip()
            if len(sanitized.split()) >= 45:
                return sanitized, f"llm_{mode}"

        return _build_extractive_briefing(cleaned, title, mode=mode), f"extractive_{mode}"

    def _partition_edge_segments(self, script: str) -> List[str]:
        """Make Part 0 compact (~240 chars) for fast first-audio start, and larger subsequent chunks."""
        raw_parts = split_speech_segments(script, max_chars=240)
        if len(raw_parts) <= 1:
            return raw_parts
        merged: List[str] = [raw_parts[0]]
        tail_text = " ".join(raw_parts[1:])
        merged.extend(split_speech_segments(tail_text, max_chars=420))
        return merged

    async def _synthesize_edge_tts(self, text_or_script: str, voice_id: str) -> bytes:
        import edge_tts

        segments = split_speech_segments(text_or_script, max_chars=420)
        sem = asyncio.Semaphore(5)

        async def _synth_segment(seg: str) -> bytes:
            async with sem:
                comm = edge_tts.Communicate(seg, voice_id)
                buf = bytearray()
                async for chunk in comm.stream():
                    if chunk.get("type") == "audio":
                        buf.extend(chunk.get("data", b""))
                return bytes(buf)

        parts = await asyncio.wait_for(
            asyncio.gather(*(_synth_segment(seg) for seg in segments)),
            timeout=18.0,
        )
        audio_bytes = b"".join(parts)
        if not audio_bytes:
            raise RuntimeError("Edge TTS returned empty audio stream.")
        return audio_bytes

    async def _synthesize_edge_segment_safe(self, segment: str, voice_id: str, sem: asyncio.Semaphore) -> bytes:
        async with sem:
            last_err: Optional[Exception] = None
            for _ in range(2):
                try:
                    return await asyncio.wait_for(self._synthesize_edge_tts(segment, voice_id), timeout=14.0)
                except Exception as exc:
                    last_err = exc
            raise RuntimeError(f"Edge segment synthesis failed: {last_err}")

    async def _synthesize_gemini_tts(self, script: str, voice_name: str = "Kore") -> bytes:
        api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        if not api_key:
            raise RuntimeError("Gemini API key is not configured.")

        from google import genai
        from google.genai import types

        segments = split_speech_segments(script, max_chars=3200)[:3]
        loop = asyncio.get_running_loop()

        def _run_sync() -> bytes:
            client = genai.Client(api_key=api_key)
            pcm_all = bytearray()
            for seg in segments:
                resp = client.models.generate_content(
                    model=os.getenv("INQUIREX_GEMINI_TTS_MODEL", "gemini-2.5-flash-preview-tts"),
                    contents=f"Read aloud in a clear, authoritative broadcast briefing tone:\n\n{seg}",
                    config=types.GenerateContentConfig(
                        response_modalities=["AUDIO"],
                        speech_config=types.SpeechConfig(
                            voice_config=types.VoiceConfig(
                                prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=voice_name)
                            )
                        ),
                    ),
                )
                candidates = getattr(resp, "candidates", None) or []
                for cand in candidates:
                    content = getattr(cand, "content", None)
                    for part in getattr(content, "parts", None) or []:
                        inline = getattr(part, "inline_data", None)
                        data = getattr(inline, "data", None)
                        if data:
                            pcm_all.extend(data)
            if not pcm_all:
                raise RuntimeError("Gemini TTS returned empty audio bytes.")
            return pcm_l16_to_wav(bytes(pcm_all), sample_rate=24000)

        return await asyncio.wait_for(loop.run_in_executor(None, _run_sync), timeout=35.0)

    async def create_briefing(
        self,
        *,
        user_id: str,
        report_id: str,
        title: str,
        content: str,
        mode: str = "executive",
        voice_id: str = DEFAULT_VOICE_ID,
    ) -> Dict[str, Any]:
        norm_mode = mode if mode in ALLOWED_MODES else "executive"
        voice_meta = VOICE_MAP.get(voice_id) or VOICE_MAP[DEFAULT_VOICE_ID]
        chosen_voice = voice_meta["id"]

        fingerprint = hashlib.sha256(
            f"{user_id}|{report_id}|{title}|{norm_mode}|{chosen_voice}|{hashlib.sha256(content.encode('utf-8', 'ignore')).hexdigest()}".encode("utf-8")
        ).hexdigest()

        async with self._lock:
            existing_id = self._content_index.get(fingerprint)
            if existing_id and existing_id in self._cache:
                self._cache.move_to_end(existing_id)
                cached = self._cache[existing_id]
                return self._public_metadata(cached)

        allowed, retry_after = await self._rate_limiter.check(str(user_id))
        if not allowed:
            raise RuntimeError(f"Audio briefing rate limit reached. Please wait {retry_after}s.")

        script, script_source = await self._generate_spoken_script(title, content, norm_mode)
        word_count = len(script.split())
        estimated_seconds = max(5, int(round((word_count / 152.0) * 60)))

        audio_bytes = b""
        part_tasks: List[asyncio.Task] = []
        part_weights: List[int] = []
        mime_type = "audio/mpeg"
        engine_used = "browser_fallback"
        ext = "mp3"

        try:
            if voice_meta["engine"] == "gemini":
                gemini_voice = chosen_voice.split(":", 1)[1]
                audio_bytes = await self._synthesize_gemini_tts(script, voice_name=gemini_voice)
                mime_type = "audio/wav"
                engine_used = "gemini_tts"
                ext = "wav"
                part_weights = [max(1, word_count)]
            else:
                segments = self._partition_edge_segments(script)
                sem = asyncio.Semaphore(4)
                part_weights = [max(1, len(seg.split())) for seg in segments]
                part_tasks = [
                    asyncio.create_task(self._synthesize_edge_segment_safe(seg, chosen_voice, sem))
                    for seg in segments
                ]
                # Wait ONLY for Part 0 so playback starts fast while Parts 1..N warm in background
                first_part = await asyncio.wait_for(asyncio.shield(part_tasks[0]), timeout=14.0)
                if not first_part:
                    raise RuntimeError("First audio segment was empty.")
                if len(part_tasks) == 1:
                    audio_bytes = first_part
                mime_type = "audio/mpeg"
                engine_used = "edge_neural"
                ext = "mp3"
        except Exception as primary_err:
            for t in part_tasks:
                if not t.done():
                    t.cancel()
            part_tasks = []
            part_weights = []
            logger.warning(f"Primary TTS '{chosen_voice}' failed ({primary_err}); trying fallback.")
            try:
                if voice_meta["engine"] != "gemini" and (os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")):
                    audio_bytes = await self._synthesize_gemini_tts(script, voice_name="Kore")
                    mime_type = "audio/wav"
                    engine_used = "gemini_tts"
                    ext = "wav"
                    part_weights = [max(1, word_count)]
                elif voice_meta["engine"] == "gemini":
                    audio_bytes = await self._synthesize_edge_tts(script, DEFAULT_VOICE_ID)
                    mime_type = "audio/mpeg"
                    engine_used = "edge_neural"
                    ext = "mp3"
                    part_weights = [max(1, word_count)]
            except Exception as fallback_err:
                logger.warning(f"Fallback TTS unavailable ({fallback_err}); using browser speech fallback.")
                audio_bytes = b""
                engine_used = "browser_fallback"

        briefing_id = uuid.uuid4().hex
        slug = re.sub(r"[^a-z0-9]+", "_", (title or "inquirex_briefing").lower()).strip("_")[:48] or "inquirex_briefing"
        has_audio = bool(audio_bytes or part_tasks)
        entry = {
            "briefing_id": briefing_id,
            "fingerprint": fingerprint,
            "user_id": str(user_id),
            "report_id": str(report_id or ""),
            "title": str(title or "Research Briefing"),
            "mode": norm_mode,
            "voice": chosen_voice,
            "voice_label": voice_meta["label"],
            "script": script,
            "script_source": script_source,
            "word_count": word_count,
            "estimated_seconds": estimated_seconds,
            "engine": engine_used,
            "audio_available": has_audio,
            "audio_bytes": audio_bytes,
            "part_tasks": part_tasks,
            "part_weights": part_weights,
            "mime_type": mime_type,
            "filename": f"{slug}_briefing.{ext}",
            "created_at": time.time(),
        }

        async with self._lock:
            self._cache[briefing_id] = entry
            self._content_index[fingerprint] = briefing_id
            while len(self._cache) > self._max_cache_entries:
                old_id, old_entry = self._cache.popitem(last=False)
                for old_t in old_entry.get("part_tasks") or []:
                    if not old_t.done():
                        old_t.cancel()
                old_fp = old_entry.get("fingerprint")
                if old_fp and self._content_index.get(old_fp) == old_id:
                    self._content_index.pop(old_fp, None)

        return self._public_metadata(entry)

    async def get_briefing_entry(self, briefing_id: str, user_id: str) -> Optional[Dict[str, Any]]:
        async with self._lock:
            entry = self._cache.get(briefing_id)
            if not entry or entry.get("user_id") != str(user_id):
                return None
            self._cache.move_to_end(briefing_id)
            return entry

    async def get_part_bytes(self, briefing_id: str, part_idx: int, user_id: str) -> Optional[Tuple[bytes, str]]:
        entry = await self.get_briefing_entry(briefing_id, user_id)
        if not entry:
            return None
        tasks: List[asyncio.Task] = entry.get("part_tasks") or []
        if tasks:
            if part_idx < 0 or part_idx >= len(tasks):
                return None
            data = await asyncio.wait_for(asyncio.shield(tasks[part_idx]), timeout=22.0)
            return data, entry.get("mime_type") or "audio/mpeg"
        if part_idx == 0 and entry.get("audio_bytes"):
            return entry["audio_bytes"], entry.get("mime_type") or "audio/mpeg"
        return None

    async def get_full_audio_bytes(self, briefing_id: str, user_id: str) -> Optional[Tuple[bytes, str, str]]:
        entry = await self.get_briefing_entry(briefing_id, user_id)
        if not entry:
            return None
        if not entry.get("audio_bytes") and entry.get("part_tasks"):
            parts = await asyncio.wait_for(asyncio.gather(*entry["part_tasks"]), timeout=35.0)
            entry["audio_bytes"] = b"".join(parts)
        data = entry.get("audio_bytes") or b""
        if not data:
            return None
        return data, entry.get("mime_type") or "audio/mpeg", entry.get("filename") or "inquirex_briefing.mp3"

    @staticmethod
    def _public_metadata(entry: Dict[str, Any]) -> Dict[str, Any]:
        bid = entry["briefing_id"]
        has_audio = bool(entry.get("audio_available"))
        tasks = entry.get("part_tasks") or []
        parts_count = len(tasks) if tasks else (1 if has_audio else 0)
        part_urls = [f"/api/audio/briefing/{bid}/part/{i}" for i in range(parts_count)] if has_audio else []
        return {
            "briefing_id": bid,
            "title": entry["title"],
            "mode": entry["mode"],
            "voice": entry["voice"],
            "voice_label": entry["voice_label"],
            "engine": entry["engine"],
            "script_source": entry["script_source"],
            "word_count": entry["word_count"],
            "estimated_seconds": entry["estimated_seconds"],
            "script": entry["script"],
            "audio_available": has_audio,
            "parts_count": parts_count,
            "part_urls": part_urls,
            "part_weights": entry.get("part_weights") or ([entry["word_count"]] if has_audio else []),
            "mime_type": entry["mime_type"],
            "filename": entry["filename"],
            "audio_url": f"/api/audio/briefing/{bid}" if has_audio else None,
            "download_url": f"/api/audio/briefing/{bid}?download=1" if has_audio else None,
        }


audio_briefing_service = AudioBriefingService()
