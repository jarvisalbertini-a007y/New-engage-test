import sys
import types
import unittest
from datetime import datetime, timezone, timedelta
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

    class _Request:
        headers = {}

    class _Response:
        headers = {}

    fastapi_stub.APIRouter = _APIRouter
    fastapi_stub.HTTPException = _HTTPException
    fastapi_stub.Depends = _depends
    fastapi_stub.BackgroundTasks = _BackgroundTasks
    fastapi_stub.Request = _Request
    fastapi_stub.Response = _Response
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
        self.integration_telemetry = _Collection(seed_doc={})


def _run(coro):
    return real_integrations.asyncio.run(coro)


class IntegrationsReliabilityTests(unittest.TestCase):
    def test_parse_request_bounded_int_uses_default_and_accepts_valid_values(self):
        self.assertEqual(
            real_integrations._parse_request_bounded_int(
                request={},
                field_name="limit",
                default=10,
                minimum=1,
                maximum=25,
            ),
            10,
        )
        self.assertEqual(
            real_integrations._parse_request_bounded_int(
                request={"limit": "7"},
                field_name="limit",
                default=10,
                minimum=1,
                maximum=25,
            ),
            7,
        )

    def test_parse_request_bounded_int_rejects_non_numeric_and_out_of_bounds(self):
        with self.assertRaises(real_integrations.HTTPException) as non_numeric_exc:
            real_integrations._parse_request_bounded_int(
                request={"limit": "abc"},
                field_name="limit",
                default=10,
                minimum=1,
                maximum=25,
            )
        self.assertEqual(non_numeric_exc.exception.status_code, 400)
        self.assertEqual(non_numeric_exc.exception.detail["errorCode"], "invalid_request_bounds")
        self.assertEqual(
            non_numeric_exc.exception.detail["message"],
            "Invalid limit: expected integer between 1 and 25",
        )
        self.assertEqual(non_numeric_exc.exception.detail["field"], "limit")
        self.assertEqual(non_numeric_exc.exception.detail["reason"], "type")
        self.assertEqual(non_numeric_exc.exception.detail["received"], "abc")

        with self.assertRaises(real_integrations.HTTPException) as out_of_bounds_exc:
            real_integrations._parse_request_bounded_int(
                request={"limit": 0},
                field_name="limit",
                default=10,
                minimum=1,
                maximum=25,
            )
        self.assertEqual(out_of_bounds_exc.exception.status_code, 400)
        self.assertEqual(out_of_bounds_exc.exception.detail["errorCode"], "invalid_request_bounds")
        self.assertEqual(
            out_of_bounds_exc.exception.detail["message"],
            "Invalid limit: expected integer between 1 and 25",
        )
        self.assertEqual(out_of_bounds_exc.exception.detail["field"], "limit")
        self.assertEqual(out_of_bounds_exc.exception.detail["reason"], "range")
        self.assertEqual(out_of_bounds_exc.exception.detail["received"], 0)

    def test_parse_request_bounded_int_rejects_bool_values(self):
        with self.assertRaises(real_integrations.HTTPException) as bool_exc:
            real_integrations._parse_request_bounded_int(
                request={"limit": True},
                field_name="limit",
                default=10,
                minimum=1,
                maximum=25,
            )
        self.assertEqual(bool_exc.exception.status_code, 400)
        self.assertEqual(bool_exc.exception.detail["errorCode"], "invalid_request_bounds")
        self.assertEqual(bool_exc.exception.detail["reason"], "type")
        self.assertEqual(bool_exc.exception.detail["received"], True)

    def test_normalize_sendgrid_event_timestamp_supports_seconds_milliseconds_and_iso(self):
        expected = datetime.fromtimestamp(1739900000, tz=timezone.utc).isoformat()
        self.assertEqual(
            real_integrations._normalize_sendgrid_event_timestamp(1739900000),
            expected,
        )
        self.assertEqual(
            real_integrations._normalize_sendgrid_event_timestamp(1739900000000),
            expected,
        )
        self.assertEqual(
            real_integrations._normalize_sendgrid_event_timestamp("1739900000"),
            expected,
        )
        self.assertEqual(
            real_integrations._normalize_sendgrid_event_timestamp(expected),
            expected,
        )
        self.assertIsNone(
            real_integrations._normalize_sendgrid_event_timestamp("not-a-timestamp")
        )

    def test_classify_sendgrid_event_timestamp_posture(self):
        now = datetime(2026, 3, 2, 12, 0, 0, tzinfo=timezone.utc)
        self.assertEqual(
            real_integrations._classify_sendgrid_event_timestamp_posture(
                (now - timedelta(minutes=20)).isoformat(),
                now=now,
            ),
            "fresh_lt_1h",
        )
        self.assertEqual(
            real_integrations._classify_sendgrid_event_timestamp_posture(
                (now - timedelta(hours=3)).isoformat(),
                now=now,
            ),
            "fresh_1h_to_24h",
        )
        self.assertEqual(
            real_integrations._classify_sendgrid_event_timestamp_posture(
                (now - timedelta(days=2)).isoformat(),
                now=now,
            ),
            "stale",
        )
        self.assertEqual(
            real_integrations._classify_sendgrid_event_timestamp_posture(
                (now + timedelta(minutes=15)).isoformat(),
                now=now,
            ),
            "future_skew",
        )
        self.assertEqual(
            real_integrations._classify_sendgrid_event_timestamp_posture(
                None,
                now=now,
            ),
            "fallback",
        )

    def test_resolve_sendgrid_timestamp_pressure_classification(self):
        high_pressure = real_integrations._resolve_sendgrid_timestamp_pressure(
            received_count=10,
            future_skew_event_count=2,
            stale_event_count=1,
            timestamp_fallback_count=1,
        )
        self.assertEqual(high_pressure["label"], "High")
        self.assertEqual(high_pressure["anomalyCount"], 4)
        self.assertEqual(high_pressure["anomalyRatePct"], 40.0)

        moderate_pressure = real_integrations._resolve_sendgrid_timestamp_pressure(
            received_count=100,
            future_skew_event_count=2,
            stale_event_count=1,
            timestamp_fallback_count=0,
        )
        self.assertEqual(moderate_pressure["label"], "Moderate")
        self.assertEqual(moderate_pressure["anomalyCount"], 3)
        self.assertEqual(moderate_pressure["anomalyRatePct"], 3.0)

        low_pressure = real_integrations._resolve_sendgrid_timestamp_pressure(
            received_count=100,
            future_skew_event_count=1,
            stale_event_count=0,
            timestamp_fallback_count=0,
        )
        self.assertEqual(low_pressure["label"], "Low")

        unknown_pressure = real_integrations._resolve_sendgrid_timestamp_pressure(
            received_count=25,
            future_skew_event_count=0,
            stale_event_count=0,
            timestamp_fallback_count=0,
        )
        self.assertEqual(unknown_pressure["label"], "Unknown")

    def test_build_sendgrid_dedup_key_normalizes_event_type_and_timestamp(self):
        event_a = {
            "timestamp": "1739900000",
            "sg_event_id": "evt-1",
            "recipient": "prospect@example.com",
        }
        event_b = {
            "timestamp": 1739900000000,
            "sg_event_id": "evt-1",
            "recipient": "prospect@example.com",
        }
        key_a = real_integrations._build_sendgrid_dedup_key(
            event_a,
            " Open ",
            " send-123 ",
        )
        key_b = real_integrations._build_sendgrid_dedup_key(
            event_b,
            "open",
            "send-123",
        )
        self.assertEqual(key_a, key_b)

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
        self.assertEqual(result["updateEligibleEventCount"], 2)
        self.assertEqual(result["unsupportedEventTypeCount"], 0)
        self.assertEqual(result["updateEligibleEventTypeCounts"]["open"], 1)
        self.assertEqual(result["updateEligibleEventTypeCounts"]["click"], 1)
        self.assertEqual(result["emailUpdateEventTypeCounts"]["open"], 1)
        self.assertEqual(result["emailUpdateEventTypeCounts"]["click"], 1)
        self.assertEqual(result["deduplicatedEventTypeCounts"]["open"], 1)
        self.assertEqual(len(fake_db.integration_event_dedup.inserted), 2)
        self.assertEqual(len(fake_db.email_sends.updated), 2)
        self.assertEqual(len(fake_db.email_events.inserted), 2)

    def test_sendgrid_webhook_tracks_unknown_event_type_and_invalid_timestamps(self):
        fake_db = _FakeDb(integrations={"userId": "u1"})
        payload = [
            {
                "event": "open",
                "send_id": "send-123",
                "timestamp": "invalid",
                "sg_event_id": "evt-1",
            },
            {
                "event": "   ",
                "send_id": "send-456",
                "timestamp": 1739900000,
                "sg_event_id": "evt-2",
            },
        ]

        with patch.object(real_integrations, "get_db", return_value=fake_db):
            result = _run(real_integrations.sendgrid_webhook(events=payload))

        self.assertEqual(result["processed"], 2)
        self.assertEqual(result["unknownEventTypeCount"], 1)
        self.assertEqual(result["invalidTimestampCount"], 1)
        self.assertEqual(result["eventTypeCounts"]["open"], 1)
        self.assertEqual(result["eventTypeCounts"]["unknown"], 1)
        self.assertEqual(result["emailUpdates"], 1)
        self.assertEqual(result["eventRecords"], 1)

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

    def test_sendgrid_webhook_without_send_id_tracks_skipped_update_count(self):
        fake_db = _FakeDb(integrations={"userId": "u1"})
        payload = [
            {
                "event": "open",
                "email": "a@example.com",
            },
            {
                "event": "open",
                "email": "b@example.com",
            },
        ]

        with patch.object(real_integrations, "get_db", return_value=fake_db):
            result = _run(real_integrations.sendgrid_webhook(events=payload))

        self.assertEqual(result["processed"], 2)
        self.assertEqual(result["deduplicated"], 0)
        self.assertEqual(result["missingSendIdForUpdate"], 2)
        self.assertEqual(result["missingSendIdByEventType"]["open"], 2)
        self.assertEqual(result["updateEligibleEventCount"], 2)
        self.assertEqual(result["unsupportedEventTypeCount"], 0)
        self.assertEqual(result["emailUpdates"], 0)
        self.assertEqual(result["eventRecords"], 0)

    def test_sendgrid_webhook_tracks_unsupported_event_type_counts(self):
        fake_db = _FakeDb(integrations={"userId": "u1"})
        payload = [
            {
                "event": "processed",
                "send_id": "send-777",
                "timestamp": 1739900000,
                "sg_event_id": "evt-p-1",
            },
            {
                "event": "processed",
                "send_id": "send-778",
                "timestamp": 1739900001,
                "sg_event_id": "evt-p-2",
            },
            {
                "event": "open",
                "send_id": "send-779",
                "timestamp": 1739900002,
                "sg_event_id": "evt-p-3",
            },
        ]

        with patch.object(real_integrations, "get_db", return_value=fake_db):
            result = _run(real_integrations.sendgrid_webhook(events=payload))

        self.assertEqual(result["processed"], 3)
        self.assertEqual(result["updateEligibleEventCount"], 1)
        self.assertEqual(result["unsupportedEventTypeCount"], 2)
        self.assertEqual(result["unsupportedEventTypeCounts"]["processed"], 2)
        self.assertEqual(result["updateEligibleEventTypeCounts"]["open"], 1)
        self.assertEqual(result["emailUpdateEventTypeCounts"]["open"], 1)

    def test_sendgrid_webhook_tracks_timestamp_posture_rollups(self):
        fake_db = _FakeDb(integrations={"userId": "u1"})
        now_ts = int(datetime.now(timezone.utc).timestamp())
        payload = [
            {
                "event": "open",
                "send_id": "send-stale",
                "timestamp": now_ts - (3 * 86400),
                "sg_event_id": "evt-stale",
            },
            {
                "event": "processed",
                "send_id": "send-future",
                "timestamp": now_ts + 1200,
                "sg_event_id": "evt-future",
            },
            {
                "event": "delivered",
                "send_id": "send-fresh",
                "timestamp": now_ts - 300,
                "sg_event_id": "evt-fresh",
            },
            {
                "event": "click",
                "send_id": "send-fallback",
                "timestamp": "invalid",
                "sg_event_id": "evt-fallback",
            },
        ]

        with patch.object(real_integrations, "get_db", return_value=fake_db):
            result = _run(real_integrations.sendgrid_webhook(events=payload))

        self.assertEqual(result["processed"], 4)
        self.assertEqual(result["staleEventCount"], 1)
        self.assertEqual(result["futureSkewEventCount"], 1)
        self.assertEqual(result["freshEventCount"], 1)
        self.assertEqual(result["timestampFallbackCount"], 1)
        self.assertEqual(result["staleEventTypeCounts"]["open"], 1)
        self.assertEqual(result["futureSkewEventTypeCounts"]["processed"], 1)
        self.assertEqual(result["timestampAgeBucketCounts"]["stale"], 1)
        self.assertEqual(result["timestampAgeBucketCounts"]["future_skew"], 1)
        self.assertEqual(result["timestampAgeBucketCounts"]["fallback"], 1)
        self.assertEqual(result["timestampAgeBucketCounts"]["fresh_lt_1h"], 1)
        self.assertEqual(result["timestampPressureLabel"], "High")
        self.assertEqual(result["timestampAnomalyCount"], 3)
        self.assertEqual(result["timestampAnomalyRatePct"], 75.0)
        self.assertEqual(result["timestampAnomalyEventTypeCounts"]["open"], 1)
        self.assertEqual(result["timestampAnomalyEventTypeCounts"]["processed"], 1)
        self.assertEqual(result["timestampAnomalyEventTypeCounts"]["click"], 1)
        self.assertEqual(result["timestampDominantAnomalyBucket"], "fallback")
        self.assertEqual(result["timestampDominantAnomalyBucketCount"], 1)
        self.assertEqual(result["timestampDominantAnomalyEventType"], "click")
        self.assertEqual(result["timestampDominantAnomalyEventTypeCount"], 1)

    def test_get_user_integrations_masks_keys_and_reports_flags(self):
        fake_db = _FakeDb(
            integrations={
                "userId": "u1",
                "sendgrid_api_key": "SG.1234567890",
                "apollo_api_key": "apollo-secret-1234",
                "apollo_configured_at": "2026-02-20T00:00:00+00:00",
                "apollo_last_rotated_at": "2026-02-21T00:00:00+00:00",
                "clearbit_api_key": "clearbit-secret-1234",
                "clearbit_configured_at": "2026-02-19T00:00:00+00:00",
                "clearbit_last_rotated_at": "2026-02-20T00:00:00+00:00",
                "crunchbase_api_key": "crunch-secret-1234",
                "crunchbase_configured_at": "2026-02-18T00:00:00+00:00",
                "crunchbase_last_rotated_at": "2026-02-19T00:00:00+00:00",
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
        self.assertEqual(result["apollo_configured_at"], "2026-02-20T00:00:00+00:00")
        self.assertEqual(result["apollo_last_rotated_at"], "2026-02-21T00:00:00+00:00")
        self.assertEqual(result["clearbit_configured_at"], "2026-02-19T00:00:00+00:00")
        self.assertEqual(result["clearbit_last_rotated_at"], "2026-02-20T00:00:00+00:00")
        self.assertEqual(result["crunchbase_configured_at"], "2026-02-18T00:00:00+00:00")
        self.assertEqual(result["crunchbase_last_rotated_at"], "2026-02-19T00:00:00+00:00")

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
