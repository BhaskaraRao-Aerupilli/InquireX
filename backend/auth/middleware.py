"""
Auth middleware — protects all routes except /login, /register, /auth/* and /site/*.
Reads the JWT cookie and injects user info into request.state.
"""
import logging
from fastapi import Request, Response
from fastapi.responses import RedirectResponse
from starlette.middleware.base import BaseHTTPMiddleware

from auth.auth import decode_access_token

logger = logging.getLogger(__name__)

COOKIE_NAME = "gptr_session"

# Routes that are ALWAYS accessible without authentication
PUBLIC_PREFIXES = [
    "/login",
    "/register",
    "/auth/",
    "/site/login.html",
    "/site/register.html",
    "/static/",
    "/favicon",
    "/.well-known",
]


class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        # Always allow public routes
        for prefix in PUBLIC_PREFIXES:
            if path.startswith(prefix) or path == prefix.rstrip("/"):
                return await call_next(request)

        # Verify JWT cookie
        token = request.cookies.get(COOKIE_NAME)
        if token:
            payload = decode_access_token(token)
            if payload:
                # Inject user into request state
                request.state.user = payload
                return await call_next(request)

        # Not authenticated — redirect to login (HTML requests) or 401 (API/WS)
        accept = request.headers.get("accept", "")
        if (
            "text/html" in accept
            and not path.startswith("/api/")
            and not path.startswith("/ws")
        ):
            return RedirectResponse(url="/login", status_code=302)

        # For API/WebSocket calls return 401
        from fastapi.responses import JSONResponse
        return JSONResponse({"detail": "Not authenticated. Please log in."}, status_code=401)
