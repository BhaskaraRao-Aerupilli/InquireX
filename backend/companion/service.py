"""
InquireX AI Companion Service
Provides streaming, workspace-grounded conversational intelligence using
InquireX's configured GenericLLMProvider, safe UI action extraction,
optional live search grounding, bounded context memory, and per-user rate limiting.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import time
import uuid
from collections import defaultdict, deque
from datetime import datetime, timezone
from typing import Any, AsyncGenerator, Dict, List, Optional, Tuple

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

from inquirex.config.config import Config
from inquirex.llm_provider.generic.base import (
    NO_SUPPORT_TEMPERATURE_MODELS,
    GenericLLMProvider,
    _extract_text,
)

logger = logging.getLogger(__name__)

ALLOWED_ROUTES = {
    "home",
    "dashboard",
    "new-research",
    "my-research",
    "history",
    "live-research",
    "report-viewer",
    "team",
    "knowledge-graph",
    "fact-verification",
    "documents",
    "presentations",
    "monitor",
    "settings",
    "companion",
}

ALLOWED_ACTION_TYPES = {
    "navigate",
    "start_research",
    "open_report",
    "open_slides",
    "export_report",
}

ALLOWED_REPORT_TYPES = {
    "research_report",
    "detailed_report",
    "deep",
    "resource_report",
    "outline_report",
}

ALLOWED_EXPORT_FORMATS = {"pdf", "docx", "md", "json", "latex"}

ACTION_TAG_PREFIX = "[[IX_ACTION:"
ACTION_PATTERN = re.compile(r"\[\[IX_ACTION:\s*(\{.*?\})\s*\]\]", re.DOTALL)


class SlidingWindowRateLimiter:
    """Thread/async-safe per-user sliding window rate limiter."""

    def __init__(self, max_requests: int = 24, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._buckets: Dict[str, deque[float]] = defaultdict(deque)
        self._lock = asyncio.Lock()

    async def check(self, key: str) -> Tuple[bool, int]:
        now = time.monotonic()
        async with self._lock:
            bucket = self._buckets[key]
            cutoff = now - self.window_seconds
            while bucket and bucket[0] < cutoff:
                bucket.popleft()
            if len(bucket) >= self.max_requests:
                retry_after = max(1, int(self.window_seconds - (now - bucket[0])) + 1)
                return False, retry_after
            bucket.append(now)
            return True, 0


def validate_action(raw_action: Any) -> Optional[Dict[str, Any]]:
    """Sanitize and allow-list structured workspace action intents from model output."""
    if not isinstance(raw_action, dict):
        return None
    action_type = str(raw_action.get("type", "")).strip()
    if action_type not in ALLOWED_ACTION_TYPES:
        return None

    label = str(raw_action.get("label", "")).strip()[:80]
    cleaned: Dict[str, Any] = {"type": action_type}

    if action_type == "navigate":
        route = str(raw_action.get("route", "")).strip()
        if route not in ALLOWED_ROUTES:
            return None
        cleaned["route"] = route
        cleaned["label"] = label or f"Open {route.replace('-', ' ').title()}"
        return cleaned

    if action_type == "start_research":
        task = str(raw_action.get("task", "")).strip()[:500]
        if not task:
            return None
        report_type = str(raw_action.get("report_type", "research_report")).strip()
        if report_type not in ALLOWED_REPORT_TYPES:
            report_type = "research_report"
        tone = str(raw_action.get("tone", "Objective")).strip()[:40] or "Objective"
        cleaned["task"] = task
        cleaned["report_type"] = report_type
        cleaned["tone"] = tone
        cleaned["label"] = label or "Configure & Launch Research"
        return cleaned

    if action_type in {"open_report", "open_slides"}:
        report_id = str(raw_action.get("report_id", "")).strip()[:120]
        cleaned["report_id"] = report_id
        cleaned["label"] = label or (
            "Open Presentation Slides" if action_type == "open_slides" else "Open Report Viewer"
        )
        return cleaned

    if action_type == "export_report":
        fmt = str(raw_action.get("format", "md")).strip().lower()
        if fmt not in ALLOWED_EXPORT_FORMATS:
            fmt = "md"
        cleaned["format"] = fmt
        cleaned["label"] = label or f"Export {fmt.upper()}"
        return cleaned

    return None


def extract_clean_text_and_actions(full_text: str) -> Tuple[str, List[Dict[str, Any]]]:
    """Strip internal action markers and return readable prose plus validated actions."""
    actions: List[Dict[str, Any]] = []
    seen_keys = set()

    for match in ACTION_PATTERN.finditer(full_text or ""):
        try:
            parsed = json.loads(match.group(1))
            valid = validate_action(parsed)
            if valid:
                dedup_key = json.dumps(valid, sort_keys=True)
                if dedup_key not in seen_keys:
                    seen_keys.add(dedup_key)
                    actions.append(valid)
        except Exception:
            continue

    clean = ACTION_PATTERN.sub("", full_text or "")
    clean = re.sub(r"<think>.*?</think>", "", clean, flags=re.DOTALL)
    return clean.strip(), actions


def _safe_excerpt(text: str, max_chars: int = 3600) -> str:
    clean = re.sub(r"\s+", " ", str(text or "")).strip()
    if len(clean) <= max_chars:
        return clean
    return clean[: max_chars - 3] + "..."


def _is_free_only_enabled() -> bool:
    return os.getenv("COMPANION_FREE_ONLY", "true").strip().lower() not in {"0", "false", "no", "off"}


def _sanitize_free_openrouter_model(model: Optional[str]) -> str:
    """Enforce zero-cost OpenRouter models when COMPANION_FREE_ONLY is enabled."""
    chosen = (model or "openrouter/free").strip() or "openrouter/free"
    if not _is_free_only_enabled():
        return chosen
    if chosen == "openrouter/free" or chosen.endswith(":free"):
        return chosen
    logger.warning(f"Overriding non-free OpenRouter model '{chosen}' to 'openrouter/free' (COMPANION_FREE_ONLY=true).")
    return "openrouter/free"


_ZERO_TOKEN_ROUTE_ALIASES: Tuple[Tuple[Tuple[str, ...], str, str], ...] = (
    (("home", "home page", "landing page"), "home", "Home"),
    (("dashboard", "overview"), "dashboard", "Dashboard"),
    (("new research", "start research", "research page", "research workspace"), "new-research", "New Research"),
    (("my research", "saved reports", "saved research"), "my-research", "My Research"),
    (("history", "research history"), "history", "Research History"),
    (("live research", "live view", "live progress"), "live-research", "Live Research"),
    (("report viewer", "viewer", "latest report", "last report"), "report-viewer", "Report Viewer"),
    (("team", "research team", "ai team", "agents"), "team", "AI Research Team"),
    (("knowledge graph", "graph", "mind map"), "knowledge-graph", "Knowledge Graph"),
    (("fact verification", "fact check", "verification"), "fact-verification", "Fact Verification"),
    (("documents", "document intelligence", "files", "uploaded files"), "documents", "Document Intelligence"),
    (("presentations", "slides", "slide deck"), "presentations", "Presentations"),
    (("monitor", "research monitor", "status"), "monitor", "Research Monitor"),
    (("settings", "preferences", "theme settings"), "settings", "Settings"),
)

_QUESTION_BLOCK_WORDS = (
    "?",
    "what ",
    "why ",
    "how ",
    "when ",
    "where ",
    "who ",
    "summarize",
    "summary",
    "explain",
    "compare",
    "analyze",
    "brief",
    "about ",
    "and ",
)


def _match_zero_token_command(message: str) -> Optional[Tuple[str, Dict[str, Any]]]:
    """Handle direct short navigation requests deterministically using 0 API tokens."""
    text = (message or "").strip()
    if not text or len(text) > 55:
        return None
    lower = re.sub(r"[.!]+$", "", text.lower()).strip()
    if any(tok in lower for tok in _QUESTION_BLOCK_WORDS):
        return None
    m = re.match(r"^(?:hey\s+jarvis[,]?\s+)?(?:please\s+)?(?:open|go\s+to|show|switch\s+to|navigate\s+to)\s+(?:the\s+|my\s+)?(.+)$", lower)
    if not m:
        return None
    target = m.group(1).strip()
    for aliases, route, label in _ZERO_TOKEN_ROUTE_ALIASES:
        if target in aliases:
            return (
                f"Opening {label} now. Tap the button below if it does not navigate automatically.",
                {"type": "navigate", "route": route, "label": f"Open {label}"},
            )
    return None


def _needs_report_context(
    message: str,
    history: List[Dict[str, str]],
    mode: str,
    active_route: str,
) -> bool:
    """Only attach heavy report excerpts when the conversation references workspace research/reports."""
    if mode in {"brief", "narrate"} or active_route in {"report-viewer", "live-research"}:
        return True
    recent_user = " ".join(
        str(m.get("content", "")) for m in (history or [])[-2:] if str(m.get("role", "")).lower() == "user"
    )
    combined = f"{message or ''} {recent_user}".lower()
    keywords = (
        "report",
        "research",
        "summary",
        "summarize",
        "brief",
        "source",
        "citation",
        "finding",
        "topic",
        "file",
        "document",
        "doc",
        "slide",
        "compare",
        "what am i",
        "recent",
        "saved",
        "active",
        "graph",
        "fact",
    )
    return any(k in combined for k in keywords)


class CompanionService:
    """Core AI Companion conversational & workspace-grounded LLM engine."""

    def __init__(self):
        self.timeout_seconds = float(os.getenv("COMPANION_TIMEOUT_SECONDS", "45"))
        self.default_history_limit = int(os.getenv("COMPANION_MAX_HISTORY", "10"))
        self.rate_limiter = SlidingWindowRateLimiter(
            max_requests=int(os.getenv("COMPANION_RATE_LIMIT", "24")),
            window_seconds=60,
        )

    def _resolve_llm_config(self) -> Tuple[Optional[str], Optional[str], Dict[str, Any]]:
        cfg = Config("default")
        tier = os.getenv("COMPANION_LLM_TIER", "smart").strip().lower()
        if tier == "fast" and getattr(cfg, "fast_llm_provider", None) and getattr(cfg, "fast_llm_model", None):
            provider = cfg.fast_llm_provider
            model = cfg.fast_llm_model
        else:
            provider = getattr(cfg, "smart_llm_provider", None) or getattr(cfg, "fast_llm_provider", None)
            model = getattr(cfg, "smart_llm_model", None) or getattr(cfg, "fast_llm_model", None)
        return provider, model, dict(getattr(cfg, "llm_kwargs", None) or {})

    def _build_free_fallbacks_list(self, primary_provider: Optional[str]) -> List[str]:
        names: List[str] = []
        if primary_provider != "google_genai" and (os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")):
            names.append("google_genai")
        if primary_provider != "openrouter" and os.getenv("OPENROUTER_API_KEY"):
            names.append("openrouter")
        if primary_provider != "mistralai" and os.getenv("MISTRAL_API_KEY"):
            names.append("mistralai")
        return names

    def get_capabilities(self) -> Dict[str, Any]:
        try:
            provider, model, _ = self._resolve_llm_config()
            available = bool(provider and model)
        except Exception:
            provider, model, available = None, None, False
        stt_backend_available = bool(os.getenv("GROQ_API_KEY") or os.getenv("OPENAI_API_KEY"))
        return {
            "available": available,
            "provider": provider or "unconfigured",
            "model": model or "unconfigured",
            "fallback_providers": self._build_free_fallbacks_list(provider),
            "free_only_guard": _is_free_only_enabled(),
            "web_search_enabled": bool(os.getenv("TAVILY_API_KEY")),
            "stt_backend_available": stt_backend_available,
            "default_history_limit": self.default_history_limit,
        }

    async def transcribe_audio(
        self,
        *,
        user_key: str,
        audio_bytes: bytes,
        filename: str = "recording.webm",
        content_type: str = "audio/webm",
    ) -> str:
        """Transcribe uploaded microphone audio via Groq or OpenAI Whisper without exposing keys."""
        allowed, retry_after = await self.rate_limiter.check(user_key)
        if not allowed:
            raise RuntimeError(f"Rate limit reached. Wait {retry_after}s before retrying voice input.")

        if not audio_bytes or len(audio_bytes) < 256:
            return ""
        if len(audio_bytes) > 15 * 1024 * 1024:
            raise ValueError("Audio recording exceeds 15 MB limit.")

        import httpx

        groq_key = os.getenv("GROQ_API_KEY")
        openai_key = os.getenv("OPENAI_API_KEY")

        if groq_key:
            endpoint = "https://api.groq.com/openai/v1/audio/transcriptions"
            api_key = groq_key
            whisper_model = os.getenv("COMPANION_WHISPER_MODEL", "whisper-large-v3-turbo")
        elif openai_key:
            base = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
            endpoint = f"{base}/audio/transcriptions"
            api_key = openai_key
            whisper_model = os.getenv("COMPANION_WHISPER_MODEL", "whisper-1")
        else:
            raise RuntimeError("No server speech transcription provider configured (GROQ_API_KEY / OPENAI_API_KEY).")

        files = {"file": (filename or "recording.webm", audio_bytes, content_type or "audio/webm")}
        data = {"model": whisper_model, "response_format": "json"}
        headers = {"Authorization": f"Bearer {api_key}"}

        async with httpx.AsyncClient(timeout=25.0) as client:
            res = await client.post(endpoint, headers=headers, files=files, data=data)
        if res.status_code >= 400:
            logger.warning(f"Whisper transcription HTTP {res.status_code}: {res.text[:200]}")
            raise RuntimeError(f"Voice transcription service returned error ({res.status_code}).")
        payload = res.json()
        return str(payload.get("text", "")).strip()

    def _build_provider(self, detail_level: str) -> GenericLLMProvider:
        provider_name, model, cfg_kwargs = self._resolve_llm_config()
        if not provider_name or not model:
            raise RuntimeError("No LLM provider or model configured in InquireX.")

        if provider_name == "openrouter":
            model = _sanitize_free_openrouter_model(model)

        kwargs: Dict[str, Any] = {"model": model, **cfg_kwargs}
        kwargs.pop("verbose", None)
        if model not in NO_SUPPORT_TEMPERATURE_MODELS:
            kwargs["temperature"] = 0.45
        else:
            kwargs["temperature"] = None

        # Respect stricter provider output-token limits (e.g. Groq qwen OTPM=1000 limit)
        if provider_name == "groq":
            kwargs["max_tokens"] = 900 if detail_level == "detailed" else 600
            kwargs.setdefault("max_retries", 1)
        elif provider_name in {"openrouter", "mistralai"}:
            kwargs["max_tokens"] = 1200 if detail_level == "detailed" else 650
            kwargs.setdefault("max_retries", 1)
        else:
            kwargs["max_tokens"] = 1800 if detail_level == "detailed" else 900

        if provider_name == "openai" and os.environ.get("OPENAI_BASE_URL"):
            kwargs["openai_api_base"] = os.environ["OPENAI_BASE_URL"]

        return GenericLLMProvider.from_provider(provider_name, **kwargs)

    def _build_named_free_provider(self, provider_name: str, detail_level: str) -> Optional[GenericLLMProvider]:
        try:
            if provider_name == "google_genai" and (os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")):
                model = os.getenv("COMPANION_FALLBACK_GEMINI_MODEL", "gemini-2.5-flash")
                return GenericLLMProvider.from_provider(
                    "google_genai",
                    model=model,
                    temperature=0.45,
                    max_tokens=1600 if detail_level == "detailed" else 800,
                )
            if provider_name == "openrouter" and os.getenv("OPENROUTER_API_KEY"):
                model = _sanitize_free_openrouter_model(os.getenv("COMPANION_FREE_OPENROUTER_MODEL", "openrouter/free"))
                return GenericLLMProvider.from_provider(
                    "openrouter",
                    model=model,
                    temperature=0.45,
                    max_tokens=1200 if detail_level == "detailed" else 650,
                    max_retries=1,
                )
            if provider_name == "mistralai" and os.getenv("MISTRAL_API_KEY"):
                model = os.getenv("COMPANION_FREE_MISTRAL_MODEL", "mistral-small-latest")
                return GenericLLMProvider.from_provider(
                    "mistralai",
                    model=model,
                    temperature=0.45,
                    max_tokens=1200 if detail_level == "detailed" else 650,
                    max_retries=1,
                )
        except Exception as exc:
            logger.warning(f"Free fallback provider '{provider_name}' init skipped: {exc}")
        return None

    def _build_fallback_provider(self, primary_provider: str | None, detail_level: str) -> Optional[GenericLLMProvider]:
        if primary_provider != "google_genai":
            return self._build_named_free_provider("google_genai", detail_level)
        return None

    def _build_fallback_chain(
        self, primary_provider: Optional[str], detail_level: str
    ) -> List[Tuple[str, GenericLLMProvider]]:
        chain: List[Tuple[str, GenericLLMProvider]] = []
        first = self._build_fallback_provider(primary_provider, detail_level)
        if first is not None:
            chain.append(("google_genai" if primary_provider != "google_genai" else "fallback", first))
        for name in ("openrouter", "mistralai"):
            if primary_provider == name:
                continue
            prov = self._build_named_free_provider(name, detail_level)
            if prov is not None:
                chain.append((name, prov))
        return chain

    async def _maybe_quick_web_search(self, query: str) -> List[Dict[str, str]]:
        api_key = os.getenv("TAVILY_API_KEY")
        if not api_key:
            return []

        lower = (query or "").lower()
        explicit_online = bool(
            re.search(r"\b(search online|web search|search the web|look up online|verify online)\b", lower)
        )
        workspace_phrases = (
            "this report",
            "my report",
            "active report",
            "saved report",
            "recent report",
            "uploaded file",
            "uploaded doc",
            "live progress",
            "currently researching",
            "in inquirex",
        )
        if any(w in lower for w in workspace_phrases) and not explicit_online:
            return []

        web_pattern = re.compile(
            r"\b(search online|web search|search the web|look up|verify online|latest news|today'?s|current price|weather|stock price|2025|2026)\b"
        )
        if not web_pattern.search(lower):
            return []

        def _search_sync() -> List[Dict[str, str]]:
            from tavily import TavilyClient

            client = TavilyClient(api_key=api_key)
            res = client.search(query=query[:250], max_results=4)
            out = []
            for item in res.get("results", []):
                url = str(item.get("url", "")).strip()
                if not url:
                    continue
                out.append(
                    {
                        "title": str(item.get("title", "") or url)[:140],
                        "url": url,
                        "snippet": str(item.get("content", "") or "")[:280],
                    }
                )
            return out

        try:
            return await asyncio.wait_for(asyncio.to_thread(_search_sync), timeout=6.0)
        except Exception as exc:
            logger.warning(f"Companion quick web search skipped: {exc}")
            return []

    def _build_system_prompt(
        self,
        *,
        user_name: str,
        mode: str,
        detail_level: str,
        context: Dict[str, Any],
        web_sources: List[Dict[str, str]],
        include_report_excerpts: bool = True,
    ) -> str:
        active_route = str(context.get("active_route", "home"))
        active_report = context.get("active_report") or {}
        recent_reports = context.get("recent_reports") or []
        files = context.get("files") or []
        live_session = context.get("live_session") or {}

        report_block = "No active report is currently selected."
        if isinstance(active_report, dict) and (active_report.get("title") or active_report.get("excerpt")):
            title = str(active_report.get("title", "Untitled"))[:180]
            rep_id = str(active_report.get("id", ""))[:80]
            if include_report_excerpts:
                excerpt = _safe_excerpt(active_report.get("excerpt", ""), 4200)
                sources = active_report.get("sources") or []
                src_lines = "\n".join(
                    f"- {str(s.get('title', s.get('url', '')))} ({str(s.get('url', ''))})"
                    for s in (sources[:12] if isinstance(sources, list) else [])
                    if isinstance(s, dict)
                )
                report_block = (
                    f"Active Report ID: {rep_id}\nTitle: {title}\n"
                    f"Content Excerpt:\n{excerpt}\n"
                    + (f"Cited Sources:\n{src_lines}" if src_lines else "")
                )
            else:
                report_block = f"Active Report ID: {rep_id} | Title: {title} (excerpt omitted for brevity; ask user if details needed)"

        recent_block = "None saved."
        if isinstance(recent_reports, list) and recent_reports:
            lines = []
            for r in recent_reports[:6]:
                if not isinstance(r, dict):
                    continue
                rid = str(r.get("id", ""))[:40]
                rtitle = str(r.get("title", "Untitled"))[:120]
                rtype = str(r.get("report_type", "research_report"))
                line = f"- [id={rid}] {rtitle} ({rtype})"
                if include_report_excerpts:
                    rexcerpt = _safe_excerpt(r.get("excerpt", ""), 420)
                    if rexcerpt:
                        line += f"\n  Summary Excerpt: {rexcerpt}"
                lines.append(line)
            if lines:
                recent_block = "\n".join(lines)

        files_block = ", ".join(str(f)[:80] for f in files[:20]) if isinstance(files, list) and files else "None uploaded."

        live_block = "Idle (no active research job)."
        if isinstance(live_session, dict) and live_session.get("status") not in (None, "idle"):
            live_sources = live_session.get("scraped_sources") or []
            recent_logs = live_session.get("recent_logs") or []
            live_block = (
                f"Status: {live_session.get('status')} | Task: {str(live_session.get('task', ''))[:160]}\n"
                f"Stage: {live_session.get('stage')}/5 ({live_session.get('stage_label', '')})\n"
                f"Sub-queries queued: {live_session.get('subqueries_count', 0)} | "
                f"Scraped sources: {live_session.get('sources_count', 0)}\n"
                + (
                    "Latest scraped URLs: " + ", ".join(str(u) for u in live_sources[:8]) + "\n"
                    if live_sources
                    else ""
                )
                + (
                    "Recent execution logs:\n" + "\n".join(f"  - {str(l)[:180]}" for l in recent_logs[-6:])
                    if recent_logs
                    else ""
                )
            )

        search_block = ""
        if web_sources:
            search_block = "\nLIVE WEB SEARCH RESULTS (verified via Tavily for this turn):\n" + "\n".join(
                f"- {s['title']} | {s['url']} :: {s['snippet']}" for s in web_sources
            )

        style_guidance = (
            "Respond with natural, spoken-friendly clarity in 2–4 concise sentences unless the user asks for depth."
            if detail_level != "detailed"
            else "Provide a clear, thorough explanation structured with short paragraphs or bullet points."
        )
        if mode == "brief":
            style_guidance = (
                "Deliver an executive spoken briefing (~30 seconds, crisp 3–5 sentences) covering core thesis, "
                "key findings, and primary caveats of the active report."
            )
        elif mode == "narrate":
            style_guidance = (
                "Summarize live multi-agent research progress in plain language: current stage, what has been discovered so far, and sources gathered."
            )

        return f"""You are the InquireX AI Companion, an intelligent voice-enabled research copilot inside InquireX — Autonomous Deep Research Platform.

Signed-in User: {user_name or 'Researcher'}
Current Timestamp (UTC): {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}
Current UI Route: {active_route}

RESPONSE STYLE:
- {style_guidance}
- Since responses are read aloud and displayed below your orb, write clean readable prose (avoid messy ASCII art or overly nested tables unless requested).
- Ground every claim about user reports, documents, citations, or live runs strictly in the authorized workspace context below. NEVER fabricate documents, metrics, sources, or report contents that are absent. If a report or document is missing, state that honestly and suggest running New Research or uploading documents.

AUTHORIZED INQUIREX WORKSPACE CONTEXT:
1) Active Report:
{report_block}

2) Recent Saved Reports:
{recent_block}

3) Uploaded Local Documents: {files_block}

4) Live Execution Session:
{live_block}
{search_block}

INQUIREX WORKSPACE ACTIONS:
When—and ONLY when—the user wants to open a page, view slides, export, or start/configure a new research task, append ONE action marker at the very end of your response (never mention the marker syntax in your text, and NEVER claim an action or research run has already started on its own — tell the user to click the action button provided below):
- Navigate: [[IX_ACTION:{{"type":"navigate","route":"knowledge-graph","label":"Open Knowledge Graph"}}]]
  Allowed routes: home, dashboard, new-research, my-research, history, live-research, report-viewer, team, knowledge-graph, fact-verification, documents, presentations, monitor, settings
- Open a report: [[IX_ACTION:{{"type":"open_report","report_id":"<id>","label":"Open Report"}}]]
- Open slides: [[IX_ACTION:{{"type":"open_slides","report_id":"<id>","label":"Open Slides"}}]]
- Export active report: [[IX_ACTION:{{"type":"export_report","format":"md","label":"Export Markdown"}}]]
- Prepare research: [[IX_ACTION:{{"type":"start_research","task":"<concise research question>","report_type":"detailed_report","tone":"Analytical","label":"Configure Research in Workspace"}}]]
"""

    def _build_lc_messages(
        self,
        system_prompt: str,
        history: List[Dict[str, str]],
        user_message: str,
        max_history: int,
    ) -> List[Any]:
        bounded_limit = max(2, min(20, max_history or self.default_history_limit))
        trimmed_history = history[-bounded_limit:]
        lc_messages: List[Any] = [SystemMessage(content=system_prompt)]

        for item in trimmed_history:
            role = str(item.get("role", "")).lower()
            content = str(item.get("content", "")).strip()
            if not content:
                continue
            clipped = content[:3000]
            if role == "assistant":
                lc_messages.append(AIMessage(content=clipped))
            elif role == "user":
                lc_messages.append(HumanMessage(content=clipped))

        lc_messages.append(HumanMessage(content=user_message))
        return lc_messages

    async def stream_reply(
        self,
        *,
        user_key: str,
        user_name: str,
        message: str,
        history: List[Dict[str, str]],
        workspace_context: Dict[str, Any],
        mode: str = "chat",
        detail_level: str = "concise",
        max_history: Optional[int] = None,
    ) -> AsyncGenerator[Dict[str, Any], None]:
        request_id = f"cmp_{uuid.uuid4().hex[:10]}"
        yield {"type": "start", "request_id": request_id}

        allowed, retry_after = await self.rate_limiter.check(user_key)
        if not allowed:
            yield {
                "type": "error",
                "detail": f"Rate limit reached. Please wait {retry_after}s before sending another message.",
            }
            return

        zero_token_hit = _match_zero_token_command(message) if mode == "chat" else None
        if zero_token_hit is not None:
            reply_text, action_obj = zero_token_hit
            yield {"type": "token", "delta": reply_text}
            yield {"type": "action", "action": action_obj}
            yield {
                "type": "done",
                "request_id": request_id,
                "content": reply_text,
                "actions": [action_obj],
                "sources": [],
            }
            return

        web_sources = await self._maybe_quick_web_search(message)
        if web_sources:
            yield {"type": "sources", "sources": web_sources}

        active_route = str((workspace_context or {}).get("active_route", "home"))
        include_excerpts = _needs_report_context(message, history, mode, active_route)
        system_prompt = self._build_system_prompt(
            user_name=user_name,
            mode=mode,
            detail_level=detail_level,
            context=workspace_context or {},
            web_sources=web_sources,
            include_report_excerpts=include_excerpts,
        )
        lc_messages = self._build_lc_messages(
            system_prompt,
            history,
            message,
            max_history or self.default_history_limit,
        )

        try:
            primary_name, _, _ = self._resolve_llm_config()
        except Exception:
            primary_name = None

        candidates: List[Tuple[str, GenericLLMProvider]] = []
        try:
            candidates.append((primary_name or "primary", self._build_provider(detail_level)))
        except Exception as exc:
            logger.warning(f"Companion primary provider init error: {exc}")

        candidates.extend(self._build_fallback_chain(primary_name, detail_level))
        if not candidates:
            yield {
                "type": "error",
                "detail": "AI Companion could not initialize any free LLM provider. Check server LLM environment settings.",
            }
            return

        raw_accumulated = ""
        emitted_len = 0
        in_think = False
        in_action_tail = False
        start_time = time.monotonic()

        def _flush_safe_prefix(buffer: str, final: bool = False) -> Tuple[str, bool, bool]:
            nonlocal emitted_len
            nonlocal in_think, in_action_tail

            # Wait cleanly if inside <think>...</think>
            if "<think>" in buffer and "</think>" not in buffer:
                return "", True, False

            cleaned = re.sub(r"<think>.*?</think>", "", buffer, flags=re.DOTALL)

            idx_action = cleaned.find(ACTION_TAG_PREFIX)
            if idx_action != -1:
                visible_target = cleaned[:idx_action]
                in_action_tail = True
            elif not final:
                # Hold any trailing partial match like "[" or "[[IX_ACTION"
                hold = 0
                for tail_len in range(min(len(ACTION_TAG_PREFIX) - 1, len(cleaned)), 0, -1):
                    if ACTION_TAG_PREFIX.startswith(cleaned[-tail_len:]):
                        hold = tail_len
                        break
                visible_target = cleaned[: len(cleaned) - hold] if hold else cleaned
            else:
                visible_target = ACTION_PATTERN.sub("", cleaned)

            if len(visible_target) > emitted_len:
                delta = visible_target[emitted_len:]
                emitted_len = len(visible_target)
                return delta, False, in_action_tail
            return "", False, in_action_tail

        async def _consume_provider(active_provider: GenericLLMProvider):
            nonlocal raw_accumulated
            try:
                stream_iter = active_provider.llm.astream(lc_messages)
                async for chunk in stream_iter:
                    if time.monotonic() - start_time > self.timeout_seconds:
                        raise TimeoutError("AI response generation timed out.")

                    text_piece = _extract_text(getattr(chunk, "content", chunk))
                    if not text_piece:
                        continue
                    raw_accumulated += text_piece
                    delta, _, _ = _flush_safe_prefix(raw_accumulated, final=False)
                    if delta:
                        yield {"type": "token", "delta": delta}
            except NotImplementedError:
                output = await asyncio.wait_for(
                    active_provider.llm.ainvoke(lc_messages),
                    timeout=self.timeout_seconds,
                )
                raw_accumulated = _extract_text(getattr(output, "content", ""))
                delta, _, _ = _flush_safe_prefix(raw_accumulated, final=True)
                if delta:
                    yield {"type": "token", "delta": delta}

        succeeded = False
        last_exc: Optional[Exception] = None
        last_was_rate_limit = False

        for idx, (cand_name, cand_provider) in enumerate(candidates):
            raw_accumulated = ""
            emitted_len = 0
            in_think = False
            in_action_tail = False
            start_time = time.monotonic()
            try:
                async for ev in _consume_provider(cand_provider):
                    yield ev
                if raw_accumulated.strip():
                    succeeded = True
                    break
                raise RuntimeError(f"Empty completion from '{cand_name}'.")
            except (asyncio.TimeoutError, TimeoutError, Exception) as exc:
                last_exc = exc
                err_lower = str(exc).lower()
                last_was_rate_limit = any(
                    tok in err_lower for tok in ("429", "rate_limit", "quota", "402", "billing", "temporarily rate-limited")
                )
                has_more = idx + 1 < len(candidates)
                if emitted_len == 0 and has_more:
                    logger.info(f"Companion switching from '{cand_name}' to next free provider after error: {exc}")
                    continue
                logger.error(f"Companion streaming failure on '{cand_name}': {exc}", exc_info=True)
                break

        if not succeeded:
            if isinstance(last_exc, (asyncio.TimeoutError, TimeoutError)):
                yield {"type": "error", "detail": "Request timed out waiting for the language model."}
            else:
                msg = (
                    "All configured free AI providers are temporarily rate-limited or busy. Please retry in a few seconds."
                    if last_was_rate_limit
                    else "The language model encountered an error while generating a response. Please retry."
                )
                yield {"type": "error", "detail": msg}
            return

        # Finalize remaining non-action text and extract structured actions
        tail_delta, _, _ = _flush_safe_prefix(raw_accumulated, final=True)
        if tail_delta:
            yield {"type": "token", "delta": tail_delta}

        clean_full, actions = extract_clean_text_and_actions(raw_accumulated)
        if not clean_full:
            clean_full = "I could not produce a response for that question. Please try rephrasing."

        for act in actions:
            yield {"type": "action", "action": act}

        yield {
            "type": "done",
            "request_id": request_id,
            "content": clean_full,
            "actions": actions,
            "sources": web_sources,
        }


companion_service = CompanionService()
