from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.testclient import TestClient

from routes import real_integrations


class _FakeCollection:
    def __init__(self, seed_doc=None):
        self.seed_doc = seed_doc
        self.inserted = []

    async def find_one(self, *_args, **_kwargs):
        if isinstance(self.seed_doc, dict):
            return self.seed_doc
        return None

    async def insert_one(self, doc):
        self.inserted.append(doc)
        return {"ok": 1}

    async def update_one(self, *_args, **_kwargs):
        return {"ok": 1}


class _FakeDb:
    def __init__(self, integration_doc):
        self.user_integrations = _FakeCollection(seed_doc=integration_doc)
        self.integration_telemetry = _FakeCollection(seed_doc={})
        self.integration_event_dedup = _FakeCollection(seed_doc={})
        self.email_sends = _FakeCollection(seed_doc={})
        self.email_events = _FakeCollection(seed_doc={})
        self.prospects = _FakeCollection(seed_doc={})
        self.company_research = _FakeCollection(seed_doc={})


def _build_client(monkeypatch, fake_db):
    app = FastAPI()
    app.include_router(real_integrations.router, prefix="/api/integrations")
    app.dependency_overrides[real_integrations.get_current_user] = (
        lambda: {"id": "u1", "email": "sales@example.com"}
    )
    monkeypatch.setattr(real_integrations, "get_db", lambda: fake_db)
    return TestClient(app)


def test_health_smoke_credential_freshness_action_required_transition(monkeypatch):
    integration_doc = {
        "userId": "u1",
        "sendgrid_api_key": "token",
        "apollo_api_key": "token",
        "apollo_configured_at": "2020-01-01T00:00:00+00:00",
        "apollo_last_rotated_at": "2020-01-02T00:00:00+00:00",
    }
    fake_db = _FakeDb(integration_doc=integration_doc)
    client = _build_client(monkeypatch, fake_db)

    monkeypatch.setenv("ENABLE_APOLLO_CONNECTOR", "true")
    monkeypatch.setenv("ENABLE_CLEARBIT_CONNECTOR", "false")
    monkeypatch.setenv("ENABLE_CRUNCHBASE_CONNECTOR", "false")
    monkeypatch.setenv("CONNECTOR_CREDENTIAL_MAX_AGE_DAYS", "2")
    monkeypatch.setenv("CONNECTOR_CREDENTIAL_ROTATION_MAX_AGE_DAYS", "2")

    async def fake_sendgrid_health(_api_key, **_kwargs):
        return {
            "provider": "sendgrid",
            "healthy": True,
            "statusCode": 200,
            "latencyMs": 12,
            "error": None,
        }

    monkeypatch.setattr(real_integrations, "_health_check_sendgrid", fake_sendgrid_health)

    stale_response = client.get(
        "/api/integrations/integrations/health",
        headers={"X-Request-Id": "req-credential-freshness-stale"},
    )
    assert stale_response.status_code == 200
    stale_payload = stale_response.json()
    assert stale_payload["status"] == "ACTION_REQUIRED"
    assert stale_payload["credentialActionRequiredProviders"] == ["apollo"]
    assert stale_payload["credentialFreshnessTotalProviders"] == 4
    assert stale_payload["credentialFreshnessActionRequiredCount"] == 1
    assert stale_payload["credentialFreshnessWithinPolicyCount"] == 0
    assert stale_payload["credentialFreshnessUnknownCount"] == 3
    assert stale_payload["credentialFreshnessStatusCounts"] == {
        "ACTION_REQUIRED": 1,
        "READY": 0,
        "UNKNOWN": 3,
    }
    assert stale_payload["credentialFreshnessByProvider"]["apollo"]["status"] == "ACTION_REQUIRED"
    assert stale_payload["credentialFreshnessByProvider"]["sendgrid"]["status"] == "UNKNOWN"
    stale_provider = {
        row["provider"]: row for row in stale_payload["providers"]
    }["apollo"]
    assert stale_provider["credentialStale"] is True
    assert "rotation_age_exceeded" in stale_provider["credentialStaleReasons"]
    assert "configured_age_exceeded" in stale_provider["credentialStaleReasons"]

    refreshed_at = datetime.now(timezone.utc).isoformat()
    integration_doc["apollo_configured_at"] = refreshed_at
    integration_doc["apollo_last_rotated_at"] = refreshed_at

    ready_response = client.get(
        "/api/integrations/integrations/health",
        headers={"X-Request-Id": "req-credential-freshness-ready"},
    )
    assert ready_response.status_code == 200
    ready_payload = ready_response.json()
    assert ready_payload["status"] == "READY"
    assert ready_payload["credentialActionRequiredProviders"] == []
    assert ready_payload["credentialFreshnessTotalProviders"] == 4
    assert ready_payload["credentialFreshnessActionRequiredCount"] == 0
    assert ready_payload["credentialFreshnessWithinPolicyCount"] == 1
    assert ready_payload["credentialFreshnessUnknownCount"] == 3
    assert ready_payload["credentialFreshnessStatusCounts"] == {
        "ACTION_REQUIRED": 0,
        "READY": 1,
        "UNKNOWN": 3,
    }
    assert ready_payload["credentialFreshnessByProvider"]["apollo"]["status"] == "READY"
    assert ready_payload["credentialFreshnessByProvider"]["sendgrid"]["status"] == "UNKNOWN"
    ready_provider = {
        row["provider"]: row for row in ready_payload["providers"]
    }["apollo"]
    assert ready_provider["credentialStale"] is False
    assert ready_provider["credentialStaleReasons"] == []
