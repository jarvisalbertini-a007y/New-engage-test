import types
from datetime import datetime, timezone

import pytest

from routes import real_integrations


class _FakeCollection:
    def __init__(self, seed_doc=None):
        self.seed_doc = seed_doc
        self.inserted = []
        self.updated = []
        self.find_queries = []

    async def find_one(self, flt=None, *_args, **_kwargs):
        self.find_queries.append(flt or {})
        if self.seed_doc is None:
            return None
        if isinstance(self.seed_doc, dict):
            # Dedup collection lookup by id
            if flt and "id" in flt:
                for item in self.inserted:
                    if item.get("id") == flt["id"]:
                        return item
                return None
            return self.seed_doc
        return None

    async def update_one(self, flt, payload, upsert=False):
        self.updated.append({"filter": flt, "payload": payload, "upsert": upsert})
        return {"ok": 1}

    async def insert_one(self, doc):
        self.inserted.append(doc)
        return {"ok": 1}


class _FakeDb:
    def __init__(self, integrations=None):
        self.user_integrations = _FakeCollection(seed_doc=integrations or {})
        self.integration_event_dedup = _FakeCollection(seed_doc={})
        self.email_sends = _FakeCollection(seed_doc={})
        self.email_events = _FakeCollection(seed_doc={})
        self.integration_telemetry = _FakeCollection(seed_doc={})


def _run(coro):
    return real_integrations.asyncio.run(coro)


def test_get_user_integrations_masks_provider_keys(monkeypatch):
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
    monkeypatch.setattr(real_integrations, "get_db", lambda: fake_db)
    monkeypatch.setenv("ENABLE_APOLLO_CONNECTOR", "true")
    monkeypatch.setenv("ENABLE_CLEARBIT_CONNECTOR", "false")
    monkeypatch.setenv("ENABLE_CRUNCHBASE_CONNECTOR", "true")

    result = _run(real_integrations.get_user_integrations(current_user={"id": "u1", "email": "sales@example.com"}))
    assert result["sendgrid_configured"] is True
    assert result["apollo_configured"] is True
    assert result["clearbit_configured"] is True
    assert result["crunchbase_configured"] is True
    assert result["apollo_enabled"] is True
    assert result["clearbit_enabled"] is False
    assert result["crunchbase_enabled"] is True
    assert result["sendgrid_api_key"].startswith("••••••••")
    assert result["apollo_api_key"].startswith("••••••••")


def test_get_integrations_health_reports_provider_statuses(monkeypatch):
    fake_db = _FakeDb(
        integrations={
            "userId": "u1",
            "sendgrid_api_key": "SG.key",
            "sendgrid_configured_at": "2026-02-18T00:00:00+00:00",
            "sendgrid_last_rotated_at": "2026-02-19T00:00:00+00:00",
            "apollo_api_key": "apollo-key",
            "apollo_configured_at": "2026-02-20T00:00:00+00:00",
            "apollo_last_rotated_at": "2026-02-21T00:00:00+00:00",
            "clearbit_api_key": "clearbit-key",
            "clearbit_configured_at": "2026-02-19T00:00:00+00:00",
            "clearbit_last_rotated_at": "2026-02-20T00:00:00+00:00",
        }
    )
    monkeypatch.setattr(real_integrations, "get_db", lambda: fake_db)
    monkeypatch.setenv("ENABLE_APOLLO_CONNECTOR", "true")
    monkeypatch.setenv("ENABLE_CLEARBIT_CONNECTOR", "false")
    monkeypatch.setenv("ENABLE_CRUNCHBASE_CONNECTOR", "false")
    monkeypatch.setenv("CONNECTOR_CREDENTIAL_MAX_AGE_DAYS", "9999")
    monkeypatch.setenv("CONNECTOR_CREDENTIAL_ROTATION_MAX_AGE_DAYS", "9999")

    async def fake_sendgrid_health(_api_key, **_kwargs):
        return {"provider": "sendgrid", "healthy": True, "statusCode": 200, "latencyMs": 10, "error": None}

    monkeypatch.setattr(real_integrations, "_health_check_sendgrid", fake_sendgrid_health)
    result = _run(real_integrations.get_integrations_health(current_user={"id": "u1", "email": "sales@example.com"}))
    providers = {p["provider"]: p for p in result["providers"]}
    assert providers["sendgrid"]["healthy"] is True
    assert providers["sendgrid"]["configuredAt"] == "2026-02-18T00:00:00+00:00"
    assert providers["sendgrid"]["lastRotatedAt"] == "2026-02-19T00:00:00+00:00"
    assert providers["sendgrid"]["credentialStale"] is False
    assert providers["apollo"]["healthy"] is True
    assert providers["clearbit"]["healthy"] is False
    assert providers["crunchbase"]["healthy"] is False
    assert providers["apollo"]["configuredAt"] == "2026-02-20T00:00:00+00:00"
    assert providers["apollo"]["lastRotatedAt"] == "2026-02-21T00:00:00+00:00"
    assert providers["apollo"]["credentialStale"] is False
    assert providers["clearbit"]["configuredAt"] == "2026-02-19T00:00:00+00:00"
    assert providers["clearbit"]["lastRotatedAt"] == "2026-02-20T00:00:00+00:00"
    assert providers["clearbit"]["credentialStale"] is False
    assert result["status"] == "READY"
    assert result["healthyCount"] == 2
    assert result["unhealthyCount"] == 2
    assert result["actionableUnhealthyProviders"] == []
    assert result["credentialFreshnessStatusCountsSource"] == "server"
    assert result["credentialFreshnessStatusCountsMismatch"] is False
    assert result["credentialFreshnessStatusCounts"] == {
        "ACTION_REQUIRED": 0,
        "READY": 3,
        "UNKNOWN": 1,
    }
    assert result["credentialFreshnessStatusCountsServer"] == {
        "ACTION_REQUIRED": 0,
        "READY": 3,
        "UNKNOWN": 1,
    }
    assert result["credentialFreshnessStatusCountsFallback"] == {
        "ACTION_REQUIRED": 0,
        "READY": 3,
        "UNKNOWN": 1,
    }
    assert "npm run verify:backend:sales:integrations" in result["recommendedCommands"]


def test_get_integrations_health_reports_action_required_when_sendgrid_is_unhealthy(monkeypatch):
    fake_db = _FakeDb(
        integrations={
            "userId": "u1",
            "sendgrid_api_key": "SG.key",
        }
    )
    monkeypatch.setattr(real_integrations, "get_db", lambda: fake_db)
    monkeypatch.setenv("ENABLE_APOLLO_CONNECTOR", "false")
    monkeypatch.setenv("ENABLE_CLEARBIT_CONNECTOR", "false")
    monkeypatch.setenv("ENABLE_CRUNCHBASE_CONNECTOR", "false")
    monkeypatch.setenv("CONNECTOR_CREDENTIAL_MAX_AGE_DAYS", "9999")
    monkeypatch.setenv("CONNECTOR_CREDENTIAL_ROTATION_MAX_AGE_DAYS", "9999")

    async def fake_sendgrid_health(_api_key, **_kwargs):
        return {"provider": "sendgrid", "healthy": False, "statusCode": 503, "latencyMs": 20, "error": "timeout"}

    monkeypatch.setattr(real_integrations, "_health_check_sendgrid", fake_sendgrid_health)
    result = _run(real_integrations.get_integrations_health(current_user={"id": "u1", "email": "sales@example.com"}))
    assert result["status"] == "ACTION_REQUIRED"
    assert "sendgrid" in result["actionableUnhealthyProviders"]
    assert "npm run verify:ci:sales" in result["recommendedCommands"]


def test_get_integrations_health_flags_stale_connector_credentials_as_action_required(monkeypatch):
    fake_db = _FakeDb(
        integrations={
            "userId": "u1",
            "sendgrid_api_key": "SG.key",
            "apollo_api_key": "apollo-key",
            "apollo_configured_at": "2020-01-01T00:00:00+00:00",
            "apollo_last_rotated_at": "2020-01-02T00:00:00+00:00",
        }
    )
    monkeypatch.setattr(real_integrations, "get_db", lambda: fake_db)
    monkeypatch.setenv("ENABLE_APOLLO_CONNECTOR", "true")
    monkeypatch.setenv("ENABLE_CLEARBIT_CONNECTOR", "false")
    monkeypatch.setenv("ENABLE_CRUNCHBASE_CONNECTOR", "false")
    monkeypatch.setenv("CONNECTOR_CREDENTIAL_MAX_AGE_DAYS", "2")
    monkeypatch.setenv("CONNECTOR_CREDENTIAL_ROTATION_MAX_AGE_DAYS", "2")

    async def fake_sendgrid_health(_api_key, **_kwargs):
        return {"provider": "sendgrid", "healthy": True, "statusCode": 200, "latencyMs": 10, "error": None}

    monkeypatch.setattr(real_integrations, "_health_check_sendgrid", fake_sendgrid_health)
    result = _run(real_integrations.get_integrations_health(current_user={"id": "u1", "email": "sales@example.com"}))
    providers = {p["provider"]: p for p in result["providers"]}
    assert result["status"] == "ACTION_REQUIRED"
    assert result["credentialActionRequiredProviders"] == ["apollo"]
    assert result["credentialFreshnessStatusCountsSource"] == "server"
    assert result["credentialFreshnessStatusCountsMismatch"] is False
    assert result["credentialFreshnessStatusCounts"] == {
        "ACTION_REQUIRED": 1,
        "READY": 0,
        "UNKNOWN": 3,
    }
    assert result["credentialFreshnessStatusCountsServer"] == {
        "ACTION_REQUIRED": 1,
        "READY": 0,
        "UNKNOWN": 3,
    }
    assert result["credentialFreshnessStatusCountsFallback"] == {
        "ACTION_REQUIRED": 1,
        "READY": 0,
        "UNKNOWN": 3,
    }
    assert providers["apollo"]["healthy"] is True
    assert providers["apollo"]["credentialStale"] is True
    assert "rotation_age_exceeded" in providers["apollo"]["credentialStaleReasons"]
    assert "configured_age_exceeded" in providers["apollo"]["credentialStaleReasons"]
    assert "npm run verify:docs:sales:connectors" in result["recommendedCommands"]


def test_get_integrations_health_persists_sendgrid_health_retry_attempts(monkeypatch):
    fake_db = _FakeDb(
        integrations={
            "userId": "u1",
            "sendgrid_api_key": "SG.key",
        }
    )
    monkeypatch.setattr(real_integrations, "get_db", lambda: fake_db)
    monkeypatch.setenv("ENABLE_APOLLO_CONNECTOR", "false")
    monkeypatch.setenv("ENABLE_CLEARBIT_CONNECTOR", "false")
    monkeypatch.setenv("ENABLE_CRUNCHBASE_CONNECTOR", "false")
    monkeypatch.setenv("CONNECTOR_CREDENTIAL_MAX_AGE_DAYS", "9999")
    monkeypatch.setenv("CONNECTOR_CREDENTIAL_ROTATION_MAX_AGE_DAYS", "9999")

    async def fake_retry_with_backoff(operation, **kwargs):
        retry_callback = kwargs.get("on_retry_attempt")
        assert retry_callback is not None
        await retry_callback(
            {
                "operation": "sendgrid_health_check",
                "provider": "sendgrid",
                "attempt": 1,
                "max_attempts": 3,
                "next_delay_seconds": 0.2,
                "error": "timeout",
            }
        )
        return types.SimpleNamespace(status_code=200)

    monkeypatch.setattr(real_integrations, "_retry_with_backoff", fake_retry_with_backoff)

    class _Request:
        headers = {"x-request-id": "req-health-retry-1"}

    result = _run(
        real_integrations.get_integrations_health(
            http_request=_Request(),
            current_user={"id": "u1", "email": "sales@example.com"},
        )
    )

    assert result["status"] == "READY"
    assert len(fake_db.integration_telemetry.inserted) == 1
    saved = fake_db.integration_telemetry.inserted[0]
    assert saved["eventType"] == "integrations_retry_attempt"
    assert saved["payload"]["operation"] == "sendgrid_health_check"
    assert saved["payload"]["request_id"] == "req-health-retry-1"


def test_get_integrations_health_persists_sendgrid_health_retry_terminal_events(monkeypatch):
    fake_db = _FakeDb(
        integrations={
            "userId": "u1",
            "sendgrid_api_key": "SG.key",
        }
    )
    monkeypatch.setattr(real_integrations, "get_db", lambda: fake_db)
    monkeypatch.setenv("ENABLE_APOLLO_CONNECTOR", "false")
    monkeypatch.setenv("ENABLE_CLEARBIT_CONNECTOR", "false")
    monkeypatch.setenv("ENABLE_CRUNCHBASE_CONNECTOR", "false")
    monkeypatch.setenv("CONNECTOR_CREDENTIAL_MAX_AGE_DAYS", "9999")
    monkeypatch.setenv("CONNECTOR_CREDENTIAL_ROTATION_MAX_AGE_DAYS", "9999")

    async def fake_retry_with_backoff(operation, **kwargs):
        terminal_callback = kwargs.get("on_retry_terminal_event")
        assert terminal_callback is not None
        await terminal_callback(
            "integrations_retry_fail_fast",
            {
                "operation": "sendgrid_health_check",
                "provider": "sendgrid",
                "attempt": 1,
                "max_attempts": 3,
                "error": "invalid api key",
                "retryable": False,
                "final_outcome": "fail_fast",
                "error_reason_code": "non_retryable_error",
                "error_type": "Exception",
            },
        )
        raise Exception("invalid api key")

    monkeypatch.setattr(real_integrations, "_retry_with_backoff", fake_retry_with_backoff)

    class _Request:
        headers = {"x-request-id": "req-health-retry-terminal-1"}

    result = _run(
        real_integrations.get_integrations_health(
            http_request=_Request(),
            current_user={"id": "u1", "email": "sales@example.com"},
        )
    )

    assert result["status"] == "ACTION_REQUIRED"
    assert len(fake_db.integration_telemetry.inserted) == 1
    saved = fake_db.integration_telemetry.inserted[0]
    assert saved["eventType"] == "integrations_retry_fail_fast"
    assert saved["payload"]["operation"] == "sendgrid_health_check"
    assert saved["payload"]["final_outcome"] == "fail_fast"
    assert saved["payload"]["request_id"] == "req-health-retry-terminal-1"


def test_sendgrid_webhook_deduplicates_duplicate_events(monkeypatch):
    fake_db = _FakeDb(integrations={"userId": "u1"})
    monkeypatch.setattr(real_integrations, "get_db", lambda: fake_db)

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
    ]
    result = _run(real_integrations.sendgrid_webhook(events=payload))
    assert result["received"] == 2
    assert result["deduplicatedEventTypeCounts"]["open"] == 1
    # only one update and one event insert should occur due dedup
    assert len(fake_db.email_sends.updated) == 1
    assert len(fake_db.email_events.inserted) == 1
    assert len(fake_db.integration_event_dedup.inserted) == 1


def test_sendgrid_webhook_click_increments_click_count(monkeypatch):
    fake_db = _FakeDb(integrations={"userId": "u1"})
    monkeypatch.setattr(real_integrations, "get_db", lambda: fake_db)
    payload = [
        {
            "event": "click",
            "send_id": "send-456",
            "timestamp": 1739900001,
            "sg_event_id": "evt-2",
        }
    ]
    _run(real_integrations.sendgrid_webhook(events=payload))
    assert len(fake_db.email_sends.updated) == 1
    update_payload = fake_db.email_sends.updated[0]["payload"]
    assert "$inc" in update_payload
    assert update_payload["$inc"].get("clickCount") == 1


def test_sendgrid_webhook_uses_event_timestamp_when_present(monkeypatch):
    fake_db = _FakeDb(integrations={"userId": "u1"})
    monkeypatch.setattr(real_integrations, "get_db", lambda: fake_db)
    payload = [
        {
            "event": "open",
            "send_id": "send-789",
            "timestamp": 1739900000,
            "sg_event_id": "evt-ts-1",
        }
    ]

    result = _run(real_integrations.sendgrid_webhook(events=payload))
    assert result["processed"] == 1
    assert result["invalidTimestampCount"] == 0
    assert len(fake_db.email_events.inserted) == 1
    expected_timestamp = datetime.fromtimestamp(1739900000, tz=timezone.utc).isoformat()
    assert fake_db.email_events.inserted[0]["timestamp"] == expected_timestamp


def test_sendgrid_webhook_reports_unknown_event_type_and_invalid_timestamp(monkeypatch):
    fake_db = _FakeDb(integrations={"userId": "u1"})
    monkeypatch.setattr(real_integrations, "get_db", lambda: fake_db)
    payload = [
        {
            "event": "   ",
            "send_id": "send-unknown",
            "timestamp": "not-a-timestamp",
            "sg_event_id": "evt-unknown-1",
        }
    ]

    result = _run(real_integrations.sendgrid_webhook(events=payload))
    assert result["processed"] == 1
    assert result["eventTypeCounts"]["unknown"] == 1
    assert result["unknownEventTypeCount"] == 1
    assert result["invalidTimestampCount"] == 1
    assert result["emailUpdates"] == 0
    assert result["eventRecords"] == 0


def test_sendgrid_webhook_tracks_timestamp_posture_counters(monkeypatch):
    fake_db = _FakeDb(integrations={"userId": "u1"})
    monkeypatch.setattr(real_integrations, "get_db", lambda: fake_db)
    now_ts = int(datetime.now(timezone.utc).timestamp())
    payload = [
        {
            "event": "open",
            "send_id": "send-stale",
            "timestamp": now_ts - (2 * 86400),
            "sg_event_id": "evt-stale-1",
        },
        {
            "event": "processed",
            "send_id": "send-future",
            "timestamp": now_ts + 900,
            "sg_event_id": "evt-future-1",
        },
        {
            "event": "click",
            "send_id": "send-fallback",
            "timestamp": "bad-ts",
            "sg_event_id": "evt-fallback-1",
        },
    ]

    result = _run(real_integrations.sendgrid_webhook(events=payload))
    assert result["processed"] == 3
    assert result["staleEventCount"] == 1
    assert result["futureSkewEventCount"] == 1
    assert result["timestampFallbackCount"] == 1
    assert result["invalidTimestampCount"] == 1
    assert result["staleEventTypeCounts"]["open"] == 1
    assert result["futureSkewEventTypeCounts"]["processed"] == 1
    assert result["timestampAgeBucketCounts"]["stale"] == 1
    assert result["timestampAgeBucketCounts"]["future_skew"] == 1
    assert result["timestampAgeBucketCounts"]["fallback"] == 1
    assert result["timestampPressureLabel"] == "High"
    assert result["timestampAnomalyCount"] == 3
    assert result["timestampAnomalyRatePct"] == 100.0
    assert result["timestampAnomalyEventTypeCounts"]["open"] == 1
    assert result["timestampAnomalyEventTypeCounts"]["processed"] == 1
    assert result["timestampAnomalyEventTypeCounts"]["click"] == 1
    assert result["timestampDominantAnomalyBucket"] == "fallback"
    assert result["timestampDominantAnomalyBucketCount"] == 1
    assert result["timestampDominantAnomalyEventType"] == "click"
    assert result["timestampDominantAnomalyEventTypeCount"] == 1


def test_sendgrid_webhook_tracks_missing_send_id_for_update(monkeypatch):
    fake_db = _FakeDb(integrations={"userId": "u1"})
    monkeypatch.setattr(real_integrations, "get_db", lambda: fake_db)
    payload = [
        {
            "event": "open",
            "email": "missing-send-id@example.com",
        }
    ]
    result = _run(real_integrations.sendgrid_webhook(events=payload))
    assert result["processed"] == 1
    assert result["missingSendIdForUpdate"] == 1
    assert result["missingSendIdByEventType"]["open"] == 1
    assert result["updateEligibleEventTypeCounts"]["open"] == 1
    assert result["emailUpdates"] == 0


def test_sendgrid_webhook_tracks_unsupported_event_type_rollups(monkeypatch):
    fake_db = _FakeDb(integrations={"userId": "u1"})
    monkeypatch.setattr(real_integrations, "get_db", lambda: fake_db)
    payload = [
        {
            "event": "deferred",
            "send_id": "send-901",
            "timestamp": 1739900000,
            "sg_event_id": "evt-u-1",
        },
        {
            "event": "processed",
            "send_id": "send-902",
            "timestamp": 1739900001,
            "sg_event_id": "evt-u-2",
        },
    ]
    result = _run(real_integrations.sendgrid_webhook(events=payload))
    assert result["processed"] == 2
    assert result["unsupportedEventTypeCount"] == 2
    assert result["unsupportedEventTypeCounts"]["deferred"] == 1
    assert result["unsupportedEventTypeCounts"]["processed"] == 1
    assert result["updateEligibleEventCount"] == 0
    assert result["emailUpdates"] == 0
    assert result["eventRecords"] == 0


def test_remove_provider_integrations_issue_unset(monkeypatch):
    fake_db = _FakeDb(integrations={"userId": "u1"})
    monkeypatch.setattr(real_integrations, "get_db", lambda: fake_db)

    _run(real_integrations.remove_apollo_integration(current_user={"id": "u1", "email": "sales@example.com"}))
    _run(real_integrations.remove_clearbit_integration(current_user={"id": "u1", "email": "sales@example.com"}))
    _run(real_integrations.remove_crunchbase_integration(current_user={"id": "u1", "email": "sales@example.com"}))

    assert len(fake_db.user_integrations.updated) == 3
    assert all("$unset" in call["payload"] for call in fake_db.user_integrations.updated)
    assert "apollo_configured_at" in fake_db.user_integrations.updated[0]["payload"]["$unset"]
    assert "clearbit_configured_at" in fake_db.user_integrations.updated[1]["payload"]["$unset"]
    assert "crunchbase_configured_at" in fake_db.user_integrations.updated[2]["payload"]["$unset"]
