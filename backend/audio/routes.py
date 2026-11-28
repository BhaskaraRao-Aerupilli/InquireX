"""
InquireX Studio Audio Briefing FastAPI Router
Exposes voice catalog, neural briefing synthesis, and byte-range audio streaming
protected under authenticated JWT user ownership.
"""

from __future__ import annotations

import logging
import re
from typing import Any, Dict, Literal, Optional

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field

try:
    from audio.service import ALLOWED_MODES, DEFAULT_VOICE_ID, audio_briefing_service
except ImportError:
    from backend.audio.service import ALLOWED_MODES, DEFAULT_VOICE_ID, audio_briefing_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/audio", tags=["audio"])


def _require_user(request: Request) -> Dict[str, Any]:
    user = getattr(request.state, "user", None)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated.")
    return user


def _parse_byte_range(range_header: str, total_len: int) -> Optional[tuple[int, int]]:
    """Parse HTTP Range header into inclusive (start, end) offsets."""
    m = re.match(r"^\s*bytes=(\d*)-(\d*)\s*$", range_header or "")
    if not m or total_len <= 0:
        return None
    start_str, end_str = m.group(1), m.group(2)
    if not start_str and not end_str:
        return None
    if start_str:
        start = int(start_str)
        end = int(end_str) if end_str else total_len - 1
    else:
        suffix = int(end_str)
        start = max(0, total_len - suffix)
        end = total_len - 1
    if start < 0 or start >= total_len or end < start:
        return None
    return start, min(end, total_len - 1)


class AudioBriefingRequest(BaseModel):
    report_id: str = Field(default="", max_length=120)
    title: str = Field(default="Research Report", max_length=300)
    content: str = Field(..., min_length=20, max_length=80000)
    mode: Literal["executive", "detailed", "full"] = "executive"
    voice: str = Field(default=DEFAULT_VOICE_ID, max_length=64)


@router.get("/voices")
async def list_audio_voices(request: Request):
    """List verified studio voice presets and TTS backend readiness."""
    _require_user(request)
    return JSONResponse(audio_briefing_service.get_voices())


@router.post("/briefing")
async def generate_audio_briefing(body: AudioBriefingRequest, request: Request):
    """Generate a broadcast script + studio neural audio for the authenticated user."""
    user = _require_user(request)
    user_id = str(user.get("sub") or user.get("email") or "user")

    if body.mode not in ALLOWED_MODES:
        raise HTTPException(status_code=422, detail="Unsupported briefing mode.")

    try:
        meta = await audio_briefing_service.create_briefing(
            user_id=user_id,
            report_id=body.report_id,
            title=body.title,
            content=body.content,
            mode=body.mode,
            voice_id=body.voice,
        )
        return JSONResponse(meta)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except RuntimeError as exc:
        msg = str(exc)
        status = 429 if "rate limit" in msg.lower() else 503
        raise HTTPException(status_code=status, detail=msg)
    except Exception as exc:
        logger.error(f"Audio briefing generation failed: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail="Audio briefing generation failed.")


@router.get("/briefing/{briefing_id}/part/{part_idx}")
async def stream_audio_briefing_part(briefing_id: str, part_idx: int, request: Request):
    """Stream an individual synthesized segment MP3/WAV for low-latency progressive playback."""
    user = _require_user(request)
    user_id = str(user.get("sub") or user.get("email") or "user")

    try:
        res = await audio_briefing_service.get_part_bytes(briefing_id, part_idx, user_id)
    except Exception as exc:
        logger.warning(f"Audio segment {part_idx} failed for '{briefing_id}': {exc}")
        raise HTTPException(status_code=503, detail="Audio segment unavailable.")

    if not res:
        raise HTTPException(status_code=404, detail="Audio briefing segment not found.")

    data, mime = res
    return Response(
        content=data,
        status_code=200,
        media_type=mime,
        headers={
            "Cache-Control": "private, max-age=1800",
            "Content-Length": str(len(data)),
        },
    )


@router.get("/briefing/{briefing_id}")
async def stream_audio_briefing(
    briefing_id: str,
    request: Request,
    download: int = Query(default=0, ge=0, le=1),
):
    """Stream complete briefing MP3/WAV with Range support or serve as downloadable file."""
    user = _require_user(request)
    user_id = str(user.get("sub") or user.get("email") or "user")

    try:
        full = await audio_briefing_service.get_full_audio_bytes(briefing_id, user_id)
    except Exception as exc:
        logger.warning(f"Full audio assembly failed for '{briefing_id}': {exc}")
        raise HTTPException(status_code=503, detail="Audio briefing assembly failed.")

    if not full:
        raise HTTPException(status_code=404, detail="Audio briefing not found.")

    data, mime, filename = full
    total = len(data)

    base_headers = {
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, max-age=1800",
    }
    if download:
        base_headers["Content-Disposition"] = f'attachment; filename="{filename}"'

    range_header = request.headers.get("range")
    if range_header and not download:
        parsed = _parse_byte_range(range_header, total)
        if not parsed:
            return Response(status_code=416, headers={"Content-Range": f"bytes */{total}"})
        start, end = parsed
        chunk = data[start : end + 1]
        return Response(
            content=chunk,
            status_code=206,
            media_type=mime,
            headers={
                **base_headers,
                "Content-Range": f"bytes {start}-{end}/{total}",
                "Content-Length": str(len(chunk)),
            },
        )

    return Response(
        content=data,
        status_code=200,
        media_type=mime,
        headers={
            **base_headers,
            "Content-Length": str(total),
        },
    )
