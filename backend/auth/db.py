"""
Supabase client initialisation.
Uses service-role key for server-side operations (admin access to auth + DB).
"""
import logging
from supabase import create_client, Client
from auth.config import SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY

logger = logging.getLogger(__name__)

_supabase_admin: Client = None
_supabase_anon: Client = None


def get_supabase_admin() -> Client:
    """Return a Supabase client with the service-role key (admin privileges)."""
    global _supabase_admin
    if _supabase_admin is None:
        if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
            raise RuntimeError(
                "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env"
            )
        _supabase_admin = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    return _supabase_admin


def get_supabase_anon() -> Client:
    """Return a Supabase client with the anon key (public access)."""
    global _supabase_anon
    if _supabase_anon is None:
        if not SUPABASE_URL or not SUPABASE_ANON_KEY:
            raise RuntimeError(
                "SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env"
            )
        _supabase_anon = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
    return _supabase_anon
