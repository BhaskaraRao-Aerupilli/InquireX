import asyncio
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from backend.server.report_store import ReportStore


class _FakeResponse:
    def __init__(self, data):
        self.data = data


class _FakeQuery:
    def __init__(self, store_rows: dict, fail_exc: Exception | None = None):
        self._rows = store_rows
        self._fail_exc = fail_exc
        self._op = "select"
        self._eq_filters = []
        self._in_filters = []
        self._payload = None
        self._order_ts_desc = False
        self._limit = None

    def select(self, _cols):
        self._op = "select"
        return self

    def eq(self, col, val):
        self._eq_filters.append((col, val))
        return self

    def in_(self, col, vals):
        self._in_filters.append((col, set(vals)))
        return self

    def order(self, col, desc=False):
        self._order_ts_desc = (col == "timestamp" and desc)
        return self

    def limit(self, n):
        self._limit = n
        return self

    def upsert(self, row, on_conflict="id"):
        self._op = "upsert"
        self._payload = row
        return self

    def delete(self):
        self._op = "delete"
        return self

    def execute(self):
        if self._fail_exc is not None:
            raise self._fail_exc

        if self._op == "upsert":
            row = dict(self._payload)
            self._rows[row["id"]] = row
            return _FakeResponse([row])

        def _matches(row):
            for col, val in self._eq_filters:
                if str(row.get(col)) != str(val):
                    return False
            for col, vals in self._in_filters:
                if str(row.get(col)) not in vals:
                    return False
            return True

        matched = [dict(r) for r in self._rows.values() if _matches(r)]
        if self._op == "delete":
            for r in matched:
                self._rows.pop(r["id"], None)
            return _FakeResponse(matched)

        if self._order_ts_desc:
            matched.sort(key=lambda r: int(r.get("timestamp") or 0), reverse=True)
        if self._limit is not None:
            matched = matched[: self._limit]
        return _FakeResponse(matched)


class _FakeSupabaseClient:
    def __init__(self, rows: dict | None = None, fail_exc: Exception | None = None):
        self.rows = rows if rows is not None else {}
        self.fail_exc = fail_exc

    def table(self, _name: str):
        return _FakeQuery(self.rows, self.fail_exc)


class ReportStoreTests(unittest.TestCase):
    def test_supabase_backend_enforces_user_isolation_and_crud(self):
        fake_sb = _FakeSupabaseClient()
        with tempfile.TemporaryDirectory() as tmp:
            store = ReportStore(Path(tmp) / "reports.json", supabase_client_factory=lambda: fake_sb)

            async def scenario():
                status = await store.get_storage_status()
                self.assertEqual(status["backend"], "supabase")
                self.assertTrue(status["reports_table_ready"])

                await store.upsert_report(
                    "rep_1",
                    {
                        "id": "rep_1",
                        "question": "User A report",
                        "answer": "# Answer A",
                        "orderedData": [{"type": "metadata", "metrics": {"words": 100}}],
                        "chatMessages": [{"role": "user", "content": "hi"}],
                        "timestamp": 1000,
                    },
                    user_id="user-a",
                )
                await store.upsert_report(
                    "rep_2",
                    {
                        "id": "rep_2",
                        "question": "User B report",
                        "answer": "# Answer B",
                        "orderedData": [],
                        "chatMessages": [],
                        "timestamp": 2000,
                    },
                    user_id="user-b",
                )

                list_a = await store.list_reports(user_id="user-a")
                self.assertEqual([r["id"] for r in list_a], ["rep_1"])
                self.assertEqual(list_a[0]["orderedData"][0]["metrics"]["words"], 100)

                # Cross-user read & write blocked
                self.assertIsNone(await store.get_report("rep_1", user_id="user-b"))
                with self.assertRaises(PermissionError):
                    await store.upsert_report("rep_1", {"question": "hijack"}, user_id="user-b")
                with self.assertRaises(PermissionError):
                    await store.delete_report("rep_1", user_id="user-b")

                self.assertTrue(await store.delete_report("rep_1", user_id="user-a"))
                self.assertEqual(await store.list_reports(user_id="user-a"), [])

            asyncio.run(scenario())

    def test_missing_table_falls_back_gracefully_to_local_json(self):
        missing_err = RuntimeError("PGRST205: Could not find the table 'public.reports' in the schema cache")
        fake_sb = _FakeSupabaseClient(fail_exc=missing_err)
        with tempfile.TemporaryDirectory() as tmp:
            json_path = Path(tmp) / "reports.json"
            store = ReportStore(json_path, supabase_client_factory=lambda: fake_sb)

            async def scenario():
                status = await store.get_storage_status()
                self.assertEqual(status["backend"], "local_fallback")
                self.assertFalse(status["reports_table_ready"])

                await store.upsert_report(
                    "rep_local",
                    {"id": "rep_local", "question": "Local Q", "answer": "Ans", "timestamp": 500},
                    user_id="u1",
                )
                self.assertTrue(json_path.exists())
                listed = await store.list_reports(user_id="u1")
                self.assertEqual(len(listed), 1)
                self.assertEqual(listed[0]["question"], "Local Q")

                # Different user does not see u1's report
                self.assertEqual(await store.list_reports(user_id="u2"), [])

            asyncio.run(scenario())

    def test_migrate_local_to_supabase(self):
        with tempfile.TemporaryDirectory() as tmp:
            json_path = Path(tmp) / "reports.json"
            json_path.write_text(
                json.dumps(
                    {
                        "legacy_1": {"id": "legacy_1", "question": "Legacy Report", "answer": "Body", "timestamp": 111},
                        "other_user": {
                            "id": "other_user",
                            "user_id": "other-id",
                            "question": "Not mine",
                            "answer": "Nope",
                            "timestamp": 222,
                        },
                    }
                ),
                encoding="utf-8",
            )
            fake_sb = _FakeSupabaseClient()
            store = ReportStore(json_path, supabase_client_factory=lambda: fake_sb)

            async def scenario():
                res = await store.migrate_local_to_supabase("my-uuid")
                self.assertEqual(res["migrated"], 1)
                self.assertEqual(res["skipped"], 1)
                mine = await store.list_reports(user_id="my-uuid")
                self.assertEqual([r["id"] for r in mine], ["legacy_1"])

            asyncio.run(scenario())

    def test_storage_status_endpoint_requires_auth(self):
        from backend.server.app import app

        client = TestClient(app)
        self.assertEqual(client.get("/api/reports/storage-status").status_code, 401)
        self.assertEqual(client.post("/api/reports/migrate-local").status_code, 401)

    def test_user_doc_path_and_files_isolation(self):
        from backend.server.app import _get_user_doc_path, app

        path_a = _get_user_doc_path("5cc6667b-e6d0-43ce-bde7-f188843f8f22")
        path_b = _get_user_doc_path("../../etc/passwd")
        self.assertIn("user_5cc6667b-e6d0-43ce-bde7-f188843f8f22", path_a)
        self.assertNotIn("..", path_b)

        with tempfile.TemporaryDirectory() as tmp:
            with patch("backend.server.app.DOC_PATH", tmp):
                user_a_dir = _get_user_doc_path("user-alpha")
                user_b_dir = _get_user_doc_path("user-beta")
                Path(user_a_dir).mkdir(parents=True, exist_ok=True)
                Path(user_b_dir).mkdir(parents=True, exist_ok=True)
                (Path(user_a_dir) / "secret_a.txt").write_text("alpha", encoding="utf-8")
                (Path(user_b_dir) / "secret_b.txt").write_text("beta", encoding="utf-8")

                from backend.auth.auth import create_access_token

                token_a = create_access_token({"sub": "user-alpha", "email": "a@example.com", "name": "A"})
                client = TestClient(app)
                client.cookies.set("gptr_session", token_a)

                res_list = client.get("/files/")
                self.assertEqual(res_list.status_code, 200)
                self.assertEqual(res_list.json()["files"], ["secret_a.txt"])

                res_del_b = client.delete("/files/secret_b.txt")
                self.assertEqual(res_del_b.status_code, 404)
                self.assertTrue((Path(user_b_dir) / "secret_b.txt").exists())


if __name__ == "__main__":
    unittest.main()
