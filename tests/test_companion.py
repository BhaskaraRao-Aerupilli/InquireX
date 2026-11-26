import asyncio
import json
import unittest
from unittest.mock import patch

from backend.companion.service import (
    CompanionService,
    SlidingWindowRateLimiter,
    extract_clean_text_and_actions,
    validate_action,
)


class CompanionServiceTests(unittest.TestCase):
    def test_validate_action_allowlists_routes_and_sanitizes_payload(self):
        nav = validate_action({"type": "navigate", "route": "knowledge-graph", "label": "View Graph"})
        self.assertEqual(nav, {"type": "navigate", "route": "knowledge-graph", "label": "View Graph"})

        bad_nav = validate_action({"type": "navigate", "route": "../../etc/passwd"})
        self.assertIsNone(bad_nav)

        bad_type = validate_action({"type": "exec_shell", "cmd": "rm -rf"})
        self.assertIsNone(bad_type)

        start = validate_action({
            "type": "start_research",
            "task": "Analyze fusion energy milestones",
            "report_type": "invalid_type",
            "tone": "Analytical",
        })
        self.assertIsNotNone(start)
        self.assertEqual(start["report_type"], "research_report")
        self.assertEqual(start["task"], "Analyze fusion energy milestones")

    def test_extract_clean_text_and_actions_strips_think_and_markers(self):
        raw = (
            "<think>internal reasoning</think>\n"
            "Multi-agent research splits tasks across specialized agents.\n\n"
            '[[IX_ACTION:{"type":"navigate","route":"team","label":"Open AI Research Team"}]]'
        )
        clean, actions = extract_clean_text_and_actions(raw)
        self.assertEqual(clean, "Multi-agent research splits tasks across specialized agents.")
        self.assertEqual(len(actions), 1)
        self.assertEqual(actions[0]["route"], "team")

    def test_rate_limiter_enforces_sliding_window(self):
        async def run():
            limiter = SlidingWindowRateLimiter(max_requests=2, window_seconds=60)
            ok1, _ = await limiter.check("u1")
            ok2, _ = await limiter.check("u1")
            ok3, wait_sec = await limiter.check("u1")
            ok_other, _ = await limiter.check("u2")
            return ok1, ok2, ok3, wait_sec, ok_other

        ok1, ok2, ok3, wait_sec, ok_other = asyncio.run(run())
        self.assertTrue(ok1)
        self.assertTrue(ok2)
        self.assertFalse(ok3)
        self.assertGreaterEqual(wait_sec, 1)
        self.assertTrue(ok_other)

    def test_stream_reply_streams_tokens_strips_action_marker_and_emits_done(self):
        class FakeChunk:
            def __init__(self, content):
                self.content = content

        class FakeLLM:
            async def astream(self, _messages):
                chunks = [
                    "<think>silent</think>",
                    "Here is a concise summary ",
                    "of your active report.\n",
                    '[[IX_ACTION:{"type":"navigate","route":"knowledge-graph","label":"Open Graph"}]]',
                ]
                for c in chunks:
                    yield FakeChunk(c)

        class FakeProvider:
            llm = FakeLLM()

        service = CompanionService()

        async def collect():
            events = []
            with patch.object(service, "_build_provider", return_value=FakeProvider()):
                async for ev in service.stream_reply(
                    user_key="user_test",
                    user_name="Tester",
                    message="Summarize this report and show the knowledge graph",
                    history=[{"role": "user", "content": "Hi"}, {"role": "assistant", "content": "Hello!"}],
                    workspace_context={"active_route": "report-viewer"},
                    mode="chat",
                    detail_level="concise",
                    max_history=6,
                ):
                    events.append(ev)
            return events

        events = asyncio.run(collect())
        types = [e["type"] for e in events]
        self.assertIn("start", types)
        self.assertIn("token", types)
        self.assertIn("action", types)
        self.assertIn("done", types)

        streamed_text = "".join(e["delta"] for e in events if e["type"] == "token")
        self.assertNotIn("IX_ACTION", streamed_text)
        self.assertNotIn("silent", streamed_text)
        self.assertIn("concise summary of your active report.", streamed_text)

        done_ev = next(e for e in events if e["type"] == "done")
        self.assertEqual(done_ev["actions"][0]["route"], "knowledge-graph")

    def test_capabilities_never_exposes_api_keys(self):
        service = CompanionService()
        caps = service.get_capabilities()
        serialized = json.dumps(caps).lower()
        self.assertIn("provider", caps)
        self.assertIn("model", caps)
        self.assertNotIn("sk-", serialized)
        self.assertNotIn("api_key", serialized)

    def test_build_provider_tolerates_verbose_kwarg_and_caps_groq_tokens(self):
        service = CompanionService()
        with patch.object(
            service,
            "_resolve_llm_config",
            return_value=("groq", "qwen/qwen3.8-27b", {"verbose": True}),
        ), patch("backend.companion.service.GenericLLMProvider.from_provider", return_value=object()) as mock_fp:
            service._build_provider("detailed")
            _, kw = mock_fp.call_args
            self.assertNotIn("verbose", kw)
            self.assertLessEqual(kw["max_tokens"], 900)

    def test_quick_web_search_skips_workspace_queries(self):
        service = CompanionService()

        async def run():
            with patch.dict("os.environ", {"TAVILY_API_KEY": "fake_key"}):
                return await service._maybe_quick_web_search(
                    "List my recent saved reports and what topic I am currently researching."
                )

        res = asyncio.run(run())
        self.assertEqual(res, [])

    def test_stream_reply_falls_back_on_rate_limit(self):
        class FakeChunk:
            def __init__(self, content):
                self.content = content

        class FailingPrimaryLLM:
            async def astream(self, _messages):
                raise RuntimeError("Error code: 429 - rate_limit_exceeded")
                yield  # pragma: no cover

        class FallbackLLM:
            async def astream(self, _messages):
                yield FakeChunk("Fallback response succeeded.")

        service = CompanionService()
        primary = type("P", (), {"llm": FailingPrimaryLLM()})()
        fallback = type("F", (), {"llm": FallbackLLM()})()

        async def collect():
            events = []
            with patch.object(service, "_resolve_llm_config", return_value=("groq", "qwen/qwen3.8-27b", {})), \
                 patch.object(service, "_build_provider", return_value=primary), \
                 patch.object(service, "_build_fallback_provider", return_value=fallback):
                async for ev in service.stream_reply(
                    user_key="u_fb",
                    user_name="Tester",
                    message="Hello",
                    history=[],
                    workspace_context={},
                ):
                    events.append(ev)
            return events

        events = asyncio.run(collect())
        done_ev = next(e for e in events if e["type"] == "done")
        self.assertEqual(done_ev["content"], "Fallback response succeeded.")


class CompanionRouteAuthTests(unittest.TestCase):
    def test_companion_endpoints_require_authentication(self):
        from fastapi.testclient import TestClient
        from backend.server.app import app

        client = TestClient(app)
        res_caps = client.get("/api/companion/capabilities")
        self.assertEqual(res_caps.status_code, 401)

        res_stream = client.post("/api/companion/stream", json={"message": "hello"})
        self.assertEqual(res_stream.status_code, 401)

        res_transcribe = client.post(
            "/api/companion/transcribe",
            files={"file": ("clip.webm", b"0" * 512, "audio/webm")},
        )
        self.assertEqual(res_transcribe.status_code, 401)

    def test_transcribe_rejects_oversized_audio(self):
        service = CompanionService()

        async def run():
            await service.transcribe_audio(user_key="u1", audio_bytes=b"a" * (15 * 1024 * 1024 + 10))

        with self.assertRaises(ValueError):
            asyncio.run(run())


if __name__ == "__main__":
    unittest.main()
