import sys
import types
import unittest
from unittest.mock import AsyncMock, patch


if "fastapi" not in sys.modules:
    fastapi_stub = types.ModuleType("fastapi")

    class _HTTPException(Exception):
        def __init__(self, status_code: int, detail):
            super().__init__(str(detail))
            self.status_code = status_code
            self.detail = detail

    class _APIRouter:
        def _decorator(self, *_args, **_kwargs):
            def _inner(func):
                return func

            return _inner

        get = post = put = delete = patch = _decorator

    def _depends(_callable):
        return None

    class _BackgroundTasks:
        pass

    fastapi_stub.APIRouter = _APIRouter
    fastapi_stub.HTTPException = _HTTPException
    fastapi_stub.Depends = _depends
    fastapi_stub.BackgroundTasks = _BackgroundTasks
    sys.modules["fastapi"] = fastapi_stub

if "database" not in sys.modules:
    database_stub = types.ModuleType("database")

    def _stub_get_db():
        raise RuntimeError("get_db must be patched in tests")

    database_stub.get_db = _stub_get_db
    sys.modules["database"] = database_stub

if "httpx" not in sys.modules:
    httpx_stub = types.ModuleType("httpx")

    class _AsyncClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def request(self, **_kwargs):
            raise RuntimeError("httpx.AsyncClient.request should be patched in tests")

        async def get(self, *_args, **_kwargs):
            raise RuntimeError("httpx.AsyncClient.get should be patched in tests")

    httpx_stub.AsyncClient = _AsyncClient
    sys.modules["httpx"] = httpx_stub

if "routes.auth" not in sys.modules:
    auth_stub = types.ModuleType("routes.auth")

    async def _stub_get_current_user():
        return {"id": "stub-user"}

    auth_stub.get_current_user = _stub_get_current_user
    sys.modules["routes.auth"] = auth_stub

from routes import real_integrations


class _DedupCollection:
    def __init__(self):
        self.docs = {}
        self.inserted = []

    async def find_one(self, flt=None, *_args, **_kwargs):
        key = (flt or {}).get("id")
        if not key:
            return None
        return self.docs.get(key)

    async def insert_one(self, doc):
        doc_id = doc.get("id")
        if doc_id:
            self.docs[doc_id] = doc
        self.inserted.append(doc)
        return {"ok": 1}


class _Collection:
    def __init__(self, seed_doc=None):
        self.seed_doc = seed_doc
        self.updated = []
        self.inserted = []

    async def find_one(self, *_args, **_kwargs):
        return self.seed_doc

    async def update_one(self, flt, payload, upsert=False):
        self.updated.append({"filter": flt, "payload": payload, "upsert": upsert})
        return {"ok": 1}

    async def insert_one(self, doc):
        self.inserted.append(doc)
        return {"ok": 1}


class _FakeDb:
    def __init__(self, integrations=None):
        self.user_integrations = _Collection(seed_doc=integrations)
        self.integration_event_dedup = _DedupCollection()
        self.email_sends = _Collection(seed_doc={})
        self.email_events = _Collection(seed_doc={})


def _run(coro):
    return real_integrations.asyncio.run(coro)


class IntegrationsReliabilityTests(unittest.TestCase):
    def test_sendgrid_webhook_returns_counts_and_deduplicates(self):
        fake_db = _FakeDb(integrations={"userId": "u1"})
        payload = [
            {
                "event": "open",
                "send_id": "send-123",
                "timestamp": 1739900000,
                "sg_event_id": "evt-1",
            },
            {
                "event": "open",
                "send_id": "send-123",
                "timestamp": 1739900000,
                "sg_event_id": "evt-1",
            },
            {
                "event": "click",
                "send_id": "send-123",
                "timestamp": 1739900001,
                "sg_event_id": "evt-2",
            },
        ]

        with patch.object(real_integrations, "get_db", return_value=fake_db):
            result = _run(real_integrations.sendgrid_webhook(events=payload))

        self.assertEqual(result["received"], 3)
        self.assertEqual(result["processed"], 2)
        self.assertEqual(result["deduplicated"], 1)
        self.assertEqual(result["emailUpdates"], 2)
        self.assertEqual(result["eventRecords"], 2)
        self.assertEqual(result["eventTypeCounts"]["open"], 1)
        self.assertEqual(result["eventTypeCounts"]["click"], 1)
        self.assertEqual(len(fake_db.integration_event_dedup.inserted), 2)
        self.assertEqual(len(fake_db.email_sends.updated), 2)
        self.assertEqual(len(fake_db.email_events.inserted), 2)

    def test_sendgrid_webhook_uses_sg_message_id_fallback(self):
        fake_db = _FakeDb(integrations={"userId": "u1"})
        payload = [
            {
                "event": "delivered",
                "sg_message_id": "send-xyz.abc",
                "timestamp": 1739900010,
                "sg_event_id": "evt-3",
            }
        ]

        with patch.object(real_integrations, "get_db", return_value=fake_db):
            result = _run(real_integrations.sendgrid_webhook(events=payload))

        self.assertEqual(result["processed"], 1)
        self.assertEqual(fake_db.email_sends.updated[0]["filter"]["id"], "send-xyz")

    def test_get_user_integrations_masks_keys_and_reports_flags(self):
        fake_db = _FakeDb(
            integrations={
                "userId": "u1",
                "sendgrid_api_key": "SG.1234567890",
                "apollo_api_key": "apollo-secret-1234",
                "clearbit_api_key": "clearbit-secret-1234",
                "crunchbase_api_key": "crunch-secret-1234",
                "from_email": "sales@example.com",
            }
        )

        with patch.dict(
            "os.environ",
            {
                "ENABLE_APOLLO_CONNECTOR": "true",
                "ENABLE_CLEARBIT_CONNECTOR": "false",
                "ENABLE_CRUNCHBASE_CONNECTOR": "true",
                "ENABLE_CONNECTOR_ORCHESTRATION": "true",
            },
            clear=False,
        ):
            with patch.object(real_integrations, "get_db", return_value=fake_db):
                result = _run(
                    real_integrations.get_user_integrations(
                        current_user={"id": "u1", "email": "sales@example.com"}
                    )
                )

        self.assertTrue(result["sendgrid_configured"])
        self.assertTrue(result["apollo_configured"])
        self.assertTrue(result["clearbit_configured"])
        self.assertTrue(result["crunchbase_configured"])
        self.assertTrue(result["apollo_enabled"])
        self.assertFalse(result["clearbit_enabled"])
        self.assertTrue(result["crunchbase_enabled"])
        self.assertTrue(result["connector_orchestration_enabled"])
        self.assertTrue(result["sendgrid_api_key"].startswith("••••••••"))
        self.assertTrue(result["apollo_api_key"].startswith("••••••••"))

    def test_sendgrid_webhook_records_per_user_telemetry_when_context_exists(self):
        fake_db = _FakeDb(integrations={"userId": "u1"})
        payload = [
            {
                "event": "open",
                "send_id": "send-123",
                "timestamp": 1739900000,
                "sg_event_id": "evt-1",
                "user_id": "u1",
            },
            {
                "event": "click",
                "send_id": "send-124",
                "timestamp": 1739900001,
                "sg_event_id": "evt-2",
                "custom_args": {"user_id": "u1"},
            },
            {
                "event": "delivered",
                "send_id": "send-125",
                "timestamp": 1739900002,
                "sg_event_id": "evt-3",
                "unique_args": {"userId": "u2"},
            },
        ]

        telemetry_mock = AsyncMock(return_value=None)
        with patch.object(real_integrations, "get_db", return_value=fake_db):
            with patch.object(real_integrations, "_record_integration_event", telemetry_mock):
                result = _run(real_integrations.sendgrid_webhook(events=payload))

        self.assertEqual(result["userContexts"], 2)
        self.assertEqual(result["missingUserContext"], 0)
        self.assertEqual(telemetry_mock.await_count, 2)
        called_user_ids = {call.args[2] for call in telemetry_mock.await_args_list}
        self.assertEqual(called_user_ids, {"u1", "u2"})

    def test_sendgrid_webhook_skips_telemetry_persist_without_user_context(self):
        fake_db = _FakeDb(integrations={"userId": "u1"})
        payload = [
            {
                "event": "open",
                "send_id": "send-123",
                "timestamp": 1739900000,
                "sg_event_id": "evt-1",
            },
            {
                "event": "click",
                "send_id": "send-124",
                "timestamp": 1739900001,
                "sg_event_id": "evt-2",
            },
        ]

        telemetry_mock = AsyncMock(return_value=None)
        with patch.object(real_integrations, "get_db", return_value=fake_db):
            with patch.object(real_integrations, "_record_integration_event", telemetry_mock):
                result = _run(real_integrations.sendgrid_webhook(events=payload))

        self.assertEqual(result["userContexts"], 0)
        self.assertEqual(result["missingUserContext"], 2)
        telemetry_mock.assert_not_awaited()


if __name__ == "__main__":
    unittest.main()
