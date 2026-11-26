"""
InquireX AI Companion FastAPI Router
Exposes SSE streaming chat endpoint and capability inspection under JWT AuthMiddleware.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, File, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

try:
    from companion.service import companion_service
except ImportError:
    from backend.companion.service import companion_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/companion", tags=["companion"])


class CompanionMessageItem(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., max_length=4000)


class CompanionStreamRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    history: List[CompanionMessageItem] = Field(default_factory=list)
    mode: Literal["chat", "brief", "narrate"] = "chat"
    detail_level: Literal["concise", "detailed"] = "concise"
    max_history: int = Field(default=10, ge=2, le=20)
    workspace_context: Dict[str, Any] = Field(default_factory=dict)


def _require_user(request: Request) -> Dict[str, Any]:
    user = getattr(request.state, "user", None)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated.")
    return user


@router.get("/capabilities")
async def get_companion_capabilities(request: Request):
    """Return non-sensitive AI Companion capabilities for the authenticated user."""
    _require_user(request)
    return JSONResponse(companion_service.get_capabilities())


@router.post("/transcribe")
async def transcribe_companion_audio(request: Request, file: UploadFile = File(...)):
    """Transcribe browser-recorded microphone audio via configured Whisper backend."""
    user = _require_user(request)
    user_key = str(user.get("sub") or user.get("email") or "user")

    content_type = (file.content_type or "audio/webm").split(";")[0].strip().lower()
    if content_type and not content_type.startswith("audio/") and content_type != "video/webm":
        raise HTTPException(status_code=422, detail="Invalid audio format uploaded.")

    audio_bytes = await file.read()
    try:
        text = await companion_service.transcribe_audio(
            user_key=user_key,
            audio_bytes=audio_bytes,
            filename=file.filename or "recording.webm",
            content_type=content_type or "audio/webm",
        )
        return JSONResponse({"text": text})
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        logger.error(f"Unexpected transcription error: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail="Voice transcription failed.")


@router.post("/stream")
async def stream_companion_reply(body: CompanionStreamRequest, request: Request):
    """Stream AI Companion response chunks and optional UI action intents as SSE."""
    user = _require_user(request)
    user_key = str(user.get("sub") or user.get("email") or "user")
    user_name = str(user.get("name") or user.get("email") or "Researcher")

    history_dicts = [m.model_dump() for m in body.history]
    clean_message = body.message.strip()
    if not clean_message:
        raise HTTPException(status_code=422, detail="Message cannot be blank.")

    async def sse_generator():
        try:
            async for event in companion_service.stream_reply(
                user_key=user_key,
                user_name=user_name,
                message=clean_message,
                history=history_dicts,
                workspace_context=body.workspace_context,
                mode=body.mode,
                detail_level=body.detail_level,
                max_history=body.max_history,
            ):
                if await request.is_disconnected():
                    logger.info(f"Companion SSE client disconnected for user={user_key}")
                    break
                payload = json.dumps(event, ensure_ascii=False)
                yield f"data: {payload}\n\n"
        except Exception as exc:
            logger.error(f"Unhandled SSE stream exception: {exc}", exc_info=True)
            err_payload = json.dumps(
                {"type": "error", "detail": "An unexpected streaming error occurred."}
            )
            yield f"data: {err_payload}\n\n"

    return StreamingResponse(
        sse_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
