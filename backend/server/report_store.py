"""
Hybrid ReportStore for InquireX.
Uses Supabase PostgreSQL (`public.reports`) scoped per authenticated user_id when configured
and table-ready, and falls back gracefully to local JSON (`data/reports.json`) otherwise.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


def _is_missing_table_error(exc: Exception) -> bool:
    msg = str(exc).lower()
    return (
        "pgrst205" in msg
        or "could not find the table" in msg
        or ("relation" in msg and "does not exist" in msg)
    )


def _row_to_report(row: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": str(row.get("id", "")),
        "user_id": str(row["user_id"]) if row.get("user_id") else None,
        "question": row.get("question"),
        "answer": row.get("answer"),
        "orderedData": row.get("ordered_data") if isinstance(row.get("ordered_data"), list) else [],
        "chatMessages": row.get("chat_messages") if isinstance(row.get("chat_messages"), list) else [],
        "timestamp": row.get("timestamp") or int(time.time() * 1000),
    }


def _report_to_row(report_id: str, report: Dict[str, Any], user_id: str) -> Dict[str, Any]:
    now_ms = int(time.time() * 1000)
    ts = report.get("timestamp")
    ts_int = int(ts) if isinstance(ts, (int, float)) else now_ms
    return {
        "id": str(report_id),
        "user_id": str(user_id),
        "question": report.get("question"),
        "answer": report.get("answer"),
        "ordered_data": report.get("orderedData") if isinstance(report.get("orderedData"), list) else [],
        "chat_messages": report.get("chatMessages") if isinstance(report.get("chatMessages"), list) else [],
        "timestamp": ts_int,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


class ReportStore:
    def __init__(self, path: Path, supabase_client_factory=None):
        self._path = path
        self._lock = asyncio.Lock()
        self._supabase_factory = supabase_client_factory
        self._table_ready: Optional[bool] = None
        self._last_probe_at: float = 0.0
        self._warned_missing_table: bool = False

    def _is_supabase_configured(self) -> bool:
        mode = os.getenv("REPORT_STORE_BACKEND", "auto").strip().lower()
        if mode == "local":
            return False
        if self._supabase_factory is not None:
            return True
        return bool(os.getenv("SUPABASE_URL") and os.getenv("SUPABASE_SERVICE_ROLE_KEY"))

    def _get_client(self):
        if not self._is_supabase_configured():
            return None
        if self._supabase_factory is not None:
            return self._supabase_factory()
        import sys
        backend_dir = str(Path(__file__).resolve().parents[1])
        if backend_dir not in sys.path:
            sys.path.insert(0, backend_dir)
        from auth.db import get_supabase_admin
        return get_supabase_admin()

    async def _probe_table_ready(self, force: bool = False) -> bool:
        if not self._is_supabase_configured():
            self._table_ready = False
            return False

        now = time.monotonic()
        if not force and self._table_ready is True:
            return True
        if not force and self._table_ready is False and (now - self._last_probe_at) < 15.0:
            return False

        self._last_probe_at = now
        try:
            sb = self._get_client()
            if sb is None:
                self._table_ready = False
                return False

            def _check():
                return sb.table("reports").select("id").limit(1).execute()

            await asyncio.to_thread(_check)
            if self._table_ready is False:
                logger.info("Supabase `public.reports` table detected and now active.")
            self._table_ready = True
            return True
        except Exception as exc:
            if _is_missing_table_error(exc):
                if not self._warned_missing_table:
                    logger.warning(
                        "Supabase `public.reports` table not found yet; using local fallback (%s). "
                        "Run backend/server/supabase_reports.sql in Supabase SQL Editor to enable database persistence.",
                        self._path,
                    )
                    self._warned_missing_table = True
            else:
                logger.warning(f"Supabase reports probe failed; falling back to local store: {exc}")
            self._table_ready = False
            return False

    async def get_storage_status(self) -> Dict[str, Any]:
        configured = self._is_supabase_configured()
        ready = await self._probe_table_ready(force=True)
        local_data = await self._read_all_local()
        return {
            "backend": "supabase" if ready else "local_fallback",
            "supabase_configured": configured,
            "reports_table_ready": ready,
            "local_count": len(local_data),
        }

    async def _ensure_parent_dir(self) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)

    async def _read_all_unlocked(self) -> Dict[str, Dict[str, Any]]:
        if not self._path.exists():
            return {}
        try:
            data = json.loads(self._path.read_text(encoding="utf-8"))
            if isinstance(data, dict):
                return data  # type: ignore[return-value]
        except Exception:
            return {}
        return {}

    async def _read_all_local(self) -> Dict[str, Dict[str, Any]]:
        async with self._lock:
            return await self._read_all_unlocked()

    async def _write_all_unlocked(self, data: Dict[str, Dict[str, Any]]) -> None:
        await self._ensure_parent_dir()
        tmp_path = self._path.with_suffix(self._path.suffix + ".tmp")
        tmp_path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
        tmp_path.replace(self._path)

    async def list_reports(
        self,
        report_ids: List[str] | None = None,
        user_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        if await self._probe_table_ready():
            try:
                sb = self._get_client()

                def _fetch():
                    q = sb.table("reports").select("*")
                    if user_id:
                        q = q.eq("user_id", str(user_id))
                    if report_ids:
                        q = q.in_("id", [str(rid) for rid in report_ids])
                    return q.order("timestamp", desc=True).execute()

                res = await asyncio.to_thread(_fetch)
                return [_row_to_report(r) for r in (res.data or [])]
            except Exception as exc:
                if _is_missing_table_error(exc):
                    self._table_ready = False
                else:
                    logger.warning(f"Supabase list_reports failed; falling back to local store: {exc}")

        async with self._lock:
            data = await self._read_all_unlocked()
            items = list(data.values())
            if user_id:
                items = [r for r in items if r.get("user_id") in (None, str(user_id))]
            if report_ids is not None:
                id_set = set(report_ids)
                items = [r for r in items if r.get("id") in id_set]
            return items

    async def get_report(
        self,
        report_id: str,
        user_id: Optional[str] = None,
    ) -> Dict[str, Any] | None:
        if await self._probe_table_ready():
            try:
                sb = self._get_client()

                def _fetch():
                    q = sb.table("reports").select("*").eq("id", str(report_id))
                    if user_id:
                        q = q.eq("user_id", str(user_id))
                    return q.limit(1).execute()

                res = await asyncio.to_thread(_fetch)
                if res.data:
                    return _row_to_report(res.data[0])
                return None
            except Exception as exc:
                if _is_missing_table_error(exc):
                    self._table_ready = False
                else:
                    logger.warning(f"Supabase get_report failed; falling back to local store: {exc}")

        async with self._lock:
            data = await self._read_all_unlocked()
            item = data.get(report_id)
            if item and user_id and item.get("user_id") not in (None, str(user_id)):
                return None
            return item

    async def upsert_report(
        self,
        report_id: str,
        report: Dict[str, Any],
        user_id: Optional[str] = None,
    ) -> None:
        owner_id = str(user_id or report.get("user_id") or "")
        saved_to_supabase = False

        if owner_id and await self._probe_table_ready():
            try:
                sb = self._get_client()

                def _check_and_upsert():
                    existing = (
                        sb.table("reports").select("id,user_id").eq("id", str(report_id)).limit(1).execute()
                    )
                    if existing.data:
                        existing_owner = str(existing.data[0].get("user_id") or "")
                        if existing_owner and existing_owner != owner_id:
                            raise PermissionError("You do not have permission to modify this report.")
                    row = _report_to_row(report_id, report, owner_id)
                    return sb.table("reports").upsert(row, on_conflict="id").execute()

                await asyncio.to_thread(_check_and_upsert)
                saved_to_supabase = True
            except PermissionError:
                raise
            except Exception as exc:
                if _is_missing_table_error(exc):
                    self._table_ready = False
                else:
                    logger.warning(f"Supabase upsert_report failed; falling back to local store: {exc}")

        if not saved_to_supabase:
            async with self._lock:
                data = await self._read_all_unlocked()
                existing = data.get(report_id)
                if existing and owner_id and existing.get("user_id") not in (None, owner_id):
                    raise PermissionError("You do not have permission to modify this report.")
                payload = dict(report)
                if owner_id:
                    payload["user_id"] = owner_id
                data[report_id] = payload
                await self._write_all_unlocked(data)

    async def delete_report(
        self,
        report_id: str,
        user_id: Optional[str] = None,
    ) -> bool:
        deleted_remote = False
        if await self._probe_table_ready():
            try:
                sb = self._get_client()

                def _delete():
                    existing = (
                        sb.table("reports").select("id,user_id").eq("id", str(report_id)).limit(1).execute()
                    )
                    if not existing.data:
                        return False
                    existing_owner = str(existing.data[0].get("user_id") or "")
                    if user_id and existing_owner and existing_owner != str(user_id):
                        raise PermissionError("You do not have permission to delete this report.")
                    q = sb.table("reports").delete().eq("id", str(report_id))
                    if user_id:
                        q = q.eq("user_id", str(user_id))
                    q.execute()
                    return True

                deleted_remote = await asyncio.to_thread(_delete)
            except PermissionError:
                raise
            except Exception as exc:
                if _is_missing_table_error(exc):
                    self._table_ready = False
                else:
                    logger.warning(f"Supabase delete_report failed: {exc}")

        deleted_local = False
        async with self._lock:
            data = await self._read_all_unlocked()
            item = data.get(report_id)
            if item is not None:
                if user_id and item.get("user_id") not in (None, str(user_id)):
                    if not deleted_remote:
                        raise PermissionError("You do not have permission to delete this report.")
                else:
                    del data[report_id]
                    await self._write_all_unlocked(data)
                    deleted_local = True

        return deleted_remote or deleted_local

    async def migrate_local_to_supabase(self, user_id: str) -> Dict[str, Any]:
        """Copy local reports belonging to this user (or legacy unowned entries) into Supabase."""
        if not user_id:
            raise ValueError("Authenticated user_id required for migration.")
        ready = await self._probe_table_ready(force=True)
        if not ready:
            raise RuntimeError(
                "Supabase `public.reports` table is not ready yet. Run supabase_reports.sql in Supabase SQL Editor first."
            )

        sb = self._get_client()
        local_items = await self._read_all_local()
        migrated = 0
        skipped = 0

        for rid, rep in local_items.items():
            owner = rep.get("user_id")
            if owner not in (None, str(user_id)):
                skipped += 1
                continue
            row = _report_to_row(rid, rep, str(user_id))

            def _upsert(r=row):
                return sb.table("reports").upsert(r, on_conflict="id").execute()

            await asyncio.to_thread(_upsert)
            migrated += 1

        return {"migrated": migrated, "skipped": skipped, "total_local": len(local_items)}
