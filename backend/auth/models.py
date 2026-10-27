"""
User model helpers — CRUD operations against the Supabase `users` table.

Table schema (run once in Supabase SQL editor):

    CREATE TABLE IF NOT EXISTS public.users (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name        TEXT NOT NULL,
        email       TEXT UNIQUE NOT NULL,
        password    TEXT,                     -- NULL for Google OAuth users
        provider    TEXT NOT NULL DEFAULT 'email',   -- 'email' | 'google'
        avatar_url  TEXT,
        created_at  TIMESTAMPTZ DEFAULT now(),
        last_login  TIMESTAMPTZ DEFAULT now()
    );
"""
import logging
from typing import Optional
from auth.db import get_supabase_admin

logger = logging.getLogger(__name__)


def get_user_by_email(email: str) -> Optional[dict]:
    """Fetch a user row by email address. Returns dict or None."""
    try:
        sb = get_supabase_admin()
        res = sb.table("users").select("*").eq("email", email).execute()
        return res.data[0] if res.data else None
    except Exception as e:
        logger.error(f"get_user_by_email error: {e}")
        return None


def get_user_by_id(user_id: str) -> Optional[dict]:
    """Fetch a user row by UUID. Returns dict or None."""
    try:
        sb = get_supabase_admin()
        res = sb.table("users").select("*").eq("id", user_id).execute()
        return res.data[0] if res.data else None
    except Exception as e:
        logger.error(f"get_user_by_id error: {e}")
        return None


def create_user(name: str, email: str, hashed_password: Optional[str] = None,
                provider: str = "email", avatar_url: Optional[str] = None) -> Optional[dict]:
    """Insert a new user row. Returns the created row or None on failure."""
    try:
        sb = get_supabase_admin()
        payload = {
            "name": name,
            "email": email,
            "password": hashed_password,
            "provider": provider,
            "avatar_url": avatar_url,
        }
        res = sb.table("users").insert(payload).execute()
        return res.data[0] if res.data else None
    except Exception as e:
        logger.error(f"create_user error: {e}")
        return None


def update_last_login(user_id: str) -> None:
    """Update the last_login timestamp for a user."""
    try:
        sb = get_supabase_admin()
        from datetime import datetime, timezone
        sb.table("users").update({"last_login": datetime.now(timezone.utc).isoformat()}).eq("id", user_id).execute()
    except Exception as e:
        logger.error(f"update_last_login error: {e}")


def upsert_google_user(name: str, email: str, avatar_url: Optional[str] = None) -> Optional[dict]:
    """
    Create or update a Google OAuth user.
    If user already exists (any provider), return them.
    If new, create with provider='google'.
    """
    existing = get_user_by_email(email)
    if existing:
        update_last_login(existing["id"])
        return existing
    return create_user(name=name, email=email, provider="google", avatar_url=avatar_url)
