"""
Auth routes:
  POST /auth/register      — username/password registration
  POST /auth/login         — username/password login
  GET  /auth/logout        — clear session cookie
  GET  /auth/google        — start Google OAuth flow
  GET  /auth/google/callback — Google OAuth callback
  GET  /auth/me            — return current user info (JSON)
  GET  /login              — serve login page
  GET  /register           — serve register page
"""
import os
import logging
import httpx
from urllib.parse import urlencode

from fastapi import APIRouter, Request, Response, HTTPException, Form
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
from pydantic import BaseModel, EmailStr

from auth.auth import hash_password, verify_password, create_access_token, decode_access_token
from auth.models import get_user_by_email, create_user, update_last_login, upsert_google_user
from auth.config import (
    GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI, APP_BASE_URL
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])

COOKIE_NAME = "gptr_session"
FRONTEND_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "frontend")
)


# ─────────────────────────────────────────────
# Helper: set / clear JWT cookie
# ─────────────────────────────────────────────

def _set_session_cookie(response: Response, user: dict) -> None:
    token = create_access_token({"sub": user["id"], "email": user["email"], "name": user["name"]})
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        max_age=60 * 60 * 24,   # 24 hours
        samesite="lax",
        secure=False,            # set True in production with HTTPS
    )


def _clear_session_cookie(response: Response) -> None:
    response.delete_cookie(key=COOKIE_NAME)


# ─────────────────────────────────────────────
# Serve HTML pages
# ─────────────────────────────────────────────

@router.get("/login-page", response_class=HTMLResponse, include_in_schema=False)
async def login_page():
    path = os.path.join(FRONTEND_DIR, "login.html")
    with open(path, "r", encoding="utf-8") as f:
        return HTMLResponse(f.read())


@router.get("/register-page", response_class=HTMLResponse, include_in_schema=False)
async def register_page():
    path = os.path.join(FRONTEND_DIR, "register.html")
    with open(path, "r", encoding="utf-8") as f:
        return HTMLResponse(f.read())


# ─────────────────────────────────────────────
# Registration
# ─────────────────────────────────────────────

class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str


@router.post("/register")
async def register(body: RegisterRequest):
    """Create a new user account with email + password."""
    if len(body.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")

    existing = get_user_by_email(body.email)
    if existing:
        raise HTTPException(status_code=409, detail="An account with this email already exists.")

    hashed = hash_password(body.password)
    user = create_user(name=body.name, email=body.email, hashed_password=hashed, provider="email")
    if not user:
        raise HTTPException(status_code=500, detail="Failed to create account. Please try again.")

    return JSONResponse({"message": "Account created successfully!", "email": user["email"]})


# ─────────────────────────────────────────────
# Login
# ─────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: str
    password: str


@router.post("/login")
async def login(body: LoginRequest):
    """Authenticate with email + password and issue a session cookie."""
    user = get_user_by_email(body.email)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    if not user.get("password"):
        raise HTTPException(status_code=400, detail="This account uses Google Sign-In. Please use the Google button.")

    if not verify_password(body.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    update_last_login(user["id"])
    res = JSONResponse({"message": "Login successful", "name": user["name"], "email": user["email"]})
    _set_session_cookie(res, user)
    return res


# ─────────────────────────────────────────────
# Logout
# ─────────────────────────────────────────────

@router.get("/logout")
async def logout():
    response = RedirectResponse(url="/login", status_code=302)
    _clear_session_cookie(response)
    return response


# ─────────────────────────────────────────────
# Current user info
# ─────────────────────────────────────────────

@router.get("/me")
async def me(request: Request):
    """Return current logged-in user info from JWT cookie."""
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Session expired. Please log in again.")
    return JSONResponse({
        "id": payload.get("sub"),
        "name": payload.get("name"),
        "email": payload.get("email"),
    })


# ─────────────────────────────────────────────
# Google OAuth
# ─────────────────────────────────────────────

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"


@router.get("/google")
async def google_login():
    """Redirect browser to Google's OAuth consent screen."""
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=501, detail="Google OAuth is not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env")

    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "select_account",
    }
    return RedirectResponse(f"{GOOGLE_AUTH_URL}?{urlencode(params)}")


@router.get("/google/callback")
async def google_callback(request: Request, code: str = None, error: str = None):
    """Handle Google OAuth callback, create/update user, issue session cookie."""
    if error or not code:
        return RedirectResponse(f"/login?error=google_auth_failed")

    # Exchange code for tokens
    async with httpx.AsyncClient() as client:
        token_res = await client.post(GOOGLE_TOKEN_URL, data={
            "code": code,
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "redirect_uri": GOOGLE_REDIRECT_URI,
            "grant_type": "authorization_code",
        })

    if token_res.status_code != 200:
        logger.error(f"Google token exchange failed: {token_res.text}")
        return RedirectResponse("/login?error=token_exchange_failed")

    access_token = token_res.json().get("access_token")

    # Fetch user info from Google
    async with httpx.AsyncClient() as client:
        userinfo_res = await client.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"}
        )

    if userinfo_res.status_code != 200:
        return RedirectResponse("/login?error=userinfo_failed")

    info = userinfo_res.json()
    email = info.get("email")
    name = info.get("name", email)
    avatar_url = info.get("picture")

    if not email:
        return RedirectResponse("/login?error=no_email")

    # Upsert user in Supabase
    user = upsert_google_user(name=name, email=email, avatar_url=avatar_url)
    if not user:
        return RedirectResponse("/login?error=db_error")

    response = RedirectResponse(url="/", status_code=302)
    _set_session_cookie(response, user)
    return response
