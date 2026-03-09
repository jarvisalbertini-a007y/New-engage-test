import json
from datetime import datetime, timezone, timedelta
from pathlib import Path
import tempfile

from fastapi import FastAPI
from fastapi.testclient import TestClient

from routes import real_integrations


FIXTURES_DIR = Path(__file__).parent / "fixtures" / "providers"


def _load_fixture(name: str):
    return json.loads((FIXTURES_DIR / name).read_text(encoding="utf-8"))


class _FakeCollection:
    def __init__(self, seed_doc=None):
        self.seed_doc = seed_doc
        self.inserted = []
        self.updated = []

    async def find_one(self, flt=None, *_args, **_kwargs):
        if isinstance(self.seed_doc, dict):
            return self.seed_doc
        return None

    async def update_one(self, flt, payload, upsert=False):
        self.updated.append({"filter": flt, "payload": payload, "upsert": upsert})
        return {"ok": 1}

    async def insert_one(self, doc):
        self.inserted.append(doc)
        return {"ok": 1}

    def find(self, flt, *_args, **_kwargs):
        docs = []
        if isinstance(self.seed_doc, list):
            docs = self.seed_doc
        user_id = flt.get("userId")
        created_at_filter = (flt.get("createdAt") or {}).get("$gte", "")
        filtered = [
            d
            for d in docs
            if d.get("userId") == user_id and d.get("createdAt", "") >= created_at_filter
        ]
        return _FakeCursor(filtered)


class _FakeCursor:
    def __init__(self, docs):
        self.docs = list(docs)
        self._limit = len(self.docs)

    def sort(self, _field, direction):
        reverse = direction == -1
        self.docs.sort(key=lambda d: d.get("createdAt", ""), reverse=reverse)
        return self

    def limit(self, n):
        self._limit = n
        return self

    async def to_list(self, n):
        return self.docs[: min(self._limit, n)]


class _FakeDb:
    def __init__(self, integration_doc=None, telemetry_docs=None):
        self.user_integrations = _FakeCollection(seed_doc=integration_doc or {})
        self.prospects = _FakeCollection()
        self.company_research = _FakeCollection()
        self.integration_event_dedup = _FakeCollection(seed_doc={})
        self.email_sends = _FakeCollection(seed_doc={})
        self.email_events = _FakeCollection(seed_doc={})
        self.integration_telemetry = _FakeCollection(seed_doc=telemetry_docs or [])


def _build_client(monkeypatch, fake_db):
    app = FastAPI()
    app.include_router(real_integrations.router, prefix="/api/integrations")
    app.dependency_overrides[real_integrations.get_current_user] = (
        lambda: {"id": "u1", "email": "sales@example.com"}
    )
    real_integrations._reset_connector_rate_limit_state()
    monkeypatch.setattr(real_integrations, "get_db", lambda: fake_db)
    return TestClient(app)


def _build_unauth_client(monkeypatch, fake_db):
    app = FastAPI()
    app.include_router(real_integrations.router, prefix="/api/integrations")
    real_integrations._reset_connector_rate_limit_state()
    monkeypatch.setattr(real_integrations, "get_db", lambda: fake_db)
    return TestClient(app)


def test_http_governance_endpoints_require_auth(monkeypatch):
    fake_db = _FakeDb()
    client = _build_unauth_client(monkeypatch, fake_db)

    endpoints = [
        "/api/integrations/integrations/telemetry/snapshot-governance?retention_days=30",
        "/api/integrations/integrations/telemetry/snapshot-governance?retention_days=0",
        "/api/integrations/integrations/telemetry/baseline-governance",
        "/api/integrations/integrations/telemetry/governance-report?days=7&limit=500",
        "/api/integrations/integrations/telemetry/governance-report?days=0&limit=500",
        "/api/integrations/integrations/telemetry/governance-report?days=7&limit=1",
        "/api/integrations/integrations/telemetry/governance-report/export?days=7&limit=500",
        "/api/integrations/integrations/telemetry/governance-report/history?retention_days=30&limit=10",
        "/api/integrations/integrations/telemetry/governance-report/history?retention_days=0&limit=10",
        "/api/integrations/integrations/telemetry/governance-report/history?retention_days=30&limit=0",
        "/api/integrations/integrations/telemetry/governance-schema",
    ]
    for path in endpoints:
        response = client.get(path)
        assert response.status_code in (401, 403)


def test_http_integrations_and_provider_endpoints_require_auth(monkeypatch):
    fake_db = _FakeDb()
    client = _build_unauth_client(monkeypatch, fake_db)

    get_endpoints = [
        "/api/integrations/integrations",
        "/api/integrations/integrations/health",
        "/api/integrations/integrations/telemetry/summary?days=7&limit=500",
        "/api/integrations/integrations/telemetry/summary?days=0&limit=500",
        "/api/integrations/integrations/telemetry/summary?days=7&limit=49",
        "/api/integrations/integrations/telemetry/summary?days=7&limit=500&packet_only_recent_events=banana",
        "/api/integrations/integrations/telemetry/summary?days=7&limit=500&governance_status=%20%20",
        "/api/integrations/integrations/telemetry/summary?days=7&limit=500&packet_validation_status=%21%21%21",
        "/api/integrations/integrations/telemetry/slo-gates?days=7&limit=500",
        "/api/integrations/integrations/telemetry/slo-gates?days=0&limit=500",
        "/api/integrations/integrations/telemetry/slo-gates?days=7&limit=99",
        "/api/integrations/integrations/telemetry/slo-gates?days=7&limit=500&min_schema_v2_pct=101",
        "/api/integrations/email/analytics?days=7",
    ]
    for path in get_endpoints:
        response = client.get(path)
        assert response.status_code in (401, 403)

    post_endpoints = [
        ("/api/integrations/providers/apollo/search", {"query": "vp sales", "limit": 1}),
        (
            "/api/integrations/providers/apollo/company",
            {"company": "Acme Corp", "saveResult": False},
        ),
        (
            "/api/integrations/providers/clearbit/company",
            {"domain": "acme.com", "saveResult": False},
        ),
        (
            "/api/integrations/providers/crunchbase/company",
            {"company": "Acme Corp", "saveResult": False},
        ),
        (
            "/api/integrations/providers/company-enrichment",
            {"company": "Acme Corp", "domain": "acme.com", "saveResult": False},
        ),
        ("/api/integrations/integrations/sendgrid", {"api_key": "SG.token"}),
        ("/api/integrations/integrations/apollo", {"api_key": "apollo-token"}),
        ("/api/integrations/integrations/clearbit", {"api_key": "clearbit-token"}),
        ("/api/integrations/integrations/crunchbase", {"api_key": "crunchbase-token"}),
        ("/api/integrations/search-leads", {"criteria": "vp sales", "count": 1}),
        ("/api/integrations/scrape-company", {"domain": "acme.com"}),
        (
            "/api/integrations/email/send",
            {"to": "demo@example.com", "subject": "Intro", "body": "Hello"},
        ),
    ]
    for path, payload in post_endpoints:
        response = client.post(path, json=payload)
        assert response.status_code in (401, 403)

    delete_endpoints = [
        "/api/integrations/integrations/sendgrid",
        "/api/integrations/integrations/apollo",
        "/api/integrations/integrations/clearbit",
        "/api/integrations/integrations/crunchbase",
    ]
    for path in delete_endpoints:
        response = client.delete(path)
        assert response.status_code in (401, 403)


def test_http_sendgrid_webhook_returns_attribution_triage_counters(monkeypatch):
    class _DedupCollection:
        def __init__(self):
            self.docs = {}

        async def find_one(self, flt=None, *_args, **_kwargs):
            key = (flt or {}).get("id")
            if not key:
                return None
            return self.docs.get(key)

        async def insert_one(self, doc):
            key = doc.get("id")
            if key:
                self.docs[key] = doc
            return {"ok": 1}

    fake_db = _FakeDb(integration_doc={"userId": "u1"})
    fake_db.integration_event_dedup = _DedupCollection()
    client = _build_client(monkeypatch, fake_db)

    now_ts = int(datetime.now(timezone.utc).timestamp())
    payload = [
        {
            "event": "open",
            "send_id": "send-100",
            "timestamp": now_ts - (3 * 86400),
            "sg_event_id": "evt-100",
        },
        {
            "event": "open",
            "send_id": "send-100",
            "timestamp": now_ts - (3 * 86400),
            "sg_event_id": "evt-100",
        },
        {
            "event": "processed",
            "send_id": "send-101",
            "timestamp": now_ts + 900,
            "sg_event_id": "evt-101",
        },
        {
            "event": "click",
            "send_id": "send-102",
            "timestamp": "bad-ts",
            "sg_event_id": "evt-102",
        },
    ]

    response = client.post("/api/integrations/webhook/sendgrid", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["received"] == 4
    assert data["processed"] == 3
    assert data["deduplicated"] == 1
    assert data["updateEligibleEventCount"] == 2
    assert data["unsupportedEventTypeCount"] == 1
    assert data["updateEligibleEventTypeCounts"]["open"] == 1
    assert data["updateEligibleEventTypeCounts"]["click"] == 1
    assert data["unsupportedEventTypeCounts"]["processed"] == 1
    assert data["deduplicatedEventTypeCounts"]["open"] == 1
    assert data["emailUpdateEventTypeCounts"]["open"] == 1
    assert data["emailUpdateEventTypeCounts"]["click"] == 1
    assert data["invalidTimestampCount"] == 1
    assert data["timestampFallbackCount"] == 1
    assert data["staleEventCount"] == 2
    assert data["futureSkewEventCount"] == 1
    assert data["staleEventTypeCounts"]["open"] == 2
    assert data["futureSkewEventTypeCounts"]["processed"] == 1
    assert data["timestampAgeBucketCounts"]["stale"] == 2
    assert data["timestampAgeBucketCounts"]["future_skew"] == 1
    assert data["timestampAgeBucketCounts"]["fallback"] == 1
    assert data["timestampPressureLabel"] == "High"
    assert data["timestampAnomalyCount"] == 4
    assert data["timestampAnomalyRatePct"] == 100.0
    assert data["timestampAnomalyEventTypeCounts"]["open"] == 2
    assert data["timestampAnomalyEventTypeCounts"]["processed"] == 1
    assert data["timestampAnomalyEventTypeCounts"]["click"] == 1
    assert data["timestampDominantAnomalyBucket"] == "stale"
    assert data["timestampDominantAnomalyBucketCount"] == 2
    assert data["timestampDominantAnomalyEventType"] == "open"
    assert data["timestampDominantAnomalyEventTypeCount"] == 2


def test_http_get_integrations_masks_keys_and_flags(monkeypatch):
    monkeypatch.setenv("ENABLE_APOLLO_CONNECTOR", "true")
    monkeypatch.setenv("ENABLE_CLEARBIT_CONNECTOR", "false")
    monkeypatch.setenv("ENABLE_CRUNCHBASE_CONNECTOR", "true")
    fake_db = _FakeDb(
        integration_doc={
            "userId": "u1",
            "sendgrid_api_key": "SG.abcdefgh12345678",
            "apollo_api_key": "apolloabcdefgh12345678",
            "clearbit_api_key": "clearbitabcdefgh12345678",
            "crunchbase_api_key": "crunchbaseabcdefgh12345678",
        }
    )
    client = _build_client(monkeypatch, fake_db)
    response = client.get("/api/integrations/integrations")
    assert response.status_code == 200
    payload = response.json()
    assert payload["sendgrid_configured"] is True
    assert payload["apollo_enabled"] is True
    assert payload["clearbit_enabled"] is False
    assert payload["crunchbase_enabled"] is True
    assert payload["sendgrid_api_key"].startswith("••••••••")


def test_http_save_sendgrid_integration_returns_lifecycle_metadata_and_persists_audit_event(monkeypatch):
    fake_db = _FakeDb(integration_doc={"userId": "u1"})

    async def fake_sendgrid_health(_api_key, **_kwargs):
        return {
            "provider": "sendgrid",
            "healthy": True,
            "statusCode": 200,
            "latencyMs": 15,
            "error": None,
        }

    monkeypatch.setattr(real_integrations, "_health_check_sendgrid", fake_sendgrid_health)
    client = _build_client(monkeypatch, fake_db)
    response = client.post(
        "/api/integrations/integrations/sendgrid",
        json={"api_key": "  SG.sendgrid-token-123  ", "from_email": "owner@example.com"},
        headers={"X-Request-Id": "req-sendgrid-save-1"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["connectorEnabled"] is True
    assert payload["keyRotated"] is True
    assert isinstance(payload["configuredAt"], str)
    assert isinstance(payload["lastRotatedAt"], str)
    assert len(fake_db.user_integrations.updated) == 2
    for update_call in fake_db.user_integrations.updated:
        assert update_call["filter"] == {"userId": "u1"}
    first_set_payload = fake_db.user_integrations.updated[0]["payload"]["$set"]
    second_set_payload = fake_db.user_integrations.updated[1]["payload"]["$set"]
    assert first_set_payload["sendgrid_api_key"] == "SG.sendgrid-token-123"
    assert "sendgrid_configured_at" in first_set_payload
    assert "sendgrid_last_rotated_at" in first_set_payload
    assert second_set_payload["from_email"] == "owner@example.com"
    assert second_set_payload["sendgrid_last_health"]["healthy"] is True
    assert len(fake_db.integration_telemetry.inserted) == 1
    telemetry_event = fake_db.integration_telemetry.inserted[0]
    assert telemetry_event["eventType"] == "integrations_connector_credential_saved"
    assert telemetry_event["payload"]["provider"] == "sendgrid"
    assert telemetry_event["payload"]["action"] == "saved"
    assert telemetry_event["payload"]["request_id"] == "req-sendgrid-save-1"


def test_http_remove_sendgrid_integration_returns_lifecycle_metadata_and_persists_audit_event(monkeypatch):
    fake_db = _FakeDb(
        integration_doc={
            "userId": "u1",
            "sendgrid_api_key": "SG.sendgrid-token-123",
            "sendgrid_configured_at": "2026-02-20T00:00:00+00:00",
            "sendgrid_last_rotated_at": "2026-02-21T00:00:00+00:00",
        }
    )
    client = _build_client(monkeypatch, fake_db)
    response = client.delete(
        "/api/integrations/integrations/sendgrid",
        headers={"X-Request-Id": "req-sendgrid-remove-1"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["hadKey"] is True
    assert isinstance(payload["removedAt"], str)
    assert len(fake_db.user_integrations.updated) == 2
    for update_call in fake_db.user_integrations.updated:
        assert update_call["filter"] == {"userId": "u1"}
    first_unset_payload = fake_db.user_integrations.updated[0]["payload"]["$unset"]
    second_unset_payload = fake_db.user_integrations.updated[1]["payload"]["$unset"]
    assert "sendgrid_api_key" in first_unset_payload
    assert "sendgrid_configured_at" in first_unset_payload
    assert "sendgrid_last_rotated_at" in first_unset_payload
    assert "sendgrid_last_health" in second_unset_payload
    assert "from_email" in second_unset_payload
    assert len(fake_db.integration_telemetry.inserted) == 1
    telemetry_event = fake_db.integration_telemetry.inserted[0]
    assert telemetry_event["eventType"] == "integrations_connector_credential_removed"
    assert telemetry_event["payload"]["provider"] == "sendgrid"
    assert telemetry_event["payload"]["action"] == "removed"
    assert telemetry_event["payload"]["request_id"] == "req-sendgrid-remove-1"


def test_http_save_apollo_integration_returns_lifecycle_metadata_and_persists_audit_event(monkeypatch):
    fake_db = _FakeDb(integration_doc={"userId": "u1"})
    client = _build_client(monkeypatch, fake_db)
    response = client.post(
        "/api/integrations/integrations/apollo",
        json={"api_key": "  apollo-token-123  "},
        headers={"X-Request-Id": "req-apollo-save-1"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["connectorEnabled"] in (True, False)
    assert payload["keyRotated"] is True
    assert isinstance(payload["configuredAt"], str)
    assert isinstance(payload["lastRotatedAt"], str)
    assert len(fake_db.user_integrations.updated) == 1
    assert fake_db.user_integrations.updated[0]["filter"] == {"userId": "u1"}
    update_payload = fake_db.user_integrations.updated[0]["payload"]["$set"]
    assert update_payload["apollo_api_key"] == "apollo-token-123"
    assert "apollo_configured_at" in update_payload
    assert "apollo_last_rotated_at" in update_payload
    assert len(fake_db.integration_telemetry.inserted) == 1
    telemetry_event = fake_db.integration_telemetry.inserted[0]
    assert telemetry_event["eventType"] == "integrations_connector_credential_saved"
    assert telemetry_event["payload"]["provider"] == "apollo"
    assert telemetry_event["payload"]["action"] == "saved"
    assert telemetry_event["payload"]["request_id"] == "req-apollo-save-1"


def test_http_remove_apollo_integration_returns_lifecycle_metadata_and_persists_audit_event(monkeypatch):
    fake_db = _FakeDb(
        integration_doc={
            "userId": "u1",
            "apollo_api_key": "apollo-token-123",
            "apollo_configured_at": "2026-02-20T00:00:00+00:00",
            "apollo_last_rotated_at": "2026-02-21T00:00:00+00:00",
        }
    )
    client = _build_client(monkeypatch, fake_db)
    response = client.delete(
        "/api/integrations/integrations/apollo",
        headers={"X-Request-Id": "req-apollo-remove-1"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["hadKey"] is True
    assert isinstance(payload["removedAt"], str)
    assert len(fake_db.user_integrations.updated) == 1
    assert fake_db.user_integrations.updated[0]["filter"] == {"userId": "u1"}
    unset_payload = fake_db.user_integrations.updated[0]["payload"]["$unset"]
    assert "apollo_api_key" in unset_payload
    assert "apollo_configured_at" in unset_payload
    assert "apollo_last_rotated_at" in unset_payload
    assert len(fake_db.integration_telemetry.inserted) == 1
    telemetry_event = fake_db.integration_telemetry.inserted[0]
    assert telemetry_event["eventType"] == "integrations_connector_credential_removed"
    assert telemetry_event["payload"]["provider"] == "apollo"
    assert telemetry_event["payload"]["action"] == "removed"
    assert telemetry_event["payload"]["request_id"] == "req-apollo-remove-1"


def test_http_save_clearbit_integration_returns_lifecycle_metadata_and_persists_audit_event(monkeypatch):
    fake_db = _FakeDb(integration_doc={"userId": "u1"})
    client = _build_client(monkeypatch, fake_db)
    response = client.post(
        "/api/integrations/integrations/clearbit",
        json={"api_key": "  clearbit-token-123  "},
        headers={"X-Request-Id": "req-clearbit-save-1"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["connectorEnabled"] in (True, False)
    assert payload["keyRotated"] is True
    assert isinstance(payload["configuredAt"], str)
    assert isinstance(payload["lastRotatedAt"], str)
    assert len(fake_db.user_integrations.updated) == 1
    assert fake_db.user_integrations.updated[0]["filter"] == {"userId": "u1"}
    update_payload = fake_db.user_integrations.updated[0]["payload"]["$set"]
    assert update_payload["clearbit_api_key"] == "clearbit-token-123"
    assert "clearbit_configured_at" in update_payload
    assert "clearbit_last_rotated_at" in update_payload
    assert len(fake_db.integration_telemetry.inserted) == 1
    telemetry_event = fake_db.integration_telemetry.inserted[0]
    assert telemetry_event["eventType"] == "integrations_connector_credential_saved"
    assert telemetry_event["payload"]["provider"] == "clearbit"
    assert telemetry_event["payload"]["action"] == "saved"
    assert telemetry_event["payload"]["request_id"] == "req-clearbit-save-1"


def test_http_remove_clearbit_integration_returns_lifecycle_metadata_and_persists_audit_event(monkeypatch):
    fake_db = _FakeDb(
        integration_doc={
            "userId": "u1",
            "clearbit_api_key": "clearbit-token-123",
            "clearbit_configured_at": "2026-02-20T00:00:00+00:00",
            "clearbit_last_rotated_at": "2026-02-21T00:00:00+00:00",
        }
    )
    client = _build_client(monkeypatch, fake_db)
    response = client.delete(
        "/api/integrations/integrations/clearbit",
        headers={"X-Request-Id": "req-clearbit-remove-1"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["hadKey"] is True
    assert isinstance(payload["removedAt"], str)
    assert len(fake_db.user_integrations.updated) == 1
    assert fake_db.user_integrations.updated[0]["filter"] == {"userId": "u1"}
    unset_payload = fake_db.user_integrations.updated[0]["payload"]["$unset"]
    assert "clearbit_api_key" in unset_payload
    assert "clearbit_configured_at" in unset_payload
    assert "clearbit_last_rotated_at" in unset_payload
    assert len(fake_db.integration_telemetry.inserted) == 1
    telemetry_event = fake_db.integration_telemetry.inserted[0]
    assert telemetry_event["eventType"] == "integrations_connector_credential_removed"
    assert telemetry_event["payload"]["provider"] == "clearbit"
    assert telemetry_event["payload"]["action"] == "removed"
    assert telemetry_event["payload"]["request_id"] == "req-clearbit-remove-1"


def test_http_save_crunchbase_integration_returns_lifecycle_metadata_and_persists_audit_event(monkeypatch):
    fake_db = _FakeDb(integration_doc={"userId": "u1"})
    client = _build_client(monkeypatch, fake_db)
    response = client.post(
        "/api/integrations/integrations/crunchbase",
        json={"api_key": "  crunchbase-token-123  "},
        headers={"X-Request-Id": "req-crunchbase-save-1"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["connectorEnabled"] in (True, False)
    assert payload["keyRotated"] is True
    assert isinstance(payload["configuredAt"], str)
    assert isinstance(payload["lastRotatedAt"], str)
    assert len(fake_db.user_integrations.updated) == 1
    assert fake_db.user_integrations.updated[0]["filter"] == {"userId": "u1"}
    update_payload = fake_db.user_integrations.updated[0]["payload"]["$set"]
    assert update_payload["crunchbase_api_key"] == "crunchbase-token-123"
    assert "crunchbase_configured_at" in update_payload
    assert "crunchbase_last_rotated_at" in update_payload
    assert len(fake_db.integration_telemetry.inserted) == 1
    telemetry_event = fake_db.integration_telemetry.inserted[0]
    assert telemetry_event["eventType"] == "integrations_connector_credential_saved"
    assert telemetry_event["payload"]["provider"] == "crunchbase"
    assert telemetry_event["payload"]["action"] == "saved"
    assert telemetry_event["payload"]["request_id"] == "req-crunchbase-save-1"


def test_http_remove_crunchbase_integration_returns_lifecycle_metadata_and_persists_audit_event(monkeypatch):
    fake_db = _FakeDb(
        integration_doc={
            "userId": "u1",
            "crunchbase_api_key": "crunchbase-token-123",
            "crunchbase_configured_at": "2026-02-20T00:00:00+00:00",
            "crunchbase_last_rotated_at": "2026-02-21T00:00:00+00:00",
        }
    )
    client = _build_client(monkeypatch, fake_db)
    response = client.delete(
        "/api/integrations/integrations/crunchbase",
        headers={"X-Request-Id": "req-crunchbase-remove-1"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["hadKey"] is True
    assert isinstance(payload["removedAt"], str)
    assert len(fake_db.user_integrations.updated) == 1
    assert fake_db.user_integrations.updated[0]["filter"] == {"userId": "u1"}
    unset_payload = fake_db.user_integrations.updated[0]["payload"]["$unset"]
    assert "crunchbase_api_key" in unset_payload
    assert "crunchbase_configured_at" in unset_payload
    assert "crunchbase_last_rotated_at" in unset_payload
    assert len(fake_db.integration_telemetry.inserted) == 1
    telemetry_event = fake_db.integration_telemetry.inserted[0]
    assert telemetry_event["eventType"] == "integrations_connector_credential_removed"
    assert telemetry_event["payload"]["provider"] == "crunchbase"
    assert telemetry_event["payload"]["action"] == "removed"
    assert telemetry_event["payload"]["request_id"] == "req-crunchbase-remove-1"


def test_http_apollo_search_success(monkeypatch):
    monkeypatch.setenv("ENABLE_APOLLO_CONNECTOR", "true")
    fake_db = _FakeDb(integration_doc={"userId": "u1", "apollo_api_key": "token"})

    async def fake_provider_request(**_kwargs):
        return _load_fixture("apollo_people_search.json")

    monkeypatch.setattr(real_integrations, "_provider_request_json", fake_provider_request)
    client = _build_client(monkeypatch, fake_db)
    response = client.post(
        "/api/integrations/providers/apollo/search",
        json={"query": "vp sales", "limit": 2, "saveResults": True},
        headers={"X-Request-Id": "req-http-contract-1"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["resultCount"] == 2
    assert payload["savedCount"] == 2
    assert payload["rateLimit"]["limit"] >= 1
    assert payload["rateLimit"]["remaining"] >= 0
    assert isinstance(payload["rateLimit"]["resetAt"], str)
    assert payload["rateLimit"]["resetInSeconds"] >= 1
    assert response.headers["X-RateLimit-Limit"] == str(payload["rateLimit"]["limit"])
    assert response.headers["X-RateLimit-Remaining"] == str(payload["rateLimit"]["remaining"])
    assert response.headers["X-RateLimit-Window-Seconds"] == str(payload["rateLimit"]["windowSeconds"])
    assert response.headers["X-RateLimit-Reset-At"] == payload["rateLimit"]["resetAt"]
    assert response.headers["X-RateLimit-Reset-In-Seconds"] == str(payload["rateLimit"]["resetInSeconds"])
    assert len(fake_db.integration_telemetry.inserted) == 1
    saved_event = fake_db.integration_telemetry.inserted[0]
    assert saved_event["payload"]["request_id"] == "req-http-contract-1"


def test_http_apollo_search_invalid_limit_returns_400(monkeypatch):
    monkeypatch.setenv("ENABLE_APOLLO_CONNECTOR", "true")
    fake_db = _FakeDb(integration_doc={"userId": "u1", "apollo_api_key": "token"})
    client = _build_client(monkeypatch, fake_db)
    response = client.post(
        "/api/integrations/providers/apollo/search",
        json={"query": "vp sales", "limit": "invalid"},
    )
    assert response.status_code == 400
    detail = response.json()["detail"]
    assert detail["errorCode"] == "invalid_request_bounds"
    assert detail["message"] == "Invalid limit: expected integer between 1 and 100"
    assert detail["field"] == "limit"
    assert detail["reason"] == "type"
    assert detail["received"] == "invalid"


def test_http_apollo_search_invalid_page_returns_400(monkeypatch):
    monkeypatch.setenv("ENABLE_APOLLO_CONNECTOR", "true")
    fake_db = _FakeDb(integration_doc={"userId": "u1", "apollo_api_key": "token"})
    client = _build_client(monkeypatch, fake_db)
    response = client.post(
        "/api/integrations/providers/apollo/search",
        json={"query": "vp sales", "page": 0},
    )
    assert response.status_code == 400
    detail = response.json()["detail"]
    assert detail["errorCode"] == "invalid_request_bounds"
    assert detail["message"] == "Invalid page: expected integer between 1 and 1000"
    assert detail["field"] == "page"
    assert detail["reason"] == "range"
    assert detail["received"] == 0


def test_http_apollo_search_invalid_input_does_not_consume_rate_limit(monkeypatch):
    monkeypatch.setenv("ENABLE_APOLLO_CONNECTOR", "true")
    monkeypatch.setenv("CONNECTOR_RATE_LIMIT_MAX_REQUESTS", "1")
    monkeypatch.setenv("CONNECTOR_RATE_LIMIT_WINDOW_SECONDS", "60")
    fake_db = _FakeDb(integration_doc={"userId": "u1", "apollo_api_key": "token"})

    async def fake_provider_request(**_kwargs):
        return _load_fixture("apollo_people_search.json")

    monkeypatch.setattr(real_integrations, "_provider_request_json", fake_provider_request)
    client = _build_client(monkeypatch, fake_db)
    invalid = client.post(
        "/api/integrations/providers/apollo/search",
        json={"query": "vp sales", "limit": "invalid"},
    )
    assert invalid.status_code == 400
    invalid_detail = invalid.json()["detail"]
    assert invalid_detail["errorCode"] == "invalid_request_bounds"

    first_valid = client.post(
        "/api/integrations/providers/apollo/search",
        json={"query": "vp sales", "limit": 1},
    )
    assert first_valid.status_code == 200

    second_valid = client.post(
        "/api/integrations/providers/apollo/search",
        json={"query": "vp sales", "limit": 1},
    )
    assert second_valid.status_code == 429
    validation_events = [
        doc
        for doc in fake_db.integration_telemetry.inserted
        if doc.get("eventType") == "integrations_connector_input_validation_failed"
    ]
    assert len(validation_events) >= 1
    latest_validation_event = validation_events[-1]
    validation_payload = latest_validation_event.get("payload") or {}
    assert validation_payload.get("endpoint") == "apollo_search"
    assert validation_payload.get("field") == "limit"
    assert validation_payload.get("error_code") == "invalid_request_bounds"


def test_http_apollo_search_rate_limit_returns_429(monkeypatch):
    monkeypatch.setenv("ENABLE_APOLLO_CONNECTOR", "true")
    monkeypatch.setenv("CONNECTOR_RATE_LIMIT_MAX_REQUESTS", "1")
    monkeypatch.setenv("CONNECTOR_RATE_LIMIT_WINDOW_SECONDS", "60")
    fake_db = _FakeDb(integration_doc={"userId": "u1", "apollo_api_key": "token"})

    async def fake_provider_request(**_kwargs):
        return _load_fixture("apollo_people_search.json")

    monkeypatch.setattr(real_integrations, "_provider_request_json", fake_provider_request)
    client = _build_client(monkeypatch, fake_db)

    first = client.post(
        "/api/integrations/providers/apollo/search",
        json={"query": "vp sales", "limit": 1},
    )
    assert first.status_code == 200

    second = client.post(
        "/api/integrations/providers/apollo/search",
        json={"query": "vp sales", "limit": 1},
    )
    assert second.status_code == 429
    payload = second.json()
    retry_after_header = second.headers.get("Retry-After")
    assert retry_after_header is not None
    retry_after_seconds = int(retry_after_header)
    assert 1 <= retry_after_seconds <= 60
    assert second.headers["X-RateLimit-Limit"] == "1"
    assert second.headers["X-RateLimit-Remaining"] == "0"
    assert second.headers["X-RateLimit-Window-Seconds"] == "60"
    assert second.headers["X-RateLimit-Reset-In-Seconds"] == str(retry_after_seconds)
    assert payload["detail"]["errorCode"] == "connector_rate_limited"
    assert payload["detail"]["endpoint"] == "apollo_search"
    assert payload["detail"]["retryAfterSeconds"] == retry_after_seconds
    assert payload["detail"]["rateLimit"]["limit"] == 1
    assert payload["detail"]["rateLimit"]["remaining"] == 0
    assert payload["detail"]["rateLimit"]["windowSeconds"] == 60
    assert payload["detail"]["rateLimit"]["resetInSeconds"] == retry_after_seconds
    assert "Retry in" in payload["detail"]["message"]
    matching_events = [
        doc
        for doc in fake_db.integration_telemetry.inserted
        if doc.get("eventType") == "integrations_connector_rate_limited"
    ]
    assert len(matching_events) >= 1
    latest_event = matching_events[-1]
    event_payload = latest_event.get("payload") or {}
    assert event_payload.get("endpoint") == "apollo_search"
    assert event_payload.get("retry_after_seconds") == retry_after_seconds
    assert event_payload.get("reset_in_seconds") == retry_after_seconds


def test_http_apollo_company_invalid_limit_returns_400(monkeypatch):
    monkeypatch.setenv("ENABLE_APOLLO_CONNECTOR", "true")
    fake_db = _FakeDb(integration_doc={"userId": "u1", "apollo_api_key": "token"})
    client = _build_client(monkeypatch, fake_db)
    response = client.post(
        "/api/integrations/providers/apollo/company",
        json={"companyName": "PipelineIQ", "limit": 26},
    )
    assert response.status_code == 400
    detail = response.json()["detail"]
    assert detail["errorCode"] == "invalid_request_bounds"
    assert detail["message"] == "Invalid limit: expected integer between 1 and 25"
    assert detail["field"] == "limit"
    assert detail["reason"] == "range"
    assert detail["received"] == 26


def test_http_clearbit_search_success(monkeypatch):
    monkeypatch.setenv("ENABLE_CLEARBIT_CONNECTOR", "true")
    fake_db = _FakeDb(integration_doc={"userId": "u1", "clearbit_api_key": "token"})

    async def fake_provider_request(**_kwargs):
        return _load_fixture("clearbit_company_find.json")

    monkeypatch.setattr(real_integrations, "_provider_request_json", fake_provider_request)
    client = _build_client(monkeypatch, fake_db)
    response = client.post(
        "/api/integrations/providers/clearbit/company",
        json={"domain": "growthops.ai", "saveResearch": True},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["found"] is True
    assert payload["rateLimit"]["limit"] >= 1
    assert response.headers["X-RateLimit-Limit"] == str(payload["rateLimit"]["limit"])
    assert response.headers["X-RateLimit-Remaining"] == str(payload["rateLimit"]["remaining"])
    assert response.headers["X-RateLimit-Window-Seconds"] == str(payload["rateLimit"]["windowSeconds"])
    assert response.headers["X-RateLimit-Reset-At"] == payload["rateLimit"]["resetAt"]
    assert response.headers["X-RateLimit-Reset-In-Seconds"] == str(payload["rateLimit"]["resetInSeconds"])
    assert payload["storagePolicy"]["maxBytes"] >= 1024


def test_http_clearbit_missing_domain_does_not_consume_rate_limit(monkeypatch):
    monkeypatch.setenv("ENABLE_CLEARBIT_CONNECTOR", "true")
    monkeypatch.setenv("CONNECTOR_RATE_LIMIT_MAX_REQUESTS", "1")
    monkeypatch.setenv("CONNECTOR_RATE_LIMIT_WINDOW_SECONDS", "60")
    fake_db = _FakeDb(integration_doc={"userId": "u1", "clearbit_api_key": "token"})

    async def fake_provider_request(**_kwargs):
        return _load_fixture("clearbit_company_find.json")

    monkeypatch.setattr(real_integrations, "_provider_request_json", fake_provider_request)
    client = _build_client(monkeypatch, fake_db)
    invalid = client.post("/api/integrations/providers/clearbit/company", json={})
    assert invalid.status_code == 400
    invalid_detail = invalid.json()["detail"]
    assert invalid_detail["errorCode"] == "invalid_request_required_field"
    assert invalid_detail["message"] == "domain is required"
    assert invalid_detail["field"] == "domain"
    assert invalid_detail["reason"] == "required"

    first_valid = client.post(
        "/api/integrations/providers/clearbit/company",
        json={"domain": "growthops.ai"},
    )
    assert first_valid.status_code == 200

    second_valid = client.post(
        "/api/integrations/providers/clearbit/company",
        json={"domain": "growthops.ai"},
    )
    assert second_valid.status_code == 429
    validation_events = [
        doc
        for doc in fake_db.integration_telemetry.inserted
        if doc.get("eventType") == "integrations_connector_input_validation_failed"
    ]
    assert len(validation_events) >= 1
    latest_validation_event = validation_events[-1]
    validation_payload = latest_validation_event.get("payload") or {}
    assert validation_payload.get("endpoint") == "clearbit_company"
    assert validation_payload.get("field") == "domain"
    assert validation_payload.get("error_code") == "invalid_request_required_field"


def test_http_crunchbase_search_success(monkeypatch):
    monkeypatch.setenv("ENABLE_CRUNCHBASE_CONNECTOR", "true")
    fake_db = _FakeDb(integration_doc={"userId": "u1", "crunchbase_api_key": "token"})

    async def fake_provider_request(**_kwargs):
        return _load_fixture("crunchbase_organizations_search.json")

    monkeypatch.setattr(real_integrations, "_provider_request_json", fake_provider_request)
    client = _build_client(monkeypatch, fake_db)
    response = client.post(
        "/api/integrations/providers/crunchbase/company",
        json={"companyName": "PipelineIQ", "limit": 2, "saveResearch": True},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["resultCount"] == 2
    assert payload["savedCount"] == 2
    assert payload["rateLimit"]["limit"] >= 1
    assert response.headers["X-RateLimit-Limit"] == str(payload["rateLimit"]["limit"])
    assert response.headers["X-RateLimit-Remaining"] == str(payload["rateLimit"]["remaining"])
    assert response.headers["X-RateLimit-Window-Seconds"] == str(payload["rateLimit"]["windowSeconds"])
    assert response.headers["X-RateLimit-Reset-At"] == payload["rateLimit"]["resetAt"]
    assert response.headers["X-RateLimit-Reset-In-Seconds"] == str(payload["rateLimit"]["resetInSeconds"])
    assert payload["storagePolicy"]["maxBytes"] >= 1024


def test_http_crunchbase_search_invalid_limit_returns_400(monkeypatch):
    monkeypatch.setenv("ENABLE_CRUNCHBASE_CONNECTOR", "true")
    fake_db = _FakeDb(integration_doc={"userId": "u1", "crunchbase_api_key": "token"})
    client = _build_client(monkeypatch, fake_db)
    response = client.post(
        "/api/integrations/providers/crunchbase/company",
        json={"companyName": "PipelineIQ", "limit": 0},
    )
    assert response.status_code == 400
    detail = response.json()["detail"]
    assert detail["errorCode"] == "invalid_request_bounds"
    assert detail["message"] == "Invalid limit: expected integer between 1 and 25"
    assert detail["field"] == "limit"
    assert detail["reason"] == "range"
    assert detail["received"] == 0


def test_http_orchestration_returns_provider_order_diagnostics(monkeypatch):
    monkeypatch.setenv("ENABLE_CONNECTOR_ORCHESTRATION", "true")
    fake_db = _FakeDb(integration_doc={"userId": "u1"})
    client = _build_client(monkeypatch, fake_db)

    async def fake_clearbit(*_args, **_kwargs):
        return {
            "success": True,
            "provider": "clearbit",
            "found": True,
            "company": {"name": "GrowthOps", "domain": "growthops.ai", "source": "clearbit"},
        }

    monkeypatch.setattr(real_integrations, "clearbit_enrich_company", fake_clearbit)

    response = client.post(
        "/api/integrations/providers/company-enrichment",
        json={
            "domain": "growthops.ai",
            "providerOrder": ["clearbit", "clearbit", "unsupported-provider"],
            "stopOnFirstMatch": True,
        },
    )
    assert response.status_code == 200
    payload = response.json()
    diagnostics = payload["criteria"]["providerOrderDiagnostics"]
    assert diagnostics["duplicatesRemoved"] == ["clearbit"]
    assert diagnostics["ignoredProviders"] == ["unsupported-provider"]
    assert diagnostics["defaultApplied"] is False
    assert payload["attemptSummary"]["total"] == 1
    assert payload["attemptSummary"]["statusCounts"]["success"] == 1
    assert payload["attemptSummary"]["statusCounts"]["skipped"] == 0
    assert payload["attemptSummary"]["statusCounts"]["error"] == 0
    assert payload["attemptSummary"]["reasonCodeCounts"]["success"] == 1
    assert payload["attemptSummary"]["providersAttempted"] == ["clearbit"]
    assert payload["attemptSummary"]["providersWithResults"] == ["clearbit"]
    assert payload["attemptSummary"]["providersWithoutResults"] == []
    assert payload["attempts"][0]["provider"] == "clearbit"
    assert payload["attempts"][0]["status"] == "success"
    assert payload["attempts"][0]["reasonCode"] == "success"
    assert payload["attempts"][0]["resultCount"] == 1
    assert payload["attempts"][0]["latencyMs"] >= 0
    assert payload["attempts"][0]["rateLimitRemaining"] is None
    assert payload["attempts"][0]["rateLimitResetInSeconds"] is None
    assert response.headers["X-RateLimit-Limit"] == str(payload["rateLimit"]["limit"])
    assert response.headers["X-RateLimit-Remaining"] == str(payload["rateLimit"]["remaining"])
    assert response.headers["X-RateLimit-Window-Seconds"] == str(payload["rateLimit"]["windowSeconds"])
    assert response.headers["X-RateLimit-Reset-At"] == payload["rateLimit"]["resetAt"]
    assert response.headers["X-RateLimit-Reset-In-Seconds"] == str(payload["rateLimit"]["resetInSeconds"])
    assert len(fake_db.integration_telemetry.inserted) == 1
    telemetry_event = fake_db.integration_telemetry.inserted[0]
    assert telemetry_event["eventType"] == "company_enrichment_orchestrated"
    assert telemetry_event["payload"]["attempt_success_count"] == 1
    assert telemetry_event["payload"]["attempt_skipped_count"] == 0
    assert telemetry_event["payload"]["attempt_error_count"] == 0
    assert telemetry_event["payload"]["attempt_reason_codes"]["success"] == 1


def test_http_orchestration_invalid_limit_returns_400(monkeypatch):
    monkeypatch.setenv("ENABLE_CONNECTOR_ORCHESTRATION", "true")
    fake_db = _FakeDb(integration_doc={"userId": "u1"})
    client = _build_client(monkeypatch, fake_db)
    response = client.post(
        "/api/integrations/providers/company-enrichment",
        json={"domain": "growthops.ai", "limit": 1000},
    )
    assert response.status_code == 400
    detail = response.json()["detail"]
    assert detail["errorCode"] == "invalid_request_bounds"
    assert detail["message"] == "Invalid limit: expected integer between 1 and 25"
    assert detail["field"] == "limit"
    assert detail["reason"] == "range"
    assert detail["received"] == 1000


def test_http_integrations_health(monkeypatch):
    monkeypatch.setenv("ENABLE_APOLLO_CONNECTOR", "true")
    monkeypatch.setenv("ENABLE_CLEARBIT_CONNECTOR", "true")
    monkeypatch.setenv("ENABLE_CRUNCHBASE_CONNECTOR", "false")
    monkeypatch.setenv("CONNECTOR_CREDENTIAL_MAX_AGE_DAYS", "9999")
    monkeypatch.setenv("CONNECTOR_CREDENTIAL_ROTATION_MAX_AGE_DAYS", "9999")
    fake_db = _FakeDb(
        integration_doc={
            "userId": "u1",
            "sendgrid_api_key": "token",
            "sendgrid_configured_at": "2026-02-18T00:00:00+00:00",
            "sendgrid_last_rotated_at": "2026-02-19T00:00:00+00:00",
            "apollo_api_key": "token",
            "apollo_configured_at": "2026-02-20T00:00:00+00:00",
            "apollo_last_rotated_at": "2026-02-21T00:00:00+00:00",
            "clearbit_api_key": "token",
            "clearbit_configured_at": "2026-02-19T00:00:00+00:00",
            "clearbit_last_rotated_at": "2026-02-20T00:00:00+00:00",
        }
    )

    async def fake_sendgrid_health(_api_key, **_kwargs):
        return {"provider": "sendgrid", "healthy": True, "statusCode": 200, "latencyMs": 15, "error": None}

    monkeypatch.setattr(real_integrations, "_health_check_sendgrid", fake_sendgrid_health)
    client = _build_client(monkeypatch, fake_db)
    response = client.get("/api/integrations/integrations/health")
    assert response.status_code == 200
    payload = response.json()
    assert "providers" in payload
    assert payload["status"] == "READY"
    assert payload["healthyCount"] == 3
    assert payload["unhealthyCount"] == 1
    assert payload["actionableUnhealthyProviders"] == []
    assert payload["credentialFreshnessTotalProviders"] == 4
    assert payload["credentialFreshnessActionRequiredCount"] == 0
    assert payload["credentialFreshnessWithinPolicyCount"] == 3
    assert payload["credentialFreshnessUnknownCount"] == 1
    assert payload["credentialFreshnessStatusCounts"] == {
        "ACTION_REQUIRED": 0,
        "READY": 3,
        "UNKNOWN": 1,
    }
    assert payload["credentialFreshnessStatusCountsSource"] == "server"
    assert payload["credentialFreshnessStatusCountsMismatch"] is False
    assert payload["credentialFreshnessStatusCountsServer"] == {
        "ACTION_REQUIRED": 0,
        "READY": 3,
        "UNKNOWN": 1,
    }
    assert payload["credentialFreshnessStatusCountsFallback"] == {
        "ACTION_REQUIRED": 0,
        "READY": 3,
        "UNKNOWN": 1,
    }
    assert "npm run verify:backend:sales:integrations" in payload["recommendedCommands"]
    providers = {p["provider"]: p for p in payload["providers"]}
    freshness_by_provider = payload["credentialFreshnessByProvider"]
    assert providers["sendgrid"]["healthy"] is True
    assert providers["sendgrid"]["configuredAt"] == "2026-02-18T00:00:00+00:00"
    assert providers["sendgrid"]["lastRotatedAt"] == "2026-02-19T00:00:00+00:00"
    assert providers["sendgrid"]["credentialStale"] is False
    assert freshness_by_provider["sendgrid"]["status"] == "READY"
    assert providers["apollo"]["healthy"] is True
    assert providers["clearbit"]["healthy"] is True
    assert providers["crunchbase"]["healthy"] is False
    assert providers["apollo"]["configuredAt"] == "2026-02-20T00:00:00+00:00"
    assert providers["apollo"]["lastRotatedAt"] == "2026-02-21T00:00:00+00:00"
    assert providers["apollo"]["credentialStale"] is False
    assert freshness_by_provider["apollo"]["status"] == "READY"
    assert providers["clearbit"]["configuredAt"] == "2026-02-19T00:00:00+00:00"
    assert providers["clearbit"]["lastRotatedAt"] == "2026-02-20T00:00:00+00:00"
    assert providers["clearbit"]["credentialStale"] is False
    assert freshness_by_provider["clearbit"]["status"] == "READY"
    assert freshness_by_provider["crunchbase"]["status"] == "UNKNOWN"


def test_http_integrations_health_flags_stale_connector_credentials(monkeypatch):
    monkeypatch.setenv("ENABLE_APOLLO_CONNECTOR", "true")
    monkeypatch.setenv("ENABLE_CLEARBIT_CONNECTOR", "false")
    monkeypatch.setenv("ENABLE_CRUNCHBASE_CONNECTOR", "false")
    monkeypatch.setenv("CONNECTOR_CREDENTIAL_MAX_AGE_DAYS", "2")
    monkeypatch.setenv("CONNECTOR_CREDENTIAL_ROTATION_MAX_AGE_DAYS", "2")
    fake_db = _FakeDb(
        integration_doc={
            "userId": "u1",
            "sendgrid_api_key": "token",
            "apollo_api_key": "token",
            "apollo_configured_at": "2020-01-01T00:00:00+00:00",
            "apollo_last_rotated_at": "2020-01-02T00:00:00+00:00",
        }
    )

    async def fake_sendgrid_health(_api_key, **_kwargs):
        return {"provider": "sendgrid", "healthy": True, "statusCode": 200, "latencyMs": 15, "error": None}

    monkeypatch.setattr(real_integrations, "_health_check_sendgrid", fake_sendgrid_health)
    client = _build_client(monkeypatch, fake_db)
    response = client.get("/api/integrations/integrations/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ACTION_REQUIRED"
    assert payload["credentialActionRequiredProviders"] == ["apollo"]
    assert payload["credentialConfiguredMaxAgeDays"] == 2
    assert payload["credentialRotationMaxAgeDays"] == 2
    assert payload["credentialFreshnessActionRequiredCount"] == 1
    assert payload["credentialFreshnessStatusCounts"] == {
        "ACTION_REQUIRED": 1,
        "READY": 0,
        "UNKNOWN": 3,
    }
    assert payload["credentialFreshnessStatusCountsSource"] == "server"
    assert payload["credentialFreshnessStatusCountsMismatch"] is False
    assert payload["credentialFreshnessStatusCountsServer"] == {
        "ACTION_REQUIRED": 1,
        "READY": 0,
        "UNKNOWN": 3,
    }
    assert payload["credentialFreshnessStatusCountsFallback"] == {
        "ACTION_REQUIRED": 1,
        "READY": 0,
        "UNKNOWN": 3,
    }
    providers = {p["provider"]: p for p in payload["providers"]}
    freshness_by_provider = payload["credentialFreshnessByProvider"]
    assert providers["apollo"]["healthy"] is True
    assert providers["apollo"]["credentialStale"] is True
    assert "configured_age_exceeded" in providers["apollo"]["credentialStaleReasons"]
    assert "rotation_age_exceeded" in providers["apollo"]["credentialStaleReasons"]
    assert freshness_by_provider["apollo"]["status"] == "ACTION_REQUIRED"
    assert freshness_by_provider["sendgrid"]["status"] == "UNKNOWN"


def test_http_integrations_health_persists_sendgrid_retry_events_with_request_id(monkeypatch):
    monkeypatch.setenv("ENABLE_APOLLO_CONNECTOR", "false")
    monkeypatch.setenv("ENABLE_CLEARBIT_CONNECTOR", "false")
    monkeypatch.setenv("ENABLE_CRUNCHBASE_CONNECTOR", "false")
    monkeypatch.setenv("CONNECTOR_CREDENTIAL_MAX_AGE_DAYS", "9999")
    monkeypatch.setenv("CONNECTOR_CREDENTIAL_ROTATION_MAX_AGE_DAYS", "9999")
    fake_db = _FakeDb(
        integration_doc={
            "userId": "u1",
            "sendgrid_api_key": "token",
        }
    )

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

        class _Resp:
            status_code = 200

        return _Resp()

    monkeypatch.setattr(real_integrations, "_retry_with_backoff", fake_retry_with_backoff)
    client = _build_client(monkeypatch, fake_db)
    response = client.get(
        "/api/integrations/integrations/health",
        headers={"X-Request-Id": "req-health-retry-http-1"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "READY"
    assert len(fake_db.integration_telemetry.inserted) == 1
    telemetry_event = fake_db.integration_telemetry.inserted[0]
    assert telemetry_event["eventType"] == "integrations_retry_attempt"
    assert telemetry_event["payload"]["operation"] == "sendgrid_health_check"
    assert telemetry_event["payload"]["provider"] == "sendgrid"
    assert telemetry_event["payload"]["request_id"] == "req-health-retry-http-1"


def test_http_integrations_health_persists_sendgrid_retry_terminal_event_with_request_id(
    monkeypatch,
):
    monkeypatch.setenv("ENABLE_APOLLO_CONNECTOR", "false")
    monkeypatch.setenv("ENABLE_CLEARBIT_CONNECTOR", "false")
    monkeypatch.setenv("ENABLE_CRUNCHBASE_CONNECTOR", "false")
    monkeypatch.setenv("CONNECTOR_CREDENTIAL_MAX_AGE_DAYS", "9999")
    monkeypatch.setenv("CONNECTOR_CREDENTIAL_ROTATION_MAX_AGE_DAYS", "9999")
    fake_db = _FakeDb(
        integration_doc={
            "userId": "u1",
            "sendgrid_api_key": "token",
        }
    )

    async def fake_retry_with_backoff(operation, **kwargs):
        terminal_callback = kwargs.get("on_retry_terminal_event")
        assert terminal_callback is not None
        await terminal_callback(
            "integrations_retry_exhausted",
            {
                "operation": "sendgrid_health_check",
                "provider": "sendgrid",
                "attempt": 3,
                "max_attempts": 3,
                "error": "503 temporarily unavailable",
                "retryable": True,
                "final_outcome": "retry_exhausted",
                "error_reason_code": "http_503",
                "error_type": "Exception",
                "error_status_code": 503,
            },
        )
        raise Exception("503 temporarily unavailable")

    monkeypatch.setattr(real_integrations, "_retry_with_backoff", fake_retry_with_backoff)
    client = _build_client(monkeypatch, fake_db)
    response = client.get(
        "/api/integrations/integrations/health",
        headers={"X-Request-Id": "req-health-retry-http-terminal-1"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ACTION_REQUIRED"
    assert len(fake_db.integration_telemetry.inserted) == 1
    telemetry_event = fake_db.integration_telemetry.inserted[0]
    assert telemetry_event["eventType"] == "integrations_retry_exhausted"
    assert telemetry_event["payload"]["operation"] == "sendgrid_health_check"
    assert telemetry_event["payload"]["provider"] == "sendgrid"
    assert telemetry_event["payload"]["final_outcome"] == "retry_exhausted"
    assert telemetry_event["payload"]["error_reason_code"] == "http_503"
    assert telemetry_event["payload"]["error_status_code"] == 503
    assert telemetry_event["payload"]["request_id"] == "req-health-retry-http-terminal-1"


def test_http_integrations_telemetry_summary(monkeypatch):
    recent_base = datetime.now(timezone.utc).replace(microsecond=0)
    telemetry_created_at_1 = (recent_base - timedelta(minutes=7)).isoformat()
    telemetry_created_at_2 = (recent_base - timedelta(minutes=6)).isoformat()
    telemetry_created_at_3 = (recent_base - timedelta(minutes=5)).isoformat()
    telemetry_created_at_4 = (recent_base - timedelta(minutes=4)).isoformat()
    fake_db = _FakeDb(
        integration_doc={"userId": "u1"},
        telemetry_docs=[
            {
                "id": "t1",
                "userId": "u1",
                "provider": "apollo",
                "eventType": "apollo_search_success",
                "schemaVersion": 1,
                "payload": {"result_count": 2, "saved_count": 2},
                "createdAt": telemetry_created_at_1,
            },
            {
                "id": "t2",
                "userId": "u1",
                "provider": "sendgrid",
                "eventType": "sendgrid_send_error",
                "schemaVersion": 1,
                "payload": {"error": "timeout"},
                "createdAt": telemetry_created_at_2,
            },
            {
                "id": "t3",
                "userId": "u1",
                "provider": "sales_intelligence",
                "eventType": "sales_pipeline_forecast_generated",
                "schemaVersion": 2,
                "payload": {
                    "open_pipeline_value": 10000,
                    "schema_version": 2,
                    "request_id": "req-sales-intel-99",
                },
                "createdAt": telemetry_created_at_3,
            },
            {
                "id": "t4",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "integrations_traceability_status_evaluated",
                "payload": {
                    "decision": "HOLD",
                    "traceability_ready": False,
                    "request_id": "req-traceability-99",
                    "governance_packet_validation_status": "ACTION_REQUIRED",
                    "governance_packet_validation_within_freshness": False,
                },
                "createdAt": telemetry_created_at_4,
            },
        ],
    )
    client = _build_client(monkeypatch, fake_db)
    response = client.get("/api/integrations/integrations/telemetry/summary?days=30&limit=500")
    assert response.status_code == 200
    payload = response.json()
    assert payload["eventCount"] == 4
    assert payload["errorEventCount"] == 1
    assert payload["byProvider"]["apollo"] == 1
    assert payload["byProvider"]["sendgrid"] == 1
    assert payload["byProvider"]["sales_intelligence"] == 1
    assert payload["byProvider"]["integrations"] == 1
    assert payload["bySchemaVersion"]["1"] == 2
    assert payload["bySchemaVersion"]["2"] == 1
    assert payload["bySchemaVersion"]["unknown"] == 1
    assert payload["salesIntelligence"]["eventCount"] == 1
    assert payload["salesIntelligence"]["byEventFamily"]["forecast"] == 1
    assert payload["salesIntelligence"]["bySchemaVersion"]["2"] == 1
    assert payload["traceabilityAudit"]["eventCount"] == 1
    assert payload["traceabilityAudit"]["decisionCounts"]["HOLD"] == 1
    assert payload["traceabilityAudit"]["readyCount"] == 0
    assert payload["traceabilityAudit"]["notReadyCount"] == 1
    assert payload["traceabilityAudit"]["latestEvaluatedAt"] == telemetry_created_at_4
    assert payload["governanceAudit"]["eventCount"] == 0
    assert payload["governanceAudit"]["snapshotEvaluationCount"] == 0
    assert payload["governanceAudit"]["baselineEvaluationCount"] == 0
    assert payload["governanceAudit"]["statusCounts"] == {}
    assert payload["governanceSchemaAudit"]["eventCount"] == 0
    assert payload["governanceSchemaAudit"]["statusCounts"] == {}
    assert payload["governanceSchemaAudit"]["reasonCodeParityPassCount"] == 0
    assert payload["governanceSchemaAudit"]["reasonCodeParityFailCount"] == 0
    assert payload["governanceSchemaAudit"]["recommendedCommandParityPassCount"] == 0
    assert payload["governanceSchemaAudit"]["recommendedCommandParityFailCount"] == 0
    assert payload["governanceSchemaAudit"]["handoffParityPassCount"] == 0
    assert payload["governanceSchemaAudit"]["handoffParityFailCount"] == 0
    assert payload["governanceSchemaAudit"]["allParityPassedCount"] == 0
    assert payload["governanceSchemaAudit"]["allParityFailedCount"] == 0
    assert payload["governanceSchemaAudit"]["rolloutBlockedCount"] == 0
    assert payload["governanceSchemaAudit"]["latestEvaluatedAt"] is None
    assert payload["packetValidationAudit"]["eventCount"] == 1
    assert payload["packetValidationAudit"]["statusCounts"]["ACTION_REQUIRED"] == 1
    assert payload["packetValidationAudit"]["withinFreshnessCount"] == 0
    assert payload["packetValidationAudit"]["outsideFreshnessCount"] == 1
    assert payload["packetValidationAudit"]["missingFreshnessCount"] == 0
    assert (
        payload["packetValidationAudit"]["latestEvaluatedAt"]
        == telemetry_created_at_4
    )
    assert len(payload["trendByDay"]) == 1
    assert payload["trendByDay"][0]["events"] == 4
    assert payload["trendByDay"][0]["errors"] == 1
    assert payload["trendByDay"][0]["orchestrationEvents"] == 0
    assert len(payload["salesIntelligence"]["trendByDay"]) == 1
    assert payload["salesIntelligence"]["trendByDay"][0]["forecast"] == 1
    assert payload["recentEvents"][0]["schemaVersion"] is None
    assert payload["recentEvents"][0]["requestId"] == "req-traceability-99"
    assert payload["recentEvents"][0]["traceabilityDecision"] == "HOLD"
    assert payload["recentEvents"][0]["traceabilityReady"] is False
    assert payload["recentEvents"][0]["governanceStatus"] is None
    assert payload["recentEvents"][0]["governanceSchemaReasonCodeParityOk"] is None
    assert payload["recentEvents"][0]["governanceSchemaRecommendedCommandParityOk"] is None
    assert payload["recentEvents"][0]["governanceSchemaHandoffParityOk"] is None
    assert payload["recentEvents"][0]["governanceSchemaAllParityOk"] is None
    assert payload["recentEvents"][0]["governanceSchemaRolloutBlocked"] is None
    assert payload["recentEvents"][0]["governanceSchemaReasonCodeCount"] is None
    assert payload["recentEvents"][0]["governanceSchemaRecommendedCommandCount"] is None
    assert payload["recentEvents"][0]["governancePacketValidationStatus"] == "ACTION_REQUIRED"
    assert payload["recentEvents"][0]["governancePacketValidationWithinFreshness"] is False


def test_http_integrations_telemetry_summary_exposes_retry_terminal_fields(monkeypatch):
    recent_created_at = (datetime.now(timezone.utc) - timedelta(hours=6)).isoformat()
    fake_db = _FakeDb(
        integration_doc={"userId": "u1"},
        telemetry_docs=[
            {
                "id": "r1",
                "userId": "u1",
                "provider": "sendgrid",
                "eventType": "integrations_retry_exhausted",
                "payload": {
                    "operation": "sendgrid_health_check",
                    "attempt": 3,
                    "max_attempts": 3,
                    "error": "503 temporarily unavailable",
                    "final_outcome": "retry_exhausted",
                    "retryable": True,
                    "error_type": "Exception",
                    "error_status_code": 503,
                    "error_reason_code": "http_503",
                },
                "createdAt": recent_created_at,
            }
        ],
    )
    client = _build_client(monkeypatch, fake_db)
    response = client.get("/api/integrations/integrations/telemetry/summary?days=7&limit=500")
    assert response.status_code == 200
    payload = response.json()
    assert payload["eventCount"] == 1
    assert payload["recentEvents"][0]["retryOperation"] == "sendgrid_health_check"
    assert payload["recentEvents"][0]["retryAttempt"] == 3
    assert payload["recentEvents"][0]["retryMaxAttempts"] == 3
    assert payload["recentEvents"][0]["retryError"] == "503 temporarily unavailable"
    assert payload["recentEvents"][0]["retryFinalOutcome"] == "retry_exhausted"
    assert payload["recentEvents"][0]["retryRetryable"] is True
    assert payload["recentEvents"][0]["retryErrorType"] == "Exception"
    assert payload["recentEvents"][0]["retryErrorStatusCode"] == 503
    assert payload["recentEvents"][0]["retryErrorReasonCode"] == "http_503"


def test_http_integrations_telemetry_summary_includes_governance_schema_audit_rollup(
    monkeypatch,
):
    recent_base = datetime.now(timezone.utc).replace(microsecond=0)
    schema_created_at_1 = (recent_base - timedelta(minutes=6)).isoformat()
    schema_created_at_2 = (recent_base - timedelta(minutes=5)).isoformat()
    fake_db = _FakeDb(
        integration_doc={"userId": "u1"},
        telemetry_docs=[
            {
                "id": "gs1",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "integrations_traceability_governance_schema_viewed",
                "payload": {
                    "status": "READY",
                    "rollout_blocked": False,
                    "reason_codes": ["schema_ready"],
                    "reason_code_count": 1,
                    "recommended_commands": ["npm run verify:governance:schema:preflight"],
                    "recommended_command_count": 1,
                    "reason_code_parity_ok": True,
                    "recommended_command_parity_ok": True,
                    "handoff_parity_ok": True,
                    "request_id": "req-schema-http-1",
                },
                "createdAt": schema_created_at_1,
            },
            {
                "id": "gs2",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "integrations_traceability_governance_schema_viewed",
                "payload": {
                    "status": "ACTION_REQUIRED",
                    "rollout_blocked": True,
                    "reason_codes": ["schema_override_invalid"],
                    "reason_code_count": 1,
                    "recommended_commands": ["npm run verify:ci:sales:extended"],
                    "recommended_command_count": 1,
                    "reason_code_parity_ok": False,
                    "recommended_command_parity_ok": False,
                    "handoff_parity_ok": False,
                    "request_id": "req-schema-http-2",
                },
                "createdAt": schema_created_at_2,
            },
        ],
    )
    client = _build_client(monkeypatch, fake_db)
    response = client.get("/api/integrations/integrations/telemetry/summary?days=30&limit=500")
    assert response.status_code == 200
    payload = response.json()
    assert payload["eventCount"] == 2
    assert payload["governanceSchemaAudit"]["eventCount"] == 2
    assert payload["governanceSchemaAudit"]["statusCounts"]["READY"] == 1
    assert payload["governanceSchemaAudit"]["statusCounts"]["ACTION_REQUIRED"] == 1
    assert payload["governanceSchemaAudit"]["reasonCodeParityPassCount"] == 1
    assert payload["governanceSchemaAudit"]["reasonCodeParityFailCount"] == 1
    assert payload["governanceSchemaAudit"]["recommendedCommandParityPassCount"] == 1
    assert payload["governanceSchemaAudit"]["recommendedCommandParityFailCount"] == 1
    assert payload["governanceSchemaAudit"]["handoffParityPassCount"] == 1
    assert payload["governanceSchemaAudit"]["handoffParityFailCount"] == 1
    assert payload["governanceSchemaAudit"]["allParityPassedCount"] == 1
    assert payload["governanceSchemaAudit"]["allParityFailedCount"] == 1
    assert payload["governanceSchemaAudit"]["rolloutBlockedCount"] == 1
    assert (
        payload["governanceSchemaAudit"]["latestEvaluatedAt"]
        == schema_created_at_2
    )
    assert payload["recentEvents"][0]["requestId"] == "req-schema-http-2"
    assert payload["recentEvents"][0]["governanceSchemaReasonCodeParityOk"] is False
    assert (
        payload["recentEvents"][0]["governanceSchemaRecommendedCommandParityOk"] is False
    )
    assert payload["recentEvents"][0]["governanceSchemaHandoffParityOk"] is False
    assert payload["recentEvents"][0]["governanceSchemaAllParityOk"] is False
    assert payload["recentEvents"][0]["governanceSchemaRolloutBlocked"] is True
    assert payload["recentEvents"][0]["governanceSchemaReasonCodeCount"] == 1
    assert payload["recentEvents"][0]["governanceSchemaRecommendedCommandCount"] == 1
    assert payload["recentEvents"][1]["requestId"] == "req-schema-http-1"
    assert payload["recentEvents"][1]["governanceSchemaReasonCodeParityOk"] is True
    assert (
        payload["recentEvents"][1]["governanceSchemaRecommendedCommandParityOk"] is True
    )
    assert payload["recentEvents"][1]["governanceSchemaHandoffParityOk"] is True
    assert payload["recentEvents"][1]["governanceSchemaAllParityOk"] is True
    assert payload["recentEvents"][1]["governanceSchemaRolloutBlocked"] is False


def test_http_integrations_telemetry_summary_normalizes_malformed_governance_schema_recent_event_fields(
    monkeypatch,
):
    schema_malformed_created_at = (
        datetime.now(timezone.utc).replace(microsecond=0) - timedelta(minutes=5)
    ).isoformat()
    fake_db = _FakeDb(
        integration_doc={"userId": "u1"},
        telemetry_docs=[
            {
                "id": "gs-malformed-http-1",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "integrations_traceability_governance_schema_viewed",
                "payload": {
                    "status": "READY",
                    "rollout_blocked": "true",
                    "reason_code_count": True,
                    "recommended_command_count": " 2 ",
                    "reason_code_parity_ok": "false",
                    "recommended_command_parity_ok": 0,
                    "handoff_parity_ok": "no",
                    "request_id": "req-schema-http-malformed",
                },
                "createdAt": schema_malformed_created_at,
            },
        ],
    )
    client = _build_client(monkeypatch, fake_db)
    response = client.get("/api/integrations/integrations/telemetry/summary?days=30&limit=500")
    assert response.status_code == 200
    payload = response.json()
    assert payload["eventCount"] == 1
    assert payload["governanceSchemaAudit"]["eventCount"] == 1
    assert payload["governanceSchemaAudit"]["reasonCodeParityPassCount"] == 0
    assert payload["governanceSchemaAudit"]["reasonCodeParityFailCount"] == 0
    assert payload["governanceSchemaAudit"]["recommendedCommandParityPassCount"] == 0
    assert payload["governanceSchemaAudit"]["recommendedCommandParityFailCount"] == 0
    assert payload["governanceSchemaAudit"]["handoffParityPassCount"] == 0
    assert payload["governanceSchemaAudit"]["handoffParityFailCount"] == 0
    assert payload["governanceSchemaAudit"]["allParityPassedCount"] == 0
    assert payload["governanceSchemaAudit"]["allParityFailedCount"] == 0
    assert payload["governanceSchemaAudit"]["rolloutBlockedCount"] == 0
    assert payload["recentEvents"][0]["requestId"] == "req-schema-http-malformed"
    assert payload["recentEvents"][0]["governanceSchemaReasonCodeParityOk"] is None
    assert (
        payload["recentEvents"][0]["governanceSchemaRecommendedCommandParityOk"] is None
    )
    assert payload["recentEvents"][0]["governanceSchemaHandoffParityOk"] is None
    assert payload["recentEvents"][0]["governanceSchemaAllParityOk"] is None
    assert payload["recentEvents"][0]["governanceSchemaRolloutBlocked"] is None
    assert payload["recentEvents"][0]["governanceSchemaReasonCodeCount"] is None
    assert payload["recentEvents"][0]["governanceSchemaRecommendedCommandCount"] == 2


def test_http_integrations_telemetry_summary_normalizes_governance_and_packet_status_tokens(
    monkeypatch,
):
    recent_base = datetime.now(timezone.utc).replace(microsecond=0)
    status_created_at_1 = (recent_base - timedelta(minutes=7)).isoformat()
    status_created_at_2 = (recent_base - timedelta(minutes=6)).isoformat()
    status_created_at_3 = (recent_base - timedelta(minutes=5)).isoformat()
    status_created_at_4 = (recent_base - timedelta(minutes=4)).isoformat()
    fake_db = _FakeDb(
        integration_doc={"userId": "u1"},
        telemetry_docs=[
            {
                "id": "status-http-1",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "integrations_traceability_snapshot_governance_evaluated",
                "payload": {"status": " ready "},
                "createdAt": status_created_at_1,
            },
            {
                "id": "status-http-2",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "integrations_traceability_baseline_governance_evaluated",
                "payload": {
                    "status": {"invalid": "value"},
                    "request_id": "req-http-status-normalized",
                    "governance_packet_validation_status": " action required ",
                    "governance_packet_validation_within_freshness": False,
                },
                "createdAt": status_created_at_2,
            },
            {
                "id": "status-http-3",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "integrations_traceability_governance_schema_viewed",
                "payload": {"status": " action required "},
                "createdAt": status_created_at_3,
            },
            {
                "id": "status-http-4",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "integrations_traceability_status_evaluated",
                "payload": {
                    "request_id": "req-http-status-unknown",
                    "governance_packet_validation_status": " !!! ",
                    "governance_packet_validation_within_freshness": True,
                },
                "createdAt": status_created_at_4,
            },
        ],
    )
    client = _build_client(monkeypatch, fake_db)
    response = client.get("/api/integrations/integrations/telemetry/summary?days=30&limit=500")
    assert response.status_code == 200
    payload = response.json()
    assert payload["eventCount"] == 4
    assert payload["governanceAudit"]["eventCount"] == 2
    assert payload["governanceAudit"]["statusCounts"]["READY"] == 1
    assert payload["governanceAudit"]["statusCounts"]["UNKNOWN"] == 1
    assert payload["governanceSchemaAudit"]["eventCount"] == 1
    assert payload["governanceSchemaAudit"]["statusCounts"]["ACTION_REQUIRED"] == 1
    assert payload["packetValidationAudit"]["eventCount"] == 2
    assert payload["packetValidationAudit"]["statusCounts"]["ACTION_REQUIRED"] == 1
    assert payload["packetValidationAudit"]["statusCounts"]["UNKNOWN"] == 1
    assert payload["packetValidationAudit"]["withinFreshnessCount"] == 1
    assert payload["packetValidationAudit"]["outsideFreshnessCount"] == 1
    assert payload["packetValidationAudit"]["missingFreshnessCount"] == 0

    recent_by_request_id = {
        event.get("requestId"): event for event in payload["recentEvents"]
    }
    assert (
        recent_by_request_id["req-http-status-normalized"][
            "governancePacketValidationStatus"
        ]
        == "ACTION_REQUIRED"
    )
    assert recent_by_request_id["req-http-status-normalized"]["governanceStatus"] is None
    assert (
        recent_by_request_id["req-http-status-unknown"]["governancePacketValidationStatus"]
        is None
    )
    assert recent_by_request_id["req-http-status-unknown"]["governanceStatus"] is None
    governance_status_values = sorted(
        {
            event.get("governanceStatus")
            for event in payload["recentEvents"]
            if event.get("governanceStatus") is not None
        }
    )
    assert governance_status_values == ["ACTION_REQUIRED", "READY"]


def test_http_integrations_telemetry_summary_includes_connector_lifecycle_rollup(monkeypatch):
    recent_base = datetime.now(timezone.utc).replace(microsecond=0)
    lifecycle_created_at_1 = (recent_base - timedelta(minutes=5)).isoformat()
    lifecycle_created_at_2 = (recent_base - timedelta(minutes=4)).isoformat()
    fake_db = _FakeDb(
        integration_doc={"userId": "u1"},
        telemetry_docs=[
            {
                "id": "cl1",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "integrations_connector_credential_saved",
                "payload": {
                    "provider": "apollo",
                    "action": "saved",
                    "key_rotated": True,
                    "request_id": "req-save",
                },
                "createdAt": lifecycle_created_at_1,
            },
            {
                "id": "cl2",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "integrations_connector_credential_removed",
                "payload": {
                    "provider": "clearbit",
                    "action": "removed",
                    "request_id": "req-remove",
                },
                "createdAt": lifecycle_created_at_2,
            },
        ],
    )
    client = _build_client(monkeypatch, fake_db)
    response = client.get("/api/integrations/integrations/telemetry/summary?days=30&limit=500")
    assert response.status_code == 200
    payload = response.json()
    assert payload["eventCount"] == 2
    assert payload["connectorLifecycle"]["eventCount"] == 2
    assert payload["connectorLifecycle"]["byAction"]["saved"] == 1
    assert payload["connectorLifecycle"]["byAction"]["removed"] == 1
    assert payload["connectorLifecycle"]["byProvider"]["apollo"]["saved"] == 1
    assert payload["connectorLifecycle"]["byProvider"]["apollo"]["removed"] == 0
    assert payload["connectorLifecycle"]["byProvider"]["clearbit"]["saved"] == 0
    assert payload["connectorLifecycle"]["byProvider"]["clearbit"]["removed"] == 1
    assert payload["connectorLifecycle"]["latestEventAt"] == lifecycle_created_at_2
    assert payload["recentEvents"][0]["connectorCredentialProvider"] == "clearbit"
    assert payload["recentEvents"][0]["connectorCredentialAction"] == "removed"


def test_http_integrations_telemetry_summary_includes_retry_audit_rollup(monkeypatch):
    recent_base = datetime.now(timezone.utc).replace(microsecond=0)
    retry_created_at_1 = (recent_base - timedelta(minutes=6)).isoformat()
    retry_created_at_2 = (recent_base - timedelta(minutes=5)).isoformat()
    retry_created_at_3 = (recent_base - timedelta(minutes=4)).isoformat()
    fake_db = _FakeDb(
        integration_doc={"userId": "u1"},
        telemetry_docs=[
            {
                "id": "ra1",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "integrations_retry_attempt",
                "payload": {
                    "operation": "sendgrid_send_email",
                    "provider": "sendgrid",
                    "attempt": 1,
                    "max_attempts": 3,
                    "next_delay_seconds": 0.5,
                    "error": "503 temporarily unavailable",
                    "request_id": "req-retry-1",
                },
                "createdAt": retry_created_at_1,
            },
            {
                "id": "ra2",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "integrations_retry_attempt",
                "payload": {
                    "operation": "sendgrid_send_email",
                    "provider": "sendgrid",
                    "attempt": 2,
                    "max_attempts": 3,
                    "next_delay_seconds": 1.0,
                    "error": "503 temporarily unavailable",
                    "request_id": "req-retry-1",
                },
                "createdAt": retry_created_at_2,
            },
            {
                "id": "ra3",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "integrations_retry_attempt",
                "payload": {
                    "operation": "sendgrid_health_check",
                    "provider": "sendgrid",
                    "attempt": 1,
                    "max_attempts": 3,
                    "next_delay_seconds": 0.2,
                    "error": "timeout",
                    "request_id": "req-retry-2",
                },
                "createdAt": retry_created_at_3,
            },
        ],
    )
    client = _build_client(monkeypatch, fake_db)
    response = client.get("/api/integrations/integrations/telemetry/summary?days=30&limit=500")
    assert response.status_code == 200
    payload = response.json()
    assert payload["eventCount"] == 3
    assert payload["retryAudit"]["eventCount"] == 3
    assert payload["retryAudit"]["byOperation"]["sendgrid_send_email"] == 2
    assert payload["retryAudit"]["byOperation"]["sendgrid_health_check"] == 1
    assert payload["retryAudit"]["byProvider"]["sendgrid"] == 3
    assert payload["retryAudit"]["maxNextDelaySeconds"] == 1.0
    assert payload["retryAudit"]["avgNextDelaySeconds"] == 0.567
    assert payload["retryAudit"]["latestEventAt"] == retry_created_at_3
    assert payload["recentEvents"][0]["retryOperation"] == "sendgrid_health_check"
    assert payload["recentEvents"][0]["retryAttempt"] == 1
    assert payload["recentEvents"][0]["retryMaxAttempts"] == 3
    assert payload["recentEvents"][0]["retryNextDelaySeconds"] == 0.2
    assert payload["recentEvents"][0]["retryError"] == "timeout"


def test_http_integrations_telemetry_summary_includes_orchestration_audit_rollup(monkeypatch):
    recent_base = datetime.now(timezone.utc).replace(microsecond=0)
    orchestration_created_at_1 = (recent_base - timedelta(minutes=6)).isoformat()
    orchestration_created_at_2 = (recent_base - timedelta(minutes=5)).isoformat()
    fake_db = _FakeDb(
        integration_doc={"userId": "u1"},
        telemetry_docs=[
            {
                "id": "oa1",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "company_enrichment_orchestrated",
                "payload": {
                    "selected_provider": "apollo",
                    "attempt_count": 2,
                    "attempt_success_count": 1,
                    "attempt_skipped_count": 1,
                    "attempt_error_count": 0,
                    "attempt_reason_codes": {"success": 1, "domain_required": 1},
                    "latency_ms": 80.0,
                    "result_count": 2,
                    "request_id": "req-orch-http-1",
                },
                "createdAt": orchestration_created_at_1,
            },
            {
                "id": "oa2",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "company_enrichment_orchestrated",
                "payload": {
                    "selected_provider": "clearbit",
                    "attempt_success_count": 0,
                    "attempt_skipped_count": 0,
                    "attempt_error_count": 1,
                    "attempt_reason_codes": {"provider_http_error": 1},
                    "latency_ms": 30.0,
                    "result_count": 0,
                    "request_id": "req-orch-http-2",
                },
                "createdAt": orchestration_created_at_2,
            },
        ],
    )
    client = _build_client(monkeypatch, fake_db)
    response = client.get("/api/integrations/integrations/telemetry/summary?days=30&limit=500")
    assert response.status_code == 200
    payload = response.json()
    assert payload["eventCount"] == 2
    assert payload["orchestrationAudit"]["eventCount"] == 2
    assert payload["orchestrationAudit"]["bySelectedProvider"]["apollo"] == 1
    assert payload["orchestrationAudit"]["bySelectedProvider"]["clearbit"] == 1
    assert payload["orchestrationAudit"]["attemptStatusCounts"]["success"] == 1
    assert payload["orchestrationAudit"]["attemptStatusCounts"]["skipped"] == 1
    assert payload["orchestrationAudit"]["attemptStatusCounts"]["error"] == 1
    assert payload["orchestrationAudit"]["reasonCodeCounts"]["success"] == 1
    assert payload["orchestrationAudit"]["reasonCodeCounts"]["domain_required"] == 1
    assert payload["orchestrationAudit"]["reasonCodeCounts"]["provider_http_error"] == 1
    assert payload["orchestrationAudit"]["maxAttemptCount"] == 2
    assert payload["orchestrationAudit"]["avgAttemptCount"] == 1.5
    assert payload["orchestrationAudit"]["maxLatencyMs"] == 80.0
    assert payload["orchestrationAudit"]["avgLatencyMs"] == 55.0
    assert len(payload["orchestrationAudit"]["trendByDay"]) == 1
    assert (
        payload["orchestrationAudit"]["trendByDay"][0]["date"]
        == orchestration_created_at_1.split("T")[0]
    )
    assert payload["orchestrationAudit"]["trendByDay"][0]["events"] == 2
    assert payload["orchestrationAudit"]["trendByDay"][0]["attemptSuccessCount"] == 1
    assert payload["orchestrationAudit"]["trendByDay"][0]["attemptSkippedCount"] == 1
    assert payload["orchestrationAudit"]["trendByDay"][0]["attemptErrorCount"] == 1
    assert payload["orchestrationAudit"]["latestEventAt"] == orchestration_created_at_2
    assert payload["trendByDay"][0]["orchestrationEvents"] == 2
    assert payload["recentEvents"][0]["orchestrationSelectedProvider"] == "clearbit"
    assert payload["recentEvents"][0]["orchestrationAttemptCount"] is None
    assert payload["recentEvents"][0]["orchestrationAttemptSuccessCount"] == 0
    assert payload["recentEvents"][0]["orchestrationAttemptSkippedCount"] == 0
    assert payload["recentEvents"][0]["orchestrationAttemptErrorCount"] == 1
    assert payload["recentEvents"][0]["orchestrationResultCount"] == 0
    assert payload["recentEvents"][1]["orchestrationSelectedProvider"] == "apollo"
    assert payload["recentEvents"][1]["orchestrationAttemptCount"] == 2


def test_http_integrations_telemetry_summary_includes_connector_rate_limit_rollup(monkeypatch):
    recent_base = datetime.now(timezone.utc).replace(microsecond=0)
    rate_limit_created_at_1 = (recent_base - timedelta(minutes=5)).isoformat()
    rate_limit_created_at_2 = (recent_base - timedelta(minutes=4)).isoformat()
    fake_db = _FakeDb(
        integration_doc={"userId": "u1"},
        telemetry_docs=[
            {
                "id": "rl1",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "integrations_connector_rate_limited",
                "payload": {
                    "endpoint": "apollo_search",
                    "window_seconds": 60,
                    "max_requests": 1,
                    "retry_after_seconds": 40,
                    "reset_in_seconds": 39,
                },
                "createdAt": rate_limit_created_at_1,
            },
            {
                "id": "rl2",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "integrations_connector_rate_limited",
                "payload": {
                    "endpoint": "company_enrichment_orchestration",
                    "window_seconds": 60,
                    "max_requests": 1,
                    "retry_after_seconds": 35,
                    "reset_in_seconds": 34,
                },
                "createdAt": rate_limit_created_at_2,
            },
        ],
    )
    client = _build_client(monkeypatch, fake_db)
    response = client.get("/api/integrations/integrations/telemetry/summary?days=30&limit=500")
    assert response.status_code == 200
    payload = response.json()
    assert payload["eventCount"] == 2
    assert payload["connectorRateLimit"]["eventCount"] == 2
    assert payload["connectorRateLimit"]["byEndpoint"]["apollo_search"] == 1
    assert payload["connectorRateLimit"]["byEndpoint"]["company_enrichment_orchestration"] == 1
    assert payload["connectorRateLimit"]["maxRetryAfterSeconds"] == 40
    assert payload["connectorRateLimit"]["avgRetryAfterSeconds"] == 37.5
    assert payload["connectorRateLimit"]["maxResetInSeconds"] == 39
    assert payload["connectorRateLimit"]["avgResetInSeconds"] == 36.5
    assert payload["connectorRateLimit"]["latestEventAt"] == rate_limit_created_at_2
    assert payload["recentEvents"][0]["connectorRateLimitEndpoint"] == "company_enrichment_orchestration"
    assert payload["recentEvents"][0]["connectorRateLimitRetryAfterSeconds"] == 35
    assert payload["recentEvents"][0]["connectorRateLimitResetInSeconds"] == 34


def test_http_integrations_telemetry_summary_connector_rate_limit_rollup_handles_sparse_payloads(
    monkeypatch,
):
    recent_base = datetime.now(timezone.utc).replace(microsecond=0)
    sparse_rate_limit_created_at_1 = (recent_base - timedelta(minutes=5)).isoformat()
    sparse_rate_limit_created_at_2 = (recent_base - timedelta(minutes=4)).isoformat()
    fake_db = _FakeDb(
        integration_doc={"userId": "u1"},
        telemetry_docs=[
            {
                "id": "rlsparse1",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "integrations_connector_rate_limited",
                "payload": {
                    "endpoint": "",
                    "window_seconds": "bad-window",
                    "max_requests": None,
                    "retry_after_seconds": "not-a-number",
                    "reset_in_seconds": "not-a-number",
                },
                "createdAt": sparse_rate_limit_created_at_1,
            },
            {
                "id": "rlsparse2",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "integrations_connector_rate_limited",
                "payload": {
                    "retry_after_seconds": "8",
                },
                "createdAt": sparse_rate_limit_created_at_2,
            },
        ],
    )
    client = _build_client(monkeypatch, fake_db)
    response = client.get("/api/integrations/integrations/telemetry/summary?days=30&limit=500")
    assert response.status_code == 200
    payload = response.json()
    assert payload["eventCount"] == 2
    assert payload["connectorRateLimit"]["eventCount"] == 2
    assert payload["connectorRateLimit"]["byEndpoint"]["unknown"] == 2
    assert payload["connectorRateLimit"]["maxRetryAfterSeconds"] == 8
    assert payload["connectorRateLimit"]["avgRetryAfterSeconds"] == 8.0
    assert payload["connectorRateLimit"]["maxResetInSeconds"] == 8
    assert payload["connectorRateLimit"]["avgResetInSeconds"] == 8.0
    assert (
        payload["connectorRateLimit"]["latestEventAt"] == sparse_rate_limit_created_at_2
    )


def test_http_integrations_telemetry_summary_includes_sendgrid_webhook_timestamp_rollup(
    monkeypatch,
):
    recent_base = datetime.now(timezone.utc).replace(microsecond=0)
    sendgrid_rollup_created_at_1 = (recent_base - timedelta(minutes=5)).isoformat()
    sendgrid_rollup_created_at_2 = (recent_base - timedelta(minutes=4)).isoformat()
    fake_db = _FakeDb(
        integration_doc={"userId": "u1"},
        telemetry_docs=[
            {
                "id": "sg-http-ts-1",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "sendgrid_webhook_processed",
                "payload": {
                    "timestamp_pressure_label": "High",
                    "timestamp_pressure_hint": "High anomaly pressure",
                    "timestamp_anomaly_count": 4,
                    "timestamp_anomaly_rate_pct": 50.0,
                    "timestamp_fallback_count": 1,
                    "future_skew_event_count": 1,
                    "stale_event_count": 2,
                    "fresh_event_count": 3,
                    "timestamp_age_bucket_counts": {
                        "stale": 2,
                        "future_skew": 1,
                        "fresh_lt_1h": 3,
                    },
                    "timestamp_anomaly_event_type_counts": {
                        "open": 2,
                        "click": 1,
                    },
                    "timestamp_dominant_anomaly_bucket": "stale",
                    "timestamp_dominant_anomaly_event_type": "open",
                    "timestamp_pressure_high_anomaly_rate_pct": 20.0,
                    "timestamp_pressure_moderate_anomaly_rate_pct": 5.0,
                    "timestamp_pressure_high_anomaly_count": 10,
                    "timestamp_pressure_moderate_anomaly_count": 3,
                    "request_id": "req-sg-http-1",
                },
                "createdAt": sendgrid_rollup_created_at_1,
            },
            {
                "id": "sg-http-ts-2",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "sendgrid_webhook_processed",
                "payload": {
                    "timestamp_pressure_label": "Moderate",
                    "timestamp_pressure_hint": "Moderate anomaly pressure",
                    "timestamp_anomaly_count": 2,
                    "timestamp_anomaly_rate_pct": 10.0,
                    "timestamp_fallback_count": 1,
                    "future_skew_event_count": 1,
                    "stale_event_count": 0,
                    "fresh_event_count": 4,
                    "timestamp_age_bucket_counts": {
                        "future_skew": 1,
                        "fallback": 1,
                    },
                    "timestamp_anomaly_event_type_counts": {"processed": 1},
                    "timestamp_dominant_anomaly_bucket": "future_skew",
                    "timestamp_dominant_anomaly_event_type": "processed",
                    "timestamp_pressure_high_anomaly_rate_pct": 20.0,
                    "timestamp_pressure_moderate_anomaly_rate_pct": 5.0,
                    "timestamp_pressure_high_anomaly_count": 10,
                    "timestamp_pressure_moderate_anomaly_count": 3,
                    "request_id": "req-sg-http-2",
                },
                "createdAt": sendgrid_rollup_created_at_2,
            },
        ],
    )
    client = _build_client(monkeypatch, fake_db)
    response = client.get("/api/integrations/integrations/telemetry/summary?days=30&limit=500")
    assert response.status_code == 200
    payload = response.json()
    assert payload["eventCount"] == 2
    rollup = payload["sendgridWebhookTimestamp"]
    assert rollup["eventCount"] == 2
    assert rollup["pressureLabelCounts"] == {"High": 1, "Moderate": 1}
    assert rollup["pressureHintCounts"]["High anomaly pressure"] == 1
    assert rollup["pressureHintCounts"]["Moderate anomaly pressure"] == 1
    assert rollup["timestampFallbackCount"] == 2
    assert rollup["futureSkewEventCount"] == 2
    assert rollup["staleEventCount"] == 2
    assert rollup["freshEventCount"] == 7
    assert rollup["timestampAnomalyCountTotal"] == 6
    assert rollup["avgTimestampAnomalyCount"] == 3.0
    assert rollup["avgTimestampAnomalyRatePct"] == 30.0
    assert rollup["maxTimestampAnomalyRatePct"] == 50.0
    assert rollup["timestampAgeBucketCounts"]["stale"] == 2
    assert rollup["timestampAgeBucketCounts"]["future_skew"] == 2
    assert rollup["timestampAgeBucketCounts"]["fresh_lt_1h"] == 3
    assert rollup["timestampAgeBucketCounts"]["fallback"] == 1
    assert rollup["timestampAnomalyEventTypeCounts"]["open"] == 2
    assert rollup["timestampAnomalyEventTypeCounts"]["click"] == 1
    assert rollup["timestampAnomalyEventTypeCounts"]["processed"] == 1
    assert rollup["timestampDominantAnomalyBucketCounts"]["stale"] == 1
    assert rollup["timestampDominantAnomalyBucketCounts"]["future_skew"] == 1
    assert rollup["timestampDominantAnomalyEventTypeCounts"]["open"] == 1
    assert rollup["timestampDominantAnomalyEventTypeCounts"]["processed"] == 1
    assert rollup["timestampPressureHighAnomalyRatePct"] == 20.0
    assert rollup["timestampPressureModerateAnomalyRatePct"] == 5.0
    assert rollup["timestampPressureHighAnomalyCount"] == 10
    assert rollup["timestampPressureModerateAnomalyCount"] == 3
    assert rollup["latestEventAt"] == sendgrid_rollup_created_at_2
    assert payload["recentEvents"][0]["timestampPressureLabel"] == "Moderate"
    assert payload["recentEvents"][0]["timestampAnomalyCount"] == 2
    assert payload["recentEvents"][0]["timestampDominantAnomalyBucket"] == "future_skew"


def test_http_integrations_telemetry_summary_sendgrid_webhook_timestamp_rollup_handles_sparse_payloads(
    monkeypatch,
):
    fake_db = _FakeDb(
        integration_doc={"userId": "u1"},
        telemetry_docs=[
            {
                "id": "sg-http-ts-sparse",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "sendgrid_webhook_processed",
                "payload": {
                    "timestamp_pressure_label": "invalid",
                    "timestamp_pressure_hint": " ",
                    "timestamp_anomaly_count": "bad",
                    "timestamp_anomaly_rate_pct": "bad",
                    "timestamp_fallback_count": "bad",
                    "future_skew_event_count": "bad",
                    "stale_event_count": -1,
                    "fresh_event_count": None,
                    "timestamp_age_bucket_counts": {
                        "future_skew": 2,
                        "stale": "bad",
                    },
                    "timestamp_anomaly_event_type_counts": {
                        "open": 1,
                        "click": "bad",
                    },
                    "timestamp_dominant_anomaly_bucket": "",
                    "timestamp_dominant_anomaly_event_type": " ",
                },
                "createdAt": "2026-02-18T11:02:00+00:00",
            },
        ],
    )
    client = _build_client(monkeypatch, fake_db)
    response = client.get("/api/integrations/integrations/telemetry/summary?days=30&limit=500")
    assert response.status_code == 200
    payload = response.json()
    rollup = payload["sendgridWebhookTimestamp"]
    assert rollup["eventCount"] == 1
    assert rollup["pressureLabelCounts"] == {"Unknown": 1}
    assert rollup["pressureHintCounts"] == {"Timestamp posture not available.": 1}
    assert rollup["timestampFallbackCount"] == 0
    assert rollup["futureSkewEventCount"] == 0
    assert rollup["staleEventCount"] == 0
    assert rollup["freshEventCount"] == 0
    assert rollup["timestampAnomalyCountTotal"] == 0
    assert rollup["avgTimestampAnomalyCount"] is None
    assert rollup["avgTimestampAnomalyRatePct"] is None
    assert rollup["maxTimestampAnomalyRatePct"] is None
    assert rollup["timestampAgeBucketCounts"] == {"future_skew": 2}
    assert rollup["timestampAnomalyEventTypeCounts"] == {"open": 1}
    assert rollup["timestampDominantAnomalyBucketCounts"] == {}
    assert rollup["timestampDominantAnomalyEventTypeCounts"] == {}
    assert rollup["latestEventAt"] == "2026-02-18T11:02:00+00:00"


def test_http_integrations_telemetry_summary_packet_only_recent_events_filter(monkeypatch):
    fake_db = _FakeDb(
        integration_doc={"userId": "u1"},
        telemetry_docs=[
            {
                "id": "tp1",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "integrations_traceability_status_evaluated",
                "payload": {
                    "decision": "HOLD",
                    "traceability_ready": False,
                    "request_id": "req-packet-only",
                    "governance_packet_validation_status": "ACTION_REQUIRED",
                    "governance_packet_validation_within_freshness": False,
                },
                "createdAt": "2026-02-18T11:07:00+00:00",
            },
            {
                "id": "tp2",
                "userId": "u1",
                "provider": "sales_intelligence",
                "eventType": "sales_pipeline_forecast_generated",
                "schemaVersion": 2,
                "payload": {
                    "schema_version": 2,
                    "request_id": "req-sales-telemetry",
                },
                "createdAt": "2026-02-18T11:06:00+00:00",
            },
        ],
    )
    client = _build_client(monkeypatch, fake_db)
    response = client.get(
        "/api/integrations/integrations/telemetry/summary?days=30&limit=500&packet_only_recent_events=true"
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["eventCount"] == 2
    assert payload["recentEventsFilter"] == "packet"
    assert payload["recentEventsTotalCount"] == 2
    assert payload["recentEventsFilteredCount"] == 1
    assert payload["recentEventsPacketValidationCount"] == 1
    assert payload["recentEventsNonPacketCount"] == 1
    assert len(payload["recentEvents"]) == 1
    assert payload["recentEvents"][0]["requestId"] == "req-packet-only"
    assert payload["recentEvents"][0]["governancePacketValidationStatus"] == "ACTION_REQUIRED"


def test_http_integrations_telemetry_summary_packet_only_recent_events_false_query_value(monkeypatch):
    fake_db = _FakeDb(
        integration_doc={"userId": "u1"},
        telemetry_docs=[
            {
                "id": "tf1",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "integrations_traceability_status_evaluated",
                "payload": {
                    "request_id": "req-packet",
                    "governance_packet_validation_status": "ACTION_REQUIRED",
                    "governance_packet_validation_within_freshness": False,
                },
                "createdAt": "2026-02-18T11:07:00+00:00",
            },
            {
                "id": "tf2",
                "userId": "u1",
                "provider": "sales_intelligence",
                "eventType": "sales_pipeline_forecast_generated",
                "schemaVersion": 2,
                "payload": {"schema_version": 2, "request_id": "req-sales"},
                "createdAt": "2026-02-18T11:06:00+00:00",
            },
        ],
    )
    client = _build_client(monkeypatch, fake_db)
    response = client.get(
        "/api/integrations/integrations/telemetry/summary?days=30&limit=500&packet_only_recent_events=false"
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["eventCount"] == 2
    assert payload["recentEventsFilter"] == "all"
    assert payload["recentEventsTotalCount"] == 2
    assert payload["recentEventsFilteredCount"] == 2
    assert payload["recentEventsPacketValidationCount"] == 1
    assert payload["recentEventsNonPacketCount"] == 1
    assert payload["recentEventsGovernanceStatusCounts"] == {}
    assert payload["recentEventsPacketValidationStatusCounts"] == {"ACTION_REQUIRED": 1}
    assert len(payload["recentEvents"]) == 2


def test_http_integrations_telemetry_summary_defaults_recent_events_filter_to_all(monkeypatch):
    fake_db = _FakeDb(
        integration_doc={"userId": "u1"},
        telemetry_docs=[
            {
                "id": "ta1",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "integrations_traceability_status_evaluated",
                "payload": {
                    "request_id": "req-packet-default-all-http",
                    "governance_packet_validation_status": "ACTION_REQUIRED",
                    "governance_packet_validation_within_freshness": False,
                },
                "createdAt": "2026-02-18T11:07:00+00:00",
            },
            {
                "id": "ta2",
                "userId": "u1",
                "provider": "sales_intelligence",
                "eventType": "sales_pipeline_forecast_generated",
                "schemaVersion": 2,
                "payload": {
                    "schema_version": 2,
                    "request_id": "req-sales-default-all-http",
                },
                "createdAt": "2026-02-18T11:06:00+00:00",
            },
        ],
    )
    client = _build_client(monkeypatch, fake_db)
    response = client.get(
        "/api/integrations/integrations/telemetry/summary?days=30&limit=500"
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["eventCount"] == 2
    assert payload["recentEventsFilter"] == "all"
    assert payload["recentEventsTotalCount"] == 2
    assert payload["recentEventsFilteredCount"] == 2
    assert payload["recentEventsPacketValidationCount"] == 1
    assert payload["recentEventsNonPacketCount"] == 1
    assert len(payload["recentEvents"]) == 2


def test_http_integrations_telemetry_summary_packet_only_recent_events_rejects_non_boolean_query_value(
    monkeypatch,
):
    fake_db = _FakeDb(integration_doc={"userId": "u1"}, telemetry_docs=[])
    client = _build_client(monkeypatch, fake_db)

    response = client.get(
        "/api/integrations/integrations/telemetry/summary?days=30&limit=500&packet_only_recent_events=banana"
    )
    assert response.status_code == 422
    payload = response.json()
    details = payload.get("detail") or []
    assert any(
        isinstance(item, dict)
        and item.get("loc") == ["query", "packet_only_recent_events"]
        for item in details
    )


def test_http_integrations_telemetry_summary_filters_recent_events_by_governance_status(
    monkeypatch,
):
    fake_db = _FakeDb(
        integration_doc={"userId": "u1"},
        telemetry_docs=[
            {
                "id": "gs1",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "integrations_traceability_snapshot_governance_evaluated",
                "payload": {
                    "request_id": "req-governance-action-required",
                    "status": "ACTION_REQUIRED",
                },
                "createdAt": "2026-02-18T11:07:00+00:00",
            },
            {
                "id": "gs2",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "integrations_traceability_baseline_governance_evaluated",
                "payload": {
                    "request_id": "req-governance-pass",
                    "status": "PASS",
                },
                "createdAt": "2026-02-18T11:06:00+00:00",
            },
        ],
    )
    client = _build_client(monkeypatch, fake_db)

    response = client.get(
        "/api/integrations/integrations/telemetry/summary?days=30&limit=500&governance_status=action%20required"
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["eventCount"] == 2
    assert payload["recentEventsFilter"] == "all"
    assert payload["recentEventsGovernanceStatusFilter"] == "ACTION_REQUIRED"
    assert payload["recentEventsPacketValidationStatusFilter"] is None
    assert payload["recentEventsFilteredCount"] == 1
    assert payload["recentEventsGovernanceStatusCounts"] == {"ACTION_REQUIRED": 1}
    assert payload["recentEventsPacketValidationStatusCounts"] == {}
    assert len(payload["recentEvents"]) == 1
    assert payload["recentEvents"][0]["requestId"] == "req-governance-action-required"
    assert payload["recentEvents"][0]["governanceStatus"] == "ACTION_REQUIRED"


def test_http_integrations_telemetry_summary_filters_recent_events_by_packet_validation_status(
    monkeypatch,
):
    fake_db = _FakeDb(
        integration_doc={"userId": "u1"},
        telemetry_docs=[
            {
                "id": "ps1",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "integrations_traceability_status_evaluated",
                "payload": {
                    "request_id": "req-packet-ready",
                    "governance_packet_validation_status": " ready ",
                    "governance_packet_validation_within_freshness": True,
                },
                "createdAt": "2026-02-18T11:07:00+00:00",
            },
            {
                "id": "ps2",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "integrations_traceability_status_evaluated",
                "payload": {
                    "request_id": "req-packet-action-required",
                    "governance_packet_validation_status": "ACTION_REQUIRED",
                    "governance_packet_validation_within_freshness": False,
                },
                "createdAt": "2026-02-18T11:06:00+00:00",
            },
            {
                "id": "ps3",
                "userId": "u1",
                "provider": "sales_intelligence",
                "eventType": "sales_pipeline_forecast_generated",
                "payload": {"request_id": "req-non-packet"},
                "createdAt": "2026-02-18T11:05:00+00:00",
            },
        ],
    )
    client = _build_client(monkeypatch, fake_db)

    response = client.get(
        "/api/integrations/integrations/telemetry/summary?days=30&limit=500&packet_validation_status=ready"
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["eventCount"] == 3
    assert payload["recentEventsFilter"] == "all"
    assert payload["recentEventsGovernanceStatusFilter"] is None
    assert payload["recentEventsPacketValidationStatusFilter"] == "READY"
    assert payload["recentEventsFilteredCount"] == 1
    assert payload["recentEventsGovernanceStatusCounts"] == {}
    assert payload["recentEventsPacketValidationStatusCounts"] == {"READY": 1}
    assert len(payload["recentEvents"]) == 1
    assert payload["recentEvents"][0]["requestId"] == "req-packet-ready"
    assert payload["recentEvents"][0]["governancePacketValidationStatus"] == "READY"


def test_http_integrations_telemetry_summary_status_count_maps_are_sorted_by_status_token(
    monkeypatch,
):
    fake_db = _FakeDb(
        integration_doc={"userId": "u1"},
        telemetry_docs=[
            {
                "id": "hsc1",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "integrations_traceability_status_evaluated",
                "payload": {
                    "request_id": "req-http-status-count-pass-ready",
                    "status": "PASS",
                    "governance_packet_validation_status": "READY",
                },
                "createdAt": "2026-02-18T11:07:00+00:00",
            },
            {
                "id": "hsc2",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "integrations_traceability_status_evaluated",
                "payload": {
                    "request_id": "req-http-status-count-action-required",
                    "status": "ACTION_REQUIRED",
                    "governance_packet_validation_status": "ACTION_REQUIRED",
                },
                "createdAt": "2026-02-18T11:06:00+00:00",
            },
        ],
    )
    client = _build_client(monkeypatch, fake_db)

    response = client.get(
        "/api/integrations/integrations/telemetry/summary?days=30&limit=500"
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["recentEventsGovernanceStatusCounts"] == {
        "ACTION_REQUIRED": 1,
        "PASS": 1,
    }
    assert list(payload["recentEventsGovernanceStatusCounts"].keys()) == [
        "ACTION_REQUIRED",
        "PASS",
    ]
    assert payload["recentEventsPacketValidationStatusCounts"] == {
        "ACTION_REQUIRED": 1,
        "READY": 1,
    }
    assert list(payload["recentEventsPacketValidationStatusCounts"].keys()) == [
        "ACTION_REQUIRED",
        "READY",
    ]


def test_http_integrations_telemetry_summary_exposes_status_count_provenance_fields(
    monkeypatch,
):
    fake_db = _FakeDb(
        integration_doc={"userId": "u1"},
        telemetry_docs=[
            {
                "id": "hscp1",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "integrations_traceability_status_evaluated",
                "payload": {
                    "request_id": "req-http-provenance-pass-ready",
                    "status": "PASS",
                    "governance_packet_validation_status": "READY",
                },
                "createdAt": "2026-02-18T11:07:00+00:00",
            }
        ],
    )
    client = _build_client(monkeypatch, fake_db)

    response = client.get(
        "/api/integrations/integrations/telemetry/summary?days=30&limit=500"
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["recentEventsGovernanceStatusCounts"] == {"PASS": 1}
    assert payload["recentEventsPacketValidationStatusCounts"] == {"READY": 1}
    assert payload["recentEventsGovernanceStatusCountsSource"] == "server"
    assert payload["recentEventsPacketValidationStatusCountsSource"] == "server"
    assert payload["recentEventsGovernanceStatusCountsMismatch"] is False
    assert payload["recentEventsPacketValidationStatusCountsMismatch"] is False
    assert payload["recentEventsGovernanceStatusCountsServer"] == {"PASS": 1}
    assert payload["recentEventsPacketValidationStatusCountsServer"] == {"READY": 1}
    assert payload["recentEventsGovernanceStatusCountsFallback"] == {"PASS": 1}
    assert payload["recentEventsPacketValidationStatusCountsFallback"] == {"READY": 1}
    assert payload["recentEventsGovernanceStatusCountsPosture"] == "server_consistent"
    assert payload["recentEventsPacketValidationStatusCountsPosture"] == "server_consistent"
    assert payload["recentEventsGovernanceStatusCountsPostureSeverity"] == "info"
    assert payload["recentEventsPacketValidationStatusCountsPostureSeverity"] == "info"
    assert payload["recentEventsGovernanceStatusCountsRequiresInvestigation"] is False
    assert payload["recentEventsPacketValidationStatusCountsRequiresInvestigation"] is False


def test_http_integrations_telemetry_summary_status_count_provenance_handles_malformed_status_tokens(
    monkeypatch,
):
    fake_db = _FakeDb(
        integration_doc={"userId": "u1"},
        telemetry_docs=[
            {
                "id": "hscp2",
                "userId": "u1",
                "provider": "sales_intelligence",
                "eventType": "sales_pipeline_forecast_generated",
                "payload": {
                    "request_id": "req-http-provenance-malformed",
                    "status": "!!!",
                    "governance_packet_validation_status": "***",
                },
                "createdAt": "2026-02-18T11:07:00+00:00",
            }
        ],
    )
    client = _build_client(monkeypatch, fake_db)

    response = client.get(
        "/api/integrations/integrations/telemetry/summary?days=30&limit=500"
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["recentEventsGovernanceStatusCounts"] == {}
    assert payload["recentEventsPacketValidationStatusCounts"] == {}
    assert payload["recentEventsGovernanceStatusCountsSource"] == "local"
    assert payload["recentEventsPacketValidationStatusCountsSource"] == "local"
    assert payload["recentEventsGovernanceStatusCountsMismatch"] is False
    assert payload["recentEventsPacketValidationStatusCountsMismatch"] is False
    assert payload["recentEventsGovernanceStatusCountsServer"] == {}
    assert payload["recentEventsPacketValidationStatusCountsServer"] == {}
    assert payload["recentEventsGovernanceStatusCountsFallback"] == {}
    assert payload["recentEventsPacketValidationStatusCountsFallback"] == {}
    assert payload["recentEventsGovernanceStatusCountsPosture"] == "local_fallback"
    assert payload["recentEventsPacketValidationStatusCountsPosture"] == "local_fallback"
    assert payload["recentEventsGovernanceStatusCountsPostureSeverity"] == "info"
    assert payload["recentEventsPacketValidationStatusCountsPostureSeverity"] == "info"
    assert payload["recentEventsGovernanceStatusCountsRequiresInvestigation"] is False
    assert payload["recentEventsPacketValidationStatusCountsRequiresInvestigation"] is False


def test_http_integrations_telemetry_summary_status_count_provenance_prefers_event_root_status_fields(
    monkeypatch,
):
    fake_db = _FakeDb(
        integration_doc={"userId": "u1"},
        telemetry_docs=[
            {
                "id": "hscp3",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "integrations_traceability_status_evaluated",
                "governanceStatus": "ACTION_REQUIRED",
                "governancePacketValidationStatus": "READY",
                "payload": {
                    "request_id": "req-http-provenance-event-root-preferred",
                    "status": "PASS",
                    "governance_packet_validation_status": "ACTION_REQUIRED",
                },
                "createdAt": "2026-02-18T11:08:00+00:00",
            }
        ],
    )
    client = _build_client(monkeypatch, fake_db)

    response = client.get(
        "/api/integrations/integrations/telemetry/summary?days=30&limit=500"
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["recentEventsGovernanceStatusCounts"] == {"ACTION_REQUIRED": 1}
    assert payload["recentEventsPacketValidationStatusCounts"] == {"READY": 1}
    assert payload["recentEventsGovernanceStatusCountsSource"] == "server"
    assert payload["recentEventsPacketValidationStatusCountsSource"] == "server"
    assert payload["recentEventsGovernanceStatusCountsMismatch"] is False
    assert payload["recentEventsPacketValidationStatusCountsMismatch"] is False
    assert payload["recentEventsGovernanceStatusCountsServer"] == {"ACTION_REQUIRED": 1}
    assert payload["recentEventsPacketValidationStatusCountsServer"] == {"READY": 1}
    assert payload["recentEventsGovernanceStatusCountsFallback"] == {"ACTION_REQUIRED": 1}
    assert payload["recentEventsPacketValidationStatusCountsFallback"] == {"READY": 1}
    assert payload["recentEventsGovernanceStatusCountsPosture"] == "server_consistent"
    assert payload["recentEventsPacketValidationStatusCountsPosture"] == "server_consistent"
    assert payload["recentEventsGovernanceStatusCountsPostureSeverity"] == "info"
    assert payload["recentEventsPacketValidationStatusCountsPostureSeverity"] == "info"
    assert payload["recentEventsGovernanceStatusCountsRequiresInvestigation"] is False
    assert payload["recentEventsPacketValidationStatusCountsRequiresInvestigation"] is False
    assert len(payload["recentEvents"]) == 1
    assert payload["recentEvents"][0]["governanceStatus"] == "ACTION_REQUIRED"
    assert payload["recentEvents"][0]["governancePacketValidationStatus"] == "READY"


def test_http_integrations_telemetry_summary_status_count_provenance_surfaces_server_drift_posture(
    monkeypatch,
):
    fake_db = _FakeDb(
        integration_doc={"userId": "u1"},
        telemetry_docs=[
            {
                "id": "hscp4",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "integrations_traceability_status_evaluated",
                "payload": {
                    "request_id": "req-http-provenance-server-drift",
                    "status": "PASS",
                    "governance_packet_validation_status": "READY",
                },
                "createdAt": "2026-02-18T11:09:00+00:00",
            }
        ],
    )
    monkeypatch.setattr(real_integrations, "_status_count_maps_equal", lambda left, right: False)
    client = _build_client(monkeypatch, fake_db)

    response = client.get(
        "/api/integrations/integrations/telemetry/summary?days=30&limit=500"
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["recentEventsGovernanceStatusCountsSource"] == "server"
    assert payload["recentEventsPacketValidationStatusCountsSource"] == "server"
    assert payload["recentEventsGovernanceStatusCountsMismatch"] is True
    assert payload["recentEventsPacketValidationStatusCountsMismatch"] is True
    assert payload["recentEventsGovernanceStatusCountsPosture"] == "server_drift"
    assert payload["recentEventsPacketValidationStatusCountsPosture"] == "server_drift"
    assert payload["recentEventsGovernanceStatusCountsPostureSeverity"] == "warning"
    assert payload["recentEventsPacketValidationStatusCountsPostureSeverity"] == "warning"
    assert payload["recentEventsGovernanceStatusCountsRequiresInvestigation"] is True
    assert payload["recentEventsPacketValidationStatusCountsRequiresInvestigation"] is True


def test_http_integrations_telemetry_summary_uses_top_level_telemetry_contract_fields(
    monkeypatch,
):
    fake_db = _FakeDb(
        integration_doc={"userId": "u1"},
        telemetry_docs=[
            {
                "id": "top-level-http-1",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "integrations_traceability_status_evaluated",
                "requestId": "req-http-top-level-1",
                "schemaVersion": 2,
                "governanceStatus": "ACTION_REQUIRED",
                "governancePacketValidationStatus": "READY",
                "governancePacketValidationWithinFreshness": True,
                "payload": {"decision": "HOLD"},
                "createdAt": "2026-02-18T11:08:00+00:00",
            }
        ],
    )
    client = _build_client(monkeypatch, fake_db)

    response = client.get(
        "/api/integrations/integrations/telemetry/summary?days=30&limit=500"
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["recentEventsGovernanceStatusCounts"] == {"ACTION_REQUIRED": 1}
    assert payload["recentEventsPacketValidationStatusCounts"] == {"READY": 1}
    assert payload["packetValidationAudit"]["statusCounts"] == {"READY": 1}
    assert len(payload["recentEvents"]) == 1
    assert payload["recentEvents"][0]["schemaVersion"] == 2
    assert payload["recentEvents"][0]["requestId"] == "req-http-top-level-1"
    assert payload["recentEvents"][0]["governanceStatus"] == "ACTION_REQUIRED"
    assert payload["recentEvents"][0]["governancePacketValidationStatus"] == "READY"
    assert (
        payload["recentEvents"][0]["governancePacketValidationWithinFreshness"] is True
    )


def test_http_integrations_telemetry_summary_rejects_blank_status_filter_query_values(
    monkeypatch,
):
    fake_db = _FakeDb(integration_doc={"userId": "u1"}, telemetry_docs=[])
    client = _build_client(monkeypatch, fake_db)

    governance_response = client.get(
        "/api/integrations/integrations/telemetry/summary?days=30&limit=500&governance_status=%20%20"
    )
    assert governance_response.status_code == 400
    assert (
        governance_response.json().get("detail")
        == "governance_status must be a non-empty status token"
    )

    packet_response = client.get(
        "/api/integrations/integrations/telemetry/summary?days=30&limit=500&packet_validation_status=%21%21%21"
    )
    assert packet_response.status_code == 400
    assert (
        packet_response.json().get("detail")
        == "packet_validation_status must be a non-empty status token"
    )


def test_http_integrations_telemetry_summary_packet_filter_smoke_handles_malformed_payload_mix(
    monkeypatch,
):
    fake_db = _FakeDb(
        integration_doc={"userId": "u1"},
        telemetry_docs=[
            {
                "id": "tm1",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "integrations_traceability_status_evaluated",
                "payload": {
                    "request_id": "req-packet-good",
                    "decision": "HOLD",
                    "traceability_ready": False,
                    "governance_packet_validation_status": "ACTION_REQUIRED",
                    "governance_packet_validation_within_freshness": False,
                },
                "createdAt": "2026-02-18T11:07:00+00:00",
            },
            {
                "id": "tm2",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "integrations_traceability_status_evaluated",
                "payload": "malformed-payload",
                "createdAt": "2026-02-18T11:06:00+00:00",
            },
            {
                "id": "tm3",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "integrations_traceability_snapshot_governance_evaluated",
                "payload": ["unexpected", "shape"],
                "createdAt": "2026-02-18T11:05:00+00:00",
            },
            {
                "id": "tm4",
                "userId": "u1",
                "provider": "sales_intelligence",
                "eventType": "sales_pipeline_forecast_generated",
                "payload": {"schema_version": 2, "request_id": "req-sales"},
                "schemaVersion": 2,
                "createdAt": "2026-02-18T11:04:00+00:00",
            },
        ],
    )
    client = _build_client(monkeypatch, fake_db)
    response = client.get(
        "/api/integrations/integrations/telemetry/summary?days=30&limit=500&packet_only_recent_events=true"
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["eventCount"] == 4
    assert payload["recentEventsFilter"] == "packet"
    assert payload["recentEventsTotalCount"] == 4
    assert payload["recentEventsFilteredCount"] == 1
    assert payload["recentEventsPacketValidationCount"] == 1
    assert payload["recentEventsNonPacketCount"] == 3
    assert len(payload["recentEvents"]) == 1
    assert payload["recentEvents"][0]["requestId"] == "req-packet-good"
    assert payload["recentEvents"][0]["governancePacketValidationStatus"] == "ACTION_REQUIRED"


def test_http_integrations_telemetry_summary_recent_event_distribution_counts_use_capped_window(
    monkeypatch,
):
    telemetry_docs = []
    for idx in range(60):
        has_packet_marker = idx < 45
        payload = {"request_id": f"req-window-http-{idx}"}
        if has_packet_marker:
            payload["governance_packet_validation_status"] = "READY"
            payload["governance_packet_validation_within_freshness"] = True
        telemetry_docs.append(
            {
                "id": f"th{idx}",
                "userId": "u1",
                "provider": "integrations" if has_packet_marker else "sales_intelligence",
                "eventType": (
                    "integrations_traceability_status_evaluated"
                    if has_packet_marker
                    else "sales_pipeline_forecast_generated"
                ),
                "payload": payload,
                "createdAt": f"2026-02-18T11:{59 - idx:02d}:00+00:00",
            }
        )

    fake_db = _FakeDb(integration_doc={"userId": "u1"}, telemetry_docs=telemetry_docs)
    client = _build_client(monkeypatch, fake_db)
    response = client.get(
        "/api/integrations/integrations/telemetry/summary?days=30&limit=500"
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["eventCount"] == 60
    assert payload["recentEventsTotalCount"] == 50
    assert payload["recentEventsFilteredCount"] == 50
    assert payload["recentEventsPacketValidationCount"] == 45
    assert payload["recentEventsNonPacketCount"] == 5
    assert len(payload["recentEvents"]) == 50


def test_http_integrations_telemetry_snapshot_governance(monkeypatch):
    fake_db = _FakeDb(integration_doc={"userId": "u1"}, telemetry_docs=[])
    client = _build_client(monkeypatch, fake_db)

    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        snapshot_path = tmp_path / "connector-telemetry-summary-2026-02-22.json"
        snapshot_path.write_text(
            json.dumps(
                {
                    "generatedAt": datetime.now(timezone.utc).isoformat(),
                    "traceabilityAudit": {
                        "eventCount": 1,
                        "decisionCounts": {"HOLD": 1},
                        "readyCount": 0,
                        "notReadyCount": 1,
                    },
                    "sendgridWebhookTimestamp": {
                        "eventCount": 2,
                        "pressureLabelCounts": {"Moderate": 2},
                        "pressureHintCounts": {
                            "Validate event timestamp source clocks.": 2
                        },
                        "timestampFallbackCount": 1,
                        "futureSkewEventCount": 0,
                        "staleEventCount": 1,
                        "freshEventCount": 1,
                        "timestampAnomalyCountTotal": 3,
                        "avgTimestampAnomalyCount": 1.5,
                        "avgTimestampAnomalyRatePct": 37.5,
                        "maxTimestampAnomalyRatePct": 50.0,
                        "timestampAgeBucketCounts": {"stale": 1, "fallback": 1},
                        "timestampAnomalyEventTypeCounts": {"open": 2, "processed": 1},
                        "timestampDominantAnomalyBucketCounts": {"stale": 2},
                        "timestampDominantAnomalyEventTypeCounts": {"open": 2},
                        "timestampPressureHighAnomalyRatePct": 20.0,
                        "timestampPressureModerateAnomalyRatePct": 5.0,
                        "timestampPressureHighAnomalyCount": 10,
                        "timestampPressureModerateAnomalyCount": 3,
                        "latestEventAt": datetime.now(timezone.utc).isoformat(),
                    },
                }
            ),
            encoding="utf-8",
        )
        pass_fixture = tmp_path / "connector_release_gate_result.json"
        hold_fixture = tmp_path / "connector_release_gate_result_hold.json"
        validation_fail_fixture = (
            tmp_path / "connector_release_gate_result_validation_fail.json"
        )
        for path in (pass_fixture, hold_fixture, validation_fail_fixture):
            path.write_text(json.dumps({"approved": True}), encoding="utf-8")

        monkeypatch.setattr(real_integrations, "TELEMETRY_SNAPSHOT_DIR", tmp_path)
        monkeypatch.setattr(
            real_integrations,
            "RELEASE_GATE_ARTIFACT_PATHS",
            {
                "pass": pass_fixture,
                "hold": hold_fixture,
                "validation-fail": validation_fail_fixture,
            },
        )

        response = client.get(
            "/api/integrations/integrations/telemetry/snapshot-governance?retention_days=30"
        )
        assert response.status_code == 200
        payload = response.json()
        assert payload["status"] == "READY"
        assert payload["governanceType"] == "snapshot"
        assert payload["exportSchemaVersion"] == 1
        assert payload["schemaMetadata"]["activeVersion"] == 1
        assert payload["schemaMetadata"]["source"] == "default"
        assert isinstance(payload["reasonCodes"], list)
        assert payload["snapshot"]["fileCount"] >= 1
        assert payload["snapshot"]["withinRetention"] is True
        assert payload["sendgridWebhookTimestamp"]["eventCount"] == 2
        assert payload["sendgridWebhookTimestamp"]["timestampAnomalyCountTotal"] == 3
        assert payload["sendgridWebhookTimestamp"]["pressureLabelCounts"]["Moderate"] == 2
        assert payload["releaseGateFixtures"]["allProfilesAvailable"] is True
        assert payload["releaseGateFixtures"]["missingProfiles"] == []
        assert payload["handoff"]["rolloutBlocked"] is False
        assert len(payload["rolloutActions"]) >= 1
        assert payload["governanceExport"]["governanceType"] == "snapshot"
        assert payload["governanceExport"]["exportSchemaVersion"] == 1
        assert payload["governanceExport"]["schemaMetadata"]["activeVersion"] == 1
        assert (
            payload["governanceExport"]["sendgridWebhookTimestamp"]
            == payload["sendgridWebhookTimestamp"]
        )
        assert isinstance(payload["recommendedCommands"], list)
        assert payload["governanceExport"]["recommendedCommands"] == payload["recommendedCommands"]
        top_level_reason_codes = set(payload.get("reasonCodes") or [])
        rollout_action_reason_codes = {
            action.get("reasonCode")
            for action in payload.get("rolloutActions") or []
            if isinstance(action.get("reasonCode"), str)
        }
        export_action_reason_codes = {
            action.get("reasonCode")
            for action in payload["governanceExport"].get("actions") or []
            if isinstance(action.get("reasonCode"), str)
        }
        export_alert_reason_codes = {
            alert.get("reasonCode")
            for alert in payload["governanceExport"].get("alerts") or []
            if isinstance(alert.get("reasonCode"), str)
        }
        assert top_level_reason_codes == rollout_action_reason_codes
        assert top_level_reason_codes == export_action_reason_codes
        assert top_level_reason_codes == export_alert_reason_codes
        assert isinstance(payload["governanceExport"]["alerts"][0]["reasonCode"], str)
        assert payload["governanceExport"]["rolloutBlocked"] is False
        assert len(fake_db.integration_telemetry.inserted) == 1
        governance_event = fake_db.integration_telemetry.inserted[0]
        assert (
            governance_event["eventType"]
            == "integrations_traceability_snapshot_governance_evaluated"
        )
        assert governance_event["payload"]["status"] == "READY"
        assert isinstance(governance_event["payload"]["reason_codes"], list)
        assert governance_event["payload"]["recommended_commands"] == payload["recommendedCommands"]
        assert governance_event["payload"]["reason_code_count"] == len(top_level_reason_codes)
        assert (
            governance_event["payload"]["recommended_command_count"]
            == len(payload["recommendedCommands"])
        )
        assert governance_event["payload"]["sendgrid_webhook_timestamp_event_count"] == 2
        assert governance_event["payload"]["sendgrid_webhook_timestamp_anomaly_count_total"] == 3


def test_http_integrations_telemetry_summary_includes_governance_audit(monkeypatch):
    recent_base = datetime.now(timezone.utc).replace(microsecond=0)
    governance_created_at_1 = (recent_base - timedelta(minutes=2)).isoformat()
    governance_created_at_2 = (recent_base - timedelta(minutes=1)).isoformat()

    fake_db = _FakeDb(
        integration_doc={"userId": "u1"},
        telemetry_docs=[
            {
                "id": "g1",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "integrations_traceability_snapshot_governance_evaluated",
                "payload": {"status": "ACTION_REQUIRED"},
                "createdAt": governance_created_at_1,
            },
            {
                "id": "g2",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "integrations_traceability_baseline_governance_evaluated",
                "payload": {
                    "status": "PASS",
                    "governance_packet_validation_status": "READY",
                    "governance_packet_validation_within_freshness": True,
                },
                "createdAt": governance_created_at_2,
            },
        ],
    )
    client = _build_client(monkeypatch, fake_db)
    response = client.get("/api/integrations/integrations/telemetry/summary?days=30&limit=500")
    assert response.status_code == 200
    payload = response.json()
    assert payload["governanceAudit"]["eventCount"] == 2
    assert payload["governanceAudit"]["snapshotEvaluationCount"] == 1
    assert payload["governanceAudit"]["baselineEvaluationCount"] == 1
    assert payload["governanceAudit"]["statusCounts"]["ACTION_REQUIRED"] == 1
    assert payload["governanceAudit"]["statusCounts"]["PASS"] == 1
    assert payload["packetValidationAudit"]["eventCount"] == 1
    assert payload["packetValidationAudit"]["statusCounts"]["READY"] == 1
    assert payload["packetValidationAudit"]["withinFreshnessCount"] == 1
    assert payload["packetValidationAudit"]["outsideFreshnessCount"] == 0
    assert payload["packetValidationAudit"]["missingFreshnessCount"] == 0
    assert payload["packetValidationAudit"]["latestEvaluatedAt"] == governance_created_at_2
    assert payload["recentEvents"][0]["governanceStatus"] == "PASS"
    assert payload["recentEvents"][0]["governancePacketValidationStatus"] == "READY"
    assert payload["recentEvents"][0]["governancePacketValidationWithinFreshness"] is True


def test_http_integrations_telemetry_snapshot_governance_handles_missing_and_stale_artifacts(monkeypatch):
    fake_db = _FakeDb(integration_doc={"userId": "u1"}, telemetry_docs=[])
    client = _build_client(monkeypatch, fake_db)

    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        stale_snapshot_path = tmp_path / "connector-telemetry-summary-2025-01-01.json"
        stale_snapshot_path.write_text(
            json.dumps(
                {
                    "generatedAt": (
                        datetime.now(timezone.utc) - timedelta(days=90)
                    ).isoformat()
                }
            ),
            encoding="utf-8",
        )
        pass_fixture = tmp_path / "connector_release_gate_result.json"
        pass_fixture.write_text(json.dumps({"approved": True}), encoding="utf-8")

        monkeypatch.setattr(real_integrations, "TELEMETRY_SNAPSHOT_DIR", tmp_path)
        monkeypatch.setattr(
            real_integrations,
            "RELEASE_GATE_ARTIFACT_PATHS",
            {
                "pass": pass_fixture,
                "hold": tmp_path / "connector_release_gate_result_hold.json",
                "validation-fail": (
                    tmp_path / "connector_release_gate_result_validation_fail.json"
                ),
            },
        )

        response = client.get(
            "/api/integrations/integrations/telemetry/snapshot-governance?retention_days=30"
        )
        assert response.status_code == 200
        payload = response.json()
        assert payload["status"] == "ACTION_REQUIRED"
        assert payload["exportSchemaVersion"] == 1
        assert payload["schemaMetadata"]["activeVersion"] == 1
        assert isinstance(payload["reasonCodes"], list)
        assert payload["snapshot"]["withinRetention"] is False
        assert payload["sendgridWebhookTimestamp"]["eventCount"] == 0
        assert payload["releaseGateFixtures"]["allProfilesAvailable"] is False
        assert "hold" in payload["releaseGateFixtures"]["missingProfiles"]
        assert "validation-fail" in payload["releaseGateFixtures"]["missingProfiles"]
        assert payload["handoff"]["rolloutBlocked"] is True
        assert payload["handoff"]["ownerRole"] == "Release Manager"
        assert len(payload["rolloutActions"]) >= 1
        assert payload["governanceExport"]["rolloutBlocked"] is True
        assert payload["governanceExport"]["exportSchemaVersion"] == 1
        assert payload["governanceExport"]["schemaMetadata"]["activeVersion"] == 1
        assert isinstance(payload["recommendedCommands"], list)
        assert payload["governanceExport"]["recommendedCommands"] == payload["recommendedCommands"]
        top_level_reason_codes = set(payload.get("reasonCodes") or [])
        rollout_action_reason_codes = {
            action.get("reasonCode")
            for action in payload.get("rolloutActions") or []
            if isinstance(action.get("reasonCode"), str)
        }
        export_action_reason_codes = {
            action.get("reasonCode")
            for action in payload["governanceExport"].get("actions") or []
            if isinstance(action.get("reasonCode"), str)
        }
        export_alert_reason_codes = {
            alert.get("reasonCode")
            for alert in payload["governanceExport"].get("alerts") or []
            if isinstance(alert.get("reasonCode"), str)
        }
        assert top_level_reason_codes == rollout_action_reason_codes
        assert top_level_reason_codes == export_action_reason_codes
        assert top_level_reason_codes == export_alert_reason_codes
        assert isinstance(payload["governanceExport"]["alerts"][0]["reasonCode"], str)
        assert payload["governanceExport"]["status"] == "ACTION_REQUIRED"
        assert len(payload["alerts"]) >= 1
        assert len(fake_db.integration_telemetry.inserted) == 1
        governance_event = fake_db.integration_telemetry.inserted[0]
        assert governance_event["payload"]["status"] == "ACTION_REQUIRED"
        assert isinstance(governance_event["payload"]["reason_codes"], list)
        assert governance_event["payload"]["recommended_commands"] == payload["recommendedCommands"]
        assert governance_event["payload"]["reason_code_count"] == len(top_level_reason_codes)
        assert (
            governance_event["payload"]["recommended_command_count"]
            == len(payload["recommendedCommands"])
        )
        assert governance_event["payload"]["sendgrid_webhook_timestamp_event_count"] == 0


def test_http_integrations_telemetry_snapshot_governance_handles_non_object_snapshot_artifacts(
    monkeypatch,
):
    fake_db = _FakeDb(integration_doc={"userId": "u1"}, telemetry_docs=[])
    client = _build_client(monkeypatch, fake_db)

    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        non_object_snapshot_path = tmp_path / "connector-telemetry-summary-invalid.json"
        non_object_snapshot_path.write_text(
            json.dumps(["invalid-root"]),
            encoding="utf-8",
        )
        pass_fixture = tmp_path / "connector_release_gate_result.json"
        hold_fixture = tmp_path / "connector_release_gate_result_hold.json"
        validation_fail_fixture = (
            tmp_path / "connector_release_gate_result_validation_fail.json"
        )
        for path in (pass_fixture, hold_fixture, validation_fail_fixture):
            path.write_text(json.dumps({"approved": True}), encoding="utf-8")

        monkeypatch.setattr(real_integrations, "TELEMETRY_SNAPSHOT_DIR", tmp_path)
        monkeypatch.setattr(
            real_integrations,
            "RELEASE_GATE_ARTIFACT_PATHS",
            {
                "pass": pass_fixture,
                "hold": hold_fixture,
                "validation-fail": validation_fail_fixture,
            },
        )

        response = client.get(
            "/api/integrations/integrations/telemetry/snapshot-governance?retention_days=30"
        )
        assert response.status_code == 200
        payload = response.json()
        assert payload["status"] == "ACTION_REQUIRED"
        assert payload["snapshot"]["fileCount"] >= 1
        assert payload["snapshot"]["latestGeneratedAt"] is None
        assert payload["snapshot"]["withinRetention"] is False
        assert payload["handoff"]["rolloutBlocked"] is True
        assert isinstance(payload["recommendedCommands"], list)
        assert payload["governanceExport"]["recommendedCommands"] == payload["recommendedCommands"]
        top_level_reason_codes = set(payload.get("reasonCodes") or [])
        rollout_action_reason_codes = {
            action.get("reasonCode")
            for action in payload.get("rolloutActions") or []
            if isinstance(action.get("reasonCode"), str)
        }
        export_action_reason_codes = {
            action.get("reasonCode")
            for action in payload["governanceExport"].get("actions") or []
            if isinstance(action.get("reasonCode"), str)
        }
        export_alert_reason_codes = {
            alert.get("reasonCode")
            for alert in payload["governanceExport"].get("alerts") or []
            if isinstance(alert.get("reasonCode"), str)
        }
        assert top_level_reason_codes == rollout_action_reason_codes
        assert top_level_reason_codes == export_action_reason_codes
        assert top_level_reason_codes == export_alert_reason_codes
        assert len(fake_db.integration_telemetry.inserted) == 1
        governance_event = fake_db.integration_telemetry.inserted[0]
        assert governance_event["payload"]["status"] == "ACTION_REQUIRED"
        assert isinstance(governance_event["payload"]["reason_codes"], list)
        assert governance_event["payload"]["recommended_commands"] == payload["recommendedCommands"]
        assert governance_event["payload"]["reason_code_count"] == len(top_level_reason_codes)
        assert (
            governance_event["payload"]["recommended_command_count"]
            == len(payload["recommendedCommands"])
        )


def test_http_integrations_telemetry_snapshot_governance_validates_retention_days(monkeypatch):
    fake_db = _FakeDb(integration_doc={"userId": "u1"}, telemetry_docs=[])
    client = _build_client(monkeypatch, fake_db)

    response = client.get(
        "/api/integrations/integrations/telemetry/snapshot-governance?retention_days=0"
    )
    assert response.status_code == 400


def test_http_integrations_baseline_governance(monkeypatch):
    fake_db = _FakeDb(integration_doc={"userId": "u1"}, telemetry_docs=[])
    client = _build_client(monkeypatch, fake_db)

    with tempfile.TemporaryDirectory() as tmp:
        artifact_path = Path(tmp) / "baseline_metrics.json"
        artifact_path.write_text(
            json.dumps(
                {
                    "generatedAt": "2026-02-22T00:00:00+00:00",
                    "overallStatus": "pass",
                    "releaseGateFixturePolicy": {
                        "passed": True,
                        "requiredProfiles": ["pass", "hold", "validation-fail"],
                        "missingProfiles": [],
                        "message": "All required release-gate fixture profiles are present.",
                    },
                    "releaseGateFixtures": {
                        "allProfilesAvailable": True,
                        "availableProfileCount": 3,
                        "profileCount": 3,
                    },
                    "orchestrationGate": {
                        "available": True,
                        "decision": "PROCEED",
                        "attemptErrorGatePassed": True,
                        "attemptSkippedGatePassed": True,
                        "maxAttemptErrorCountThreshold": 5,
                        "observedAttemptErrorCount": 1,
                        "maxAttemptSkippedCountThreshold": 25,
                        "observedAttemptSkippedCount": 2,
                    },
                    "runtimePrereqs": {
                        "available": True,
                        "passed": True,
                        "artifactPath": "/tmp/sales_runtime_prereqs.json",
                        "generatedAt": "2026-02-22T00:00:00+00:00",
                        "validatedAt": "2026-02-22T00:00:00+00:00",
                        "command": "verify_sales_runtime_prereqs",
                        "valid": True,
                        "contractValid": True,
                        "missingChecks": {"commands": [], "workspace": []},
                        "missingCheckCount": 0,
                    },
                }
            ),
            encoding="utf-8",
        )
        monkeypatch.setattr(
            real_integrations,
            "BASELINE_METRICS_ARTIFACT_PATH",
            artifact_path,
        )
        response = client.get(
            "/api/integrations/integrations/telemetry/baseline-governance"
        )
        assert response.status_code == 200
        payload = response.json()
        assert payload["status"] == "PASS"
        assert payload["governanceType"] == "baseline"
        assert payload["exportSchemaVersion"] == 1
        assert payload["schemaMetadata"]["activeVersion"] == 1
        assert isinstance(payload["reasonCodes"], list)
        assert payload["releaseGateFixturePolicy"]["passed"] is True
        assert payload["releaseGateFixtures"]["allProfilesAvailable"] is True
        assert payload["orchestrationGate"]["available"] is True
        assert payload["orchestrationGate"]["attemptErrorGatePassed"] is True
        assert payload["orchestrationGate"]["attemptSkippedGatePassed"] is True
        assert payload["runtimePrereqs"]["present"] is True
        assert payload["runtimePrereqs"]["available"] is True
        assert payload["runtimePrereqs"]["passed"] is True
        assert payload["runtimePrereqs"]["contractValid"] is True
        assert payload["runtimePrereqs"]["valid"] is True
        assert payload["runtimePrereqs"]["missingCheckCount"] == 0
        assert payload["handoff"]["rolloutBlocked"] is False
        assert len(payload["rolloutActions"]) >= 1
        assert payload["recommendedCommands"] == ["npm run verify:ci:sales:extended"]
        assert payload["governanceExport"]["governanceType"] == "baseline"
        assert payload["governanceExport"]["exportSchemaVersion"] == 1
        assert payload["governanceExport"]["schemaMetadata"]["activeVersion"] == 1
        assert payload["governanceExport"]["recommendedCommands"] == [
            "npm run verify:ci:sales:extended"
        ]
        assert payload["governanceExport"]["orchestrationGate"]["available"] is True
        assert (
            payload["governanceExport"]["orchestrationGate"]["attemptErrorGatePassed"]
            is True
        )
        assert (
            payload["governanceExport"]["orchestrationGate"]["attemptSkippedGatePassed"]
            is True
        )
        assert payload["governanceExport"]["runtimePrereqs"]["present"] is True
        assert payload["governanceExport"]["runtimePrereqs"]["passed"] is True
        assert isinstance(payload["governanceExport"]["alerts"][0]["reasonCode"], str)
        assert payload["governanceExport"]["rolloutBlocked"] is False
        assert len(fake_db.integration_telemetry.inserted) == 1
        governance_event = fake_db.integration_telemetry.inserted[0]
        assert (
            governance_event["eventType"]
            == "integrations_traceability_baseline_governance_evaluated"
        )
        assert governance_event["payload"]["status"] == "PASS"
        assert governance_event["payload"]["orchestration_gate_available"] is True
        assert governance_event["payload"]["orchestration_attempt_error_gate_passed"] is True
        assert governance_event["payload"]["orchestration_attempt_skipped_gate_passed"] is True
        assert governance_event["payload"]["runtime_prereqs_present"] is True
        assert governance_event["payload"]["runtime_prereqs_available"] is True
        assert governance_event["payload"]["runtime_prereqs_passed"] is True
        assert governance_event["payload"]["runtime_prereqs_contract_valid"] is True
        assert governance_event["payload"]["runtime_prereqs_valid"] is True
        assert governance_event["payload"]["runtime_prereqs_missing_check_count"] == 0
        assert isinstance(governance_event["payload"]["reason_codes"], list)
        assert governance_event["payload"]["recommended_commands"] == [
            "npm run verify:ci:sales:extended"
        ]
        assert governance_event["payload"]["reason_code_count"] == len(payload["reasonCodes"])
        assert (
            governance_event["payload"]["recommended_command_count"]
            == len(payload["recommendedCommands"])
        )


def test_http_integrations_baseline_governance_handles_missing_artifact(monkeypatch):
    fake_db = _FakeDb(integration_doc={"userId": "u1"}, telemetry_docs=[])
    client = _build_client(monkeypatch, fake_db)
    with tempfile.TemporaryDirectory() as tmp:
        missing_path = Path(tmp) / "baseline_metrics.json"
        monkeypatch.setattr(
            real_integrations,
            "BASELINE_METRICS_ARTIFACT_PATH",
            missing_path,
        )
        response = client.get(
            "/api/integrations/integrations/telemetry/baseline-governance"
        )
        assert response.status_code == 404


def test_http_integrations_baseline_governance_handles_invalid_json(monkeypatch):
    fake_db = _FakeDb(integration_doc={"userId": "u1"}, telemetry_docs=[])
    client = _build_client(monkeypatch, fake_db)
    with tempfile.TemporaryDirectory() as tmp:
        artifact_path = Path(tmp) / "baseline_metrics.json"
        artifact_path.write_text("{invalid", encoding="utf-8")
        monkeypatch.setattr(
            real_integrations,
            "BASELINE_METRICS_ARTIFACT_PATH",
            artifact_path,
        )
        response = client.get(
            "/api/integrations/integrations/telemetry/baseline-governance"
        )
        assert response.status_code == 422


def test_http_integrations_baseline_governance_handles_non_object_json_root(monkeypatch):
    fake_db = _FakeDb(integration_doc={"userId": "u1"}, telemetry_docs=[])
    client = _build_client(monkeypatch, fake_db)
    with tempfile.TemporaryDirectory() as tmp:
        artifact_path = Path(tmp) / "baseline_metrics.json"
        artifact_path.write_text(json.dumps(["invalid-root"]), encoding="utf-8")
        monkeypatch.setattr(
            real_integrations,
            "BASELINE_METRICS_ARTIFACT_PATH",
            artifact_path,
        )
        response = client.get(
            "/api/integrations/integrations/telemetry/baseline-governance"
        )
        assert response.status_code == 422
        payload = response.json()
        assert "must be a JSON object" in payload.get("detail", "")


def test_http_integrations_baseline_governance_handles_artifact_read_oserror(monkeypatch):
    fake_db = _FakeDb(integration_doc={"userId": "u1"}, telemetry_docs=[])
    client = _build_client(monkeypatch, fake_db)
    with tempfile.TemporaryDirectory() as tmp:
        artifact_path = Path(tmp) / "baseline_metrics.json"
        artifact_path.write_text(json.dumps({"generatedAt": "2026-02-22T00:00:00+00:00"}), encoding="utf-8")
        monkeypatch.setattr(
            real_integrations,
            "BASELINE_METRICS_ARTIFACT_PATH",
            artifact_path,
        )

        original_read_text = Path.read_text

        def _read_text_with_oserror(self, *args, **kwargs):
            if self == artifact_path:
                raise OSError("simulated read failure")
            return original_read_text(self, *args, **kwargs)

        monkeypatch.setattr(Path, "read_text", _read_text_with_oserror, raising=True)
        response = client.get(
            "/api/integrations/integrations/telemetry/baseline-governance"
        )
        assert response.status_code == 422
        payload = response.json()
        assert "invalid JSON" in payload.get("detail", "")


def test_http_integrations_baseline_governance_handles_non_object_fixture_policy_payload(
    monkeypatch,
):
    fake_db = _FakeDb(integration_doc={"userId": "u1"}, telemetry_docs=[])
    client = _build_client(monkeypatch, fake_db)
    with tempfile.TemporaryDirectory() as tmp:
        artifact_path = Path(tmp) / "baseline_metrics.json"
        artifact_path.write_text(
            json.dumps(
                {
                    "generatedAt": "2026-02-22T00:00:00+00:00",
                    "overallStatus": "pass",
                    "releaseGateFixturePolicy": ["unexpected-root"],
                    "releaseGateFixtures": {
                        "allProfilesAvailable": True,
                        "availableProfileCount": 3,
                        "profileCount": 3,
                    },
                    "orchestrationGate": {
                        "available": True,
                        "decision": "PROCEED",
                        "attemptErrorGatePassed": True,
                        "attemptSkippedGatePassed": True,
                        "maxAttemptErrorCountThreshold": 5,
                        "observedAttemptErrorCount": 1,
                        "maxAttemptSkippedCountThreshold": 25,
                        "observedAttemptSkippedCount": 2,
                    },
                }
            ),
            encoding="utf-8",
        )
        monkeypatch.setattr(
            real_integrations,
            "BASELINE_METRICS_ARTIFACT_PATH",
            artifact_path,
        )
        response = client.get(
            "/api/integrations/integrations/telemetry/baseline-governance"
        )
        assert response.status_code == 200
        payload = response.json()
        assert payload["status"] == "FAIL"
        assert payload["releaseGateFixturePolicy"]["passed"] is False
        assert payload["releaseGateFixturePolicy"]["requiredProfiles"] == []
        assert payload["releaseGateFixturePolicy"]["missingProfiles"] == []
        assert payload["handoff"]["rolloutBlocked"] is True


def test_http_integrations_baseline_governance_handles_non_object_fixture_status_payload(
    monkeypatch,
):
    fake_db = _FakeDb(integration_doc={"userId": "u1"}, telemetry_docs=[])
    client = _build_client(monkeypatch, fake_db)
    with tempfile.TemporaryDirectory() as tmp:
        artifact_path = Path(tmp) / "baseline_metrics.json"
        artifact_path.write_text(
            json.dumps(
                {
                    "generatedAt": "2026-02-22T00:00:00+00:00",
                    "overallStatus": "pass",
                    "releaseGateFixturePolicy": {
                        "passed": True,
                        "requiredProfiles": ["pass", "hold", "validation-fail"],
                        "missingProfiles": [],
                        "message": "All required release-gate fixture profiles are present.",
                    },
                    "releaseGateFixtures": ["unexpected-root"],
                    "orchestrationGate": {
                        "available": True,
                        "decision": "PROCEED",
                        "attemptErrorGatePassed": True,
                        "attemptSkippedGatePassed": True,
                        "maxAttemptErrorCountThreshold": 5,
                        "observedAttemptErrorCount": 1,
                        "maxAttemptSkippedCountThreshold": 25,
                        "observedAttemptSkippedCount": 2,
                    },
                }
            ),
            encoding="utf-8",
        )
        monkeypatch.setattr(
            real_integrations,
            "BASELINE_METRICS_ARTIFACT_PATH",
            artifact_path,
        )
        response = client.get(
            "/api/integrations/integrations/telemetry/baseline-governance"
        )
        assert response.status_code == 200
        payload = response.json()
        assert payload["status"] == "FAIL"
        assert payload["releaseGateFixturePolicy"]["passed"] is True
        assert payload["releaseGateFixtures"]["allProfilesAvailable"] is False
        assert payload["handoff"]["rolloutBlocked"] is True
        assert any(
            "availability status is incomplete or failed" in alert
            for alert in payload.get("alerts", [])
        )


def test_http_integrations_baseline_governance_coerces_invalid_fixture_counts(
    monkeypatch,
):
    fake_db = _FakeDb(integration_doc={"userId": "u1"}, telemetry_docs=[])
    client = _build_client(monkeypatch, fake_db)
    with tempfile.TemporaryDirectory() as tmp:
        artifact_path = Path(tmp) / "baseline_metrics.json"
        artifact_path.write_text(
            json.dumps(
                {
                    "generatedAt": "2026-02-22T00:00:00+00:00",
                    "overallStatus": "pass",
                    "releaseGateFixturePolicy": {
                        "passed": True,
                        "requiredProfiles": ["pass", "hold", "validation-fail"],
                        "missingProfiles": [],
                        "message": "All required release-gate fixture profiles are present.",
                    },
                    "releaseGateFixtures": {
                        "allProfilesAvailable": True,
                        "availableProfileCount": "not-a-number",
                        "profileCount": -5,
                    },
                    "orchestrationGate": {
                        "available": True,
                        "decision": "PROCEED",
                        "attemptErrorGatePassed": True,
                        "attemptSkippedGatePassed": True,
                        "maxAttemptErrorCountThreshold": 5,
                        "observedAttemptErrorCount": 1,
                        "maxAttemptSkippedCountThreshold": 25,
                        "observedAttemptSkippedCount": 2,
                    },
                }
            ),
            encoding="utf-8",
        )
        monkeypatch.setattr(
            real_integrations,
            "BASELINE_METRICS_ARTIFACT_PATH",
            artifact_path,
        )
        response = client.get(
            "/api/integrations/integrations/telemetry/baseline-governance"
        )
        assert response.status_code == 200
        payload = response.json()
        assert payload["releaseGateFixtures"]["allProfilesAvailable"] is True
        assert payload["releaseGateFixtures"]["availableProfileCount"] == 0
        assert payload["releaseGateFixtures"]["profileCount"] == 0
        assert payload["orchestrationGate"]["available"] is True


def test_http_integrations_baseline_governance_handles_non_object_orchestration_gate_payload(
    monkeypatch,
):
    fake_db = _FakeDb(integration_doc={"userId": "u1"}, telemetry_docs=[])
    client = _build_client(monkeypatch, fake_db)
    with tempfile.TemporaryDirectory() as tmp:
        artifact_path = Path(tmp) / "baseline_metrics.json"
        artifact_path.write_text(
            json.dumps(
                {
                    "generatedAt": "2026-02-22T00:00:00+00:00",
                    "overallStatus": "pass",
                    "releaseGateFixturePolicy": {
                        "passed": True,
                        "requiredProfiles": ["pass", "hold", "validation-fail"],
                        "missingProfiles": [],
                        "message": "All required release-gate fixture profiles are present.",
                    },
                    "releaseGateFixtures": {
                        "allProfilesAvailable": True,
                        "availableProfileCount": 3,
                        "profileCount": 3,
                    },
                    "orchestrationGate": ["unexpected-root"],
                }
            ),
            encoding="utf-8",
        )
        monkeypatch.setattr(
            real_integrations,
            "BASELINE_METRICS_ARTIFACT_PATH",
            artifact_path,
        )
        response = client.get(
            "/api/integrations/integrations/telemetry/baseline-governance"
        )
        assert response.status_code == 200
        payload = response.json()
        assert payload["status"] == "FAIL"
        assert payload["orchestrationGate"]["available"] is False
        assert payload["orchestrationGate"]["attemptErrorGatePassed"] is None
        assert payload["orchestrationGate"]["attemptSkippedGatePassed"] is None
        assert payload["recommendedCommands"][0] == (
            "npm run verify:smoke:baseline-orchestration-remediation"
        )
        assert payload["recommendedCommands"][1:4] == [
            "npm run verify:baseline:command-aliases:artifact",
            "npm run verify:baseline:command-aliases:artifact:contract",
            "npm run verify:smoke:baseline-command-aliases-artifact",
        ]
        assert "npm run verify:smoke:orchestration-slo-gate" not in payload[
            "recommendedCommands"
        ]
        assert "npm run verify:baseline:metrics" not in payload["recommendedCommands"]
        assert "npm run verify:smoke:baseline-governance-drift" not in payload[
            "recommendedCommands"
        ]
        assert any(
            "orchestration gate evidence is unavailable" in alert.lower()
            for alert in payload.get("alerts", [])
        )
        assert any(
            item.get("command")
            == "npm run verify:smoke:baseline-orchestration-remediation"
            for item in payload.get("rolloutActions", [])
        )


def test_http_integrations_baseline_governance_coerces_invalid_orchestration_counts(
    monkeypatch,
):
    fake_db = _FakeDb(integration_doc={"userId": "u1"}, telemetry_docs=[])
    client = _build_client(monkeypatch, fake_db)
    with tempfile.TemporaryDirectory() as tmp:
        artifact_path = Path(tmp) / "baseline_metrics.json"
        artifact_path.write_text(
            json.dumps(
                {
                    "generatedAt": "2026-02-22T00:00:00+00:00",
                    "overallStatus": "fail",
                    "releaseGateFixturePolicy": {
                        "passed": True,
                        "requiredProfiles": ["pass", "hold", "validation-fail"],
                        "missingProfiles": [],
                        "message": "All required release-gate fixture profiles are present.",
                    },
                    "releaseGateFixtures": {
                        "allProfilesAvailable": True,
                        "availableProfileCount": 3,
                        "profileCount": 3,
                    },
                    "orchestrationGate": {
                        "available": True,
                        "decision": "HOLD",
                        "attemptErrorGatePassed": False,
                        "attemptSkippedGatePassed": True,
                        "maxAttemptErrorCountThreshold": {"unexpected": 1},
                        "observedAttemptErrorCount": "not-a-number",
                        "maxAttemptSkippedCountThreshold": -1,
                        "observedAttemptSkippedCount": ["invalid"],
                    },
                }
            ),
            encoding="utf-8",
        )
        monkeypatch.setattr(
            real_integrations,
            "BASELINE_METRICS_ARTIFACT_PATH",
            artifact_path,
        )
        response = client.get(
            "/api/integrations/integrations/telemetry/baseline-governance"
        )
        assert response.status_code == 200
        payload = response.json()
        assert payload["status"] == "FAIL"
        assert payload["orchestrationGate"]["available"] is True
        assert payload["orchestrationGate"]["decision"] == "HOLD"
        assert payload["orchestrationGate"]["attemptErrorGatePassed"] is False
        assert payload["orchestrationGate"]["attemptSkippedGatePassed"] is True
        assert payload["orchestrationGate"]["maxAttemptErrorCountThreshold"] is None
        assert payload["orchestrationGate"]["observedAttemptErrorCount"] is None
        assert payload["orchestrationGate"]["maxAttemptSkippedCountThreshold"] is None
        assert payload["orchestrationGate"]["observedAttemptSkippedCount"] is None
        assert (
            payload["governanceExport"]["orchestrationGate"][
                "maxAttemptErrorCountThreshold"
            ]
            is None
        )
        assert (
            payload["governanceExport"]["orchestrationGate"][
                "observedAttemptErrorCount"
            ]
            is None
        )
        assert (
            payload["governanceExport"]["orchestrationGate"][
                "maxAttemptSkippedCountThreshold"
            ]
            is None
        )
        assert (
            payload["governanceExport"]["orchestrationGate"][
                "observedAttemptSkippedCount"
            ]
            is None
        )
        assert "baseline_orchestration_attempt_error_failed" in payload["reasonCodes"]


def test_http_integrations_baseline_governance_rejects_boolean_orchestration_counts(
    monkeypatch,
):
    fake_db = _FakeDb(integration_doc={"userId": "u1"}, telemetry_docs=[])
    client = _build_client(monkeypatch, fake_db)
    with tempfile.TemporaryDirectory() as tmp:
        artifact_path = Path(tmp) / "baseline_metrics.json"
        artifact_path.write_text(
            json.dumps(
                {
                    "generatedAt": "2026-02-22T00:00:00+00:00",
                    "overallStatus": "fail",
                    "releaseGateFixturePolicy": {
                        "passed": True,
                        "requiredProfiles": ["pass", "hold", "validation-fail"],
                        "missingProfiles": [],
                        "message": "All required release-gate fixture profiles are present.",
                    },
                    "releaseGateFixtures": {
                        "allProfilesAvailable": True,
                        "availableProfileCount": 3,
                        "profileCount": 3,
                    },
                    "orchestrationGate": {
                        "available": True,
                        "decision": "HOLD",
                        "attemptErrorGatePassed": False,
                        "attemptSkippedGatePassed": True,
                        "maxAttemptErrorCountThreshold": True,
                        "observedAttemptErrorCount": False,
                        "maxAttemptSkippedCountThreshold": True,
                        "observedAttemptSkippedCount": False,
                    },
                }
            ),
            encoding="utf-8",
        )
        monkeypatch.setattr(
            real_integrations,
            "BASELINE_METRICS_ARTIFACT_PATH",
            artifact_path,
        )
        response = client.get(
            "/api/integrations/integrations/telemetry/baseline-governance"
        )
        assert response.status_code == 200
        payload = response.json()
        assert payload["status"] == "FAIL"
        assert payload["orchestrationGate"]["maxAttemptErrorCountThreshold"] is None
        assert payload["orchestrationGate"]["observedAttemptErrorCount"] is None
        assert payload["orchestrationGate"]["maxAttemptSkippedCountThreshold"] is None
        assert payload["orchestrationGate"]["observedAttemptSkippedCount"] is None
        assert (
            payload["governanceExport"]["orchestrationGate"][
                "maxAttemptErrorCountThreshold"
            ]
            is None
        )
        assert (
            payload["governanceExport"]["orchestrationGate"][
                "observedAttemptErrorCount"
            ]
            is None
        )
        assert (
            payload["governanceExport"]["orchestrationGate"][
                "maxAttemptSkippedCountThreshold"
            ]
            is None
        )
        assert (
            payload["governanceExport"]["orchestrationGate"][
                "observedAttemptSkippedCount"
            ]
            is None
        )


def test_http_integrations_baseline_governance_normalizes_artifact_recommended_commands(
    monkeypatch,
):
    fake_db = _FakeDb(integration_doc={"userId": "u1"}, telemetry_docs=[])
    client = _build_client(monkeypatch, fake_db)
    with tempfile.TemporaryDirectory() as tmp:
        artifact_path = Path(tmp) / "baseline_metrics.json"
        artifact_path.write_text(
            json.dumps(
                {
                    "generatedAt": "2026-02-22T00:00:00+00:00",
                    "overallStatus": "fail",
                    "releaseGateFixturePolicy": {
                        "passed": True,
                        "requiredProfiles": ["pass", "hold", "validation-fail"],
                        "missingProfiles": [],
                        "message": "All required release-gate fixture profiles are present.",
                    },
                    "releaseGateFixtures": {
                        "allProfilesAvailable": True,
                        "availableProfileCount": 3,
                        "profileCount": 3,
                    },
                    "orchestrationGate": {
                        "available": True,
                        "decision": "HOLD",
                        "attemptErrorGatePassed": False,
                        "attemptSkippedGatePassed": True,
                        "maxAttemptErrorCountThreshold": 5,
                        "observedAttemptErrorCount": 9,
                        "maxAttemptSkippedCountThreshold": 25,
                        "observedAttemptSkippedCount": 1,
                    },
                    "recommendedCommands": [
                        "",
                        "npm run verify:baseline:metrics",
                        "npm run verify:smoke:orchestration-slo-gate",
                        "npm run verify:smoke:baseline-governance-drift",
                        "npm run verify:smoke:baseline-orchestration-remediation",
                        "npm run verify:ci:sales:extended",
                        None,
                    ],
                }
            ),
            encoding="utf-8",
        )
        monkeypatch.setattr(
            real_integrations,
            "BASELINE_METRICS_ARTIFACT_PATH",
            artifact_path,
        )
        response = client.get(
            "/api/integrations/integrations/telemetry/baseline-governance"
        )
        assert response.status_code == 200
        payload = response.json()
        assert payload["status"] == "FAIL"
        assert payload["recommendedCommands"][0] == (
            "npm run verify:smoke:baseline-orchestration-remediation"
        )
        assert payload["recommendedCommands"][1:4] == [
            "npm run verify:baseline:command-aliases:artifact",
            "npm run verify:baseline:command-aliases:artifact:contract",
            "npm run verify:smoke:baseline-command-aliases-artifact",
        ]
        assert "npm run verify:smoke:orchestration-slo-gate" not in payload[
            "recommendedCommands"
        ]
        assert "npm run verify:baseline:metrics" not in payload["recommendedCommands"]
        assert "npm run verify:smoke:baseline-governance-drift" not in payload[
            "recommendedCommands"
        ]
        assert payload["governanceExport"]["recommendedCommands"] == payload[
            "recommendedCommands"
        ]


def test_http_integrations_baseline_governance_holds_on_orchestration_gate_failures(
    monkeypatch,
):
    fake_db = _FakeDb(integration_doc={"userId": "u1"}, telemetry_docs=[])
    client = _build_client(monkeypatch, fake_db)
    with tempfile.TemporaryDirectory() as tmp:
        artifact_path = Path(tmp) / "baseline_metrics.json"
        artifact_path.write_text(
            json.dumps(
                {
                    "generatedAt": "2026-02-22T00:00:00+00:00",
                    "overallStatus": "pass",
                    "releaseGateFixturePolicy": {
                        "passed": True,
                        "requiredProfiles": ["pass", "hold", "validation-fail"],
                        "missingProfiles": [],
                        "message": "All required release-gate fixture profiles are present.",
                    },
                    "releaseGateFixtures": {
                        "allProfilesAvailable": True,
                        "availableProfileCount": 3,
                        "profileCount": 3,
                    },
                    "orchestrationGate": {
                        "available": True,
                        "decision": "HOLD",
                        "attemptErrorGatePassed": False,
                        "attemptSkippedGatePassed": False,
                        "maxAttemptErrorCountThreshold": 1,
                        "observedAttemptErrorCount": 3,
                        "maxAttemptSkippedCountThreshold": 2,
                        "observedAttemptSkippedCount": 5,
                    },
                }
            ),
            encoding="utf-8",
        )
        monkeypatch.setattr(
            real_integrations,
            "BASELINE_METRICS_ARTIFACT_PATH",
            artifact_path,
        )
        response = client.get(
            "/api/integrations/integrations/telemetry/baseline-governance"
        )
        assert response.status_code == 200
        payload = response.json()
        assert payload["status"] == "FAIL"
        assert payload["handoff"]["rolloutBlocked"] is True
        assert payload["orchestrationGate"]["available"] is True
        assert payload["orchestrationGate"]["decision"] == "HOLD"
        assert payload["orchestrationGate"]["attemptErrorGatePassed"] is False
        assert payload["orchestrationGate"]["attemptSkippedGatePassed"] is False
        assert any(
            "orchestration gate failed" in alert.lower()
            for alert in payload.get("alerts", [])
        )


def test_http_integrations_baseline_governance_includes_command_alias_artifact_summary(
    monkeypatch,
):
    fake_db = _FakeDb(integration_doc={"userId": "u1"}, telemetry_docs=[])
    client = _build_client(monkeypatch, fake_db)
    with tempfile.TemporaryDirectory() as tmp:
        artifact_path = Path(tmp) / "baseline_metrics.json"
        alias_artifact_path = Path(tmp) / "sales_baseline_command_aliases.json"
        artifact_path.write_text(
            json.dumps(
                {
                    "generatedAt": "2026-02-22T00:00:00+00:00",
                    "overallStatus": "pass",
                    "releaseGateFixturePolicy": {
                        "passed": True,
                        "requiredProfiles": ["pass", "hold", "validation-fail"],
                        "missingProfiles": [],
                        "message": "All required release-gate fixture profiles are present.",
                    },
                    "releaseGateFixtures": {
                        "allProfilesAvailable": True,
                        "availableProfileCount": 3,
                        "profileCount": 3,
                    },
                    "orchestrationGate": {
                        "available": True,
                        "decision": "PROCEED",
                        "attemptErrorGatePassed": True,
                        "attemptSkippedGatePassed": True,
                        "maxAttemptErrorCountThreshold": 5,
                        "observedAttemptErrorCount": 1,
                        "maxAttemptSkippedCountThreshold": 25,
                        "observedAttemptSkippedCount": 2,
                    },
                }
            ),
            encoding="utf-8",
        )
        alias_artifact_path.write_text(
            json.dumps(
                {
                    "generatedAt": "2026-02-22T00:05:00+00:00",
                    "command": "verify_sales_baseline_command_aliases",
                    "artifact": {
                        "valid": False,
                        "validatedAt": "2026-02-22T00:05:05+00:00",
                        "command": "verify_sales_baseline_command_aliases",
                        "requiredAliases": {
                            "test": "npm run verify:backend:sales",
                            "typecheck": "npm run check",
                        },
                        "aliasChecks": {
                            "test": {
                                "actual": "npm run verify:backend:sales",
                                "expected": "npm run verify:backend:sales",
                                "valid": True,
                            },
                            "typecheck": {
                                "actual": "npm run verify:backend:sales",
                                "expected": "npm run check",
                                "valid": False,
                            },
                        },
                        "missingAliases": ["verify:smoke:sales"],
                        "mismatchedAliases": ["typecheck"],
                        "errors": [],
                        "packageJsonExists": True,
                        "packageJsonPath": "/Users/AIL/Documents/EngageAI/EngageAI2/package.json",
                    },
                }
            ),
            encoding="utf-8",
        )
        monkeypatch.setattr(
            real_integrations,
            "BASELINE_METRICS_ARTIFACT_PATH",
            artifact_path,
        )
        monkeypatch.setattr(
            real_integrations,
            "BASELINE_COMMAND_ALIASES_ARTIFACT_PATH",
            alias_artifact_path,
        )
        response = client.get(
            "/api/integrations/integrations/telemetry/baseline-governance"
        )
        assert response.status_code == 200
        payload = response.json()
        assert payload["commandAliases"]["present"] is True
        assert payload["commandAliases"]["available"] is True
        assert payload["commandAliases"]["source"] == "artifact_file"
        assert payload["commandAliases"]["contractValid"] is True
        assert payload["commandAliases"]["valid"] is False
        assert payload["commandAliases"]["gatePassed"] is False
        assert payload["commandAliases"]["missingAliasCount"] == 1
        assert payload["commandAliases"]["mismatchedAliasCount"] == 1
        assert payload["commandAliases"]["missingAliases"] == ["verify:smoke:sales"]
        assert payload["commandAliases"]["mismatchedAliases"] == ["typecheck"]
        assert payload["governanceExport"]["commandAliases"] == payload[
            "commandAliases"
        ]
        assert len(fake_db.integration_telemetry.inserted) == 1
        governance_event = fake_db.integration_telemetry.inserted[0]
        assert governance_event["payload"]["command_aliases_present"] is True
        assert governance_event["payload"]["command_aliases_available"] is True
        assert governance_event["payload"]["command_aliases_contract_valid"] is True
        assert governance_event["payload"]["command_aliases_valid"] is False
        assert governance_event["payload"]["command_aliases_gate_passed"] is False
        assert governance_event["payload"]["command_aliases_missing_alias_count"] == 1
        assert (
            governance_event["payload"]["command_aliases_mismatched_alias_count"] == 1
        )


def test_http_integrations_baseline_governance_holds_on_runtime_prereqs_gate_failures(
    monkeypatch,
):
    fake_db = _FakeDb(integration_doc={"userId": "u1"}, telemetry_docs=[])
    client = _build_client(monkeypatch, fake_db)
    with tempfile.TemporaryDirectory() as tmp:
        artifact_path = Path(tmp) / "baseline_metrics.json"
        artifact_path.write_text(
            json.dumps(
                {
                    "generatedAt": "2026-02-22T00:00:00+00:00",
                    "overallStatus": "pass",
                    "releaseGateFixturePolicy": {
                        "passed": True,
                        "requiredProfiles": ["pass", "hold", "validation-fail"],
                        "missingProfiles": [],
                        "message": "All required release-gate fixture profiles are present.",
                    },
                    "releaseGateFixtures": {
                        "allProfilesAvailable": True,
                        "availableProfileCount": 3,
                        "profileCount": 3,
                    },
                    "orchestrationGate": {
                        "available": True,
                        "decision": "PROCEED",
                        "attemptErrorGatePassed": True,
                        "attemptSkippedGatePassed": True,
                        "maxAttemptErrorCountThreshold": 5,
                        "observedAttemptErrorCount": 1,
                        "maxAttemptSkippedCountThreshold": 25,
                        "observedAttemptSkippedCount": 2,
                    },
                    "runtimePrereqs": {
                        "available": True,
                        "passed": False,
                        "artifactPath": "/tmp/sales_runtime_prereqs.json",
                        "generatedAt": "2026-02-22T00:00:00+00:00",
                        "validatedAt": "2026-02-22T00:00:00+00:00",
                        "command": "verify_sales_runtime_prereqs",
                        "valid": False,
                        "contractValid": True,
                        "missingChecks": {"commands": ["node"], "workspace": []},
                        "missingCheckCount": 1,
                    },
                }
            ),
            encoding="utf-8",
        )
        monkeypatch.setattr(
            real_integrations,
            "BASELINE_METRICS_ARTIFACT_PATH",
            artifact_path,
        )
        response = client.get(
            "/api/integrations/integrations/telemetry/baseline-governance"
        )
        assert response.status_code == 200
        payload = response.json()
        assert payload["status"] == "FAIL"
        assert payload["handoff"]["rolloutBlocked"] is True
        assert payload["runtimePrereqs"]["present"] is True
        assert payload["runtimePrereqs"]["passed"] is False
        assert payload["runtimePrereqs"]["contractValid"] is True
        assert payload["runtimePrereqs"]["valid"] is False
        assert payload["runtimePrereqs"]["missingChecks"]["commands"] == ["node"]
        assert payload["runtimePrereqs"]["missingCheckCount"] == 1
        assert any(
            "runtime prerequisite checks failed" in alert.lower()
            for alert in payload.get("alerts", [])
        )
        assert any(
            item.get("command") == "npm run verify:smoke:runtime-prereqs-artifact"
            for item in payload.get("rolloutActions", [])
        )
        assert "npm run verify:smoke:baseline-governance-drift" in payload[
            "recommendedCommands"
        ]
        assert "npm run verify:smoke:runtime-prereqs-artifact" in payload[
            "recommendedCommands"
        ]
        assert payload["governanceExport"]["runtimePrereqs"]["passed"] is False
        assert len(fake_db.integration_telemetry.inserted) == 1
        governance_event = fake_db.integration_telemetry.inserted[0]
        assert governance_event["payload"]["runtime_prereqs_present"] is True
        assert governance_event["payload"]["runtime_prereqs_passed"] is False
        assert governance_event["payload"]["runtime_prereqs_valid"] is False
        assert governance_event["payload"]["runtime_prereqs_contract_valid"] is True
        assert governance_event["payload"]["runtime_prereqs_missing_check_count"] == 1
        assert governance_event["payload"]["runtime_prereqs_missing_commands"] == ["node"]
        assert governance_event["payload"]["runtime_prereqs_missing_workspace"] == []


def test_http_integrations_governance_report(monkeypatch):
    fake_db = _FakeDb(
        integration_doc={"userId": "u1"},
        telemetry_docs=[
            {
                "id": "g1",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "integrations_traceability_status_evaluated",
                "payload": {"decision": "HOLD", "request_id": "req-traceability-1"},
                "createdAt": "2026-02-19T09:00:00+00:00",
            },
            {
                "id": "g2",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "integrations_traceability_snapshot_governance_evaluated",
                "payload": {
                    "status": "ACTION_REQUIRED",
                    "request_id": "req-snapshot-1",
                    "rollout_blocked": True,
                },
                "createdAt": "2026-02-19T10:00:00+00:00",
            },
            {
                "id": "g3",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "integrations_traceability_baseline_governance_evaluated",
                "payload": {"status": "PASS", "request_id": "req-baseline-1"},
                "createdAt": "2026-02-20T10:00:00+00:00",
            },
            {
                "id": "g4",
                "userId": "u1",
                "provider": "apollo",
                "eventType": "apollo_search_success",
                "payload": {"request_id": "req-ignore"},
                "createdAt": "2026-02-20T11:00:00+00:00",
            },
            {
                "id": "g5",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "integrations_connector_rate_limited",
                "payload": {
                    "endpoint": "apollo_search",
                    "retry_after_seconds": 46,
                    "reset_in_seconds": 44,
                },
                "createdAt": "2026-02-20T11:02:00+00:00",
            },
            {
                "id": "g6",
                "userId": "u1",
                "provider": "sendgrid",
                "eventType": "sendgrid_webhook_processed",
                "payload": {
                    "timestamp_pressure_label": "moderate",
                    "timestamp_pressure_hint": "Validate event timestamp source clocks.",
                    "timestamp_anomaly_count": 2,
                    "timestamp_anomaly_rate_pct": 50.0,
                    "timestamp_fallback_count": 1,
                    "future_skew_event_count": 0,
                    "stale_event_count": 1,
                    "fresh_event_count": 0,
                    "timestamp_age_bucket_counts": {"stale": 1, "fallback": 1},
                    "timestamp_anomaly_event_type_counts": {"open": 1, "processed": 1},
                    "timestamp_dominant_anomaly_bucket": "stale",
                    "timestamp_dominant_anomaly_event_type": "open",
                    "timestamp_pressure_high_anomaly_rate_pct": 20.0,
                    "timestamp_pressure_moderate_anomaly_rate_pct": 5.0,
                    "timestamp_pressure_high_anomaly_count": 10,
                    "timestamp_pressure_moderate_anomaly_count": 3,
                },
                "createdAt": "2026-02-20T11:03:00+00:00",
            },
        ],
    )
    client = _build_client(monkeypatch, fake_db)
    response = client.get(
        "/api/integrations/integrations/telemetry/governance-report?days=30&limit=500"
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["governanceType"] == "weekly_report"
    assert payload["exportSchemaVersion"] == 1
    assert payload["schemaMetadata"]["activeVersion"] == 1
    assert payload["schemaMetadata"]["source"] == "default"
    assert payload["status"] == "ACTION_REQUIRED"
    assert isinstance(payload["alerts"], list)
    assert isinstance(payload["reasonCodes"], list)
    assert isinstance(payload["reasonCodeCount"], int)
    assert payload["reasonCodeCount"] == len(payload["reasonCodes"])
    assert payload["handoff"]["rolloutBlocked"] is True
    assert payload["totals"]["governanceEventCount"] == 2
    assert payload["totals"]["traceabilityEvaluationCount"] == 1
    assert payload["totals"]["snapshotEvaluationCount"] == 1
    assert payload["totals"]["baselineEvaluationCount"] == 1
    assert payload["totals"]["actionRequiredCount"] == 1
    assert payload["totals"]["connectorRateLimitEventCount"] == 1
    assert payload["totals"]["rolloutBlockedCount"] == 2
    assert payload["connectorRateLimit"]["eventCount"] == 1
    assert payload["connectorRateLimit"]["byEndpoint"]["apollo_search"] == 1
    assert payload["connectorRateLimit"]["maxRetryAfterSeconds"] == 46.0
    assert payload["connectorRateLimit"]["avgResetInSeconds"] == 44.0
    assert payload["connectorRateLimit"]["pressure"]["label"] == "High"
    assert payload["sendgridWebhookTimestamp"]["eventCount"] == 1
    assert payload["sendgridWebhookTimestamp"]["pressureLabelCounts"]["Moderate"] == 1
    assert payload["sendgridWebhookTimestamp"]["timestampAnomalyCountTotal"] == 2
    assert payload["sendgridWebhookTimestamp"]["timestampAgeBucketCounts"]["stale"] == 1
    assert payload["governanceExport"]["sendgridWebhookTimestamp"]["eventCount"] == 1
    assert payload["sendgridWebhookTimestampParity"]["eventCountMatchesNested"] is True
    assert payload["sendgridWebhookTimestampParity"]["eventCountMatchesTotals"] is True
    assert (
        payload["sendgridWebhookTimestampParity"]["anomalyCountTotalMatchesNested"]
        is True
    )
    assert (
        payload["sendgridWebhookTimestampParity"]["pressureLabelCountsMatchNested"]
        is True
    )
    assert payload["sendgridWebhookTimestampParity"]["ageBucketCountsMatchNested"] is True
    assert payload["connectorPressureParity"]["eventCountMatchesNested"] is True
    assert payload["connectorPressureParity"]["eventCountMatchesTotals"] is True
    assert payload["connectorPressureParity"]["byEndpointMatchesNested"] is True
    assert payload["connectorPressureParity"]["pressureLabelMatchesNested"] is True
    assert isinstance(payload.get("runtimePrereqs"), dict)
    assert isinstance(payload["governanceExport"].get("runtimePrereqs"), dict)
    assert payload["governanceExport"].get("runtimePrereqs") == payload.get(
        "runtimePrereqs"
    )
    assert isinstance(payload["runtimePrereqs"].get("present"), bool)
    assert isinstance(payload["runtimePrereqs"].get("available"), bool)
    assert payload["runtimePrereqs"].get("passed") in (True, False, None)
    assert payload["runtimePrereqs"].get("contractValid") in (True, False, None)
    assert payload["runtimePrereqs"].get("valid") in (True, False, None)
    assert isinstance(payload["runtimePrereqs"].get("missingCheckCount"), int)
    assert isinstance(
        (payload["runtimePrereqs"].get("missingChecks") or {}).get("commands", []),
        list,
    )
    assert isinstance(
        (payload["runtimePrereqs"].get("missingChecks") or {}).get("workspace", []),
        list,
    )
    assert payload["totals"]["runtimePrereqsMissingCheckCount"] == payload["runtimePrereqs"][
        "missingCheckCount"
    ]
    assert payload["governanceStatusCounts"]["ACTION_REQUIRED"] == 1
    assert payload["governanceStatusCounts"]["PASS"] == 1
    assert payload["traceabilityDecisionCounts"]["HOLD"] == 1
    assert len(payload["timeline"]) >= 1
    assert len(payload["latestEvents"]) == 3
    assert payload["latestEvents"][0]["requestId"] == "req-baseline-1"
    assert len(payload["ownerActionMatrix"]) >= 1
    assert "npm run verify:smoke:traceability-governance-handoff" in payload["recommendedCommands"]
    assert "npm run verify:governance:weekly:report" in payload["recommendedCommands"]
    assert isinstance(payload["recommendedCommandCount"], int)
    assert payload["recommendedCommandCount"] == len(payload["recommendedCommands"])
    assert payload["governanceExport"]["governanceType"] == "weekly_report"
    assert payload["governanceExport"]["exportSchemaVersion"] == 1
    assert payload["governanceExport"]["schemaMetadata"]["activeVersion"] == 1
    assert payload["governanceExport"]["reasonCodes"] == payload["reasonCodes"]
    assert payload["governanceExport"]["reasonCodeCount"] == payload["reasonCodeCount"]
    assert (
        payload["governanceExport"]["recommendedCommandCount"]
        == payload["recommendedCommandCount"]
    )
    assert isinstance(payload["governanceExport"]["alerts"][0]["reasonCode"], str)
    assert payload["governanceExport"]["status"] == "ACTION_REQUIRED"
    assert payload["governanceExport"]["rolloutBlocked"] is True
    assert payload["governanceExport"]["requestedBy"] == "u1"
    assert len(fake_db.integration_telemetry.inserted) == 1
    governance_report_event = fake_db.integration_telemetry.inserted[0]
    assert (
        governance_report_event["eventType"]
        == "integrations_traceability_governance_report_generated"
    )
    assert governance_report_event["payload"]["governance_event_count"] == 2
    assert governance_report_event["payload"]["action_required_count"] == 1
    assert governance_report_event["payload"]["connector_rate_limit_event_count"] == 1
    assert governance_report_event["payload"]["connector_rate_limit_pressure_label"] == "High"
    assert governance_report_event["payload"]["sendgrid_webhook_timestamp_event_count"] == 1
    assert (
        governance_report_event["payload"]["sendgrid_webhook_timestamp_anomaly_count_total"]
        == 2
    )
    assert governance_report_event["payload"]["export_schema_version"] == 1
    assert governance_report_event["payload"]["runtime_prereqs_present"] == payload[
        "runtimePrereqs"
    ]["present"]
    assert governance_report_event["payload"]["runtime_prereqs_available"] == payload[
        "runtimePrereqs"
    ]["available"]
    assert governance_report_event["payload"]["runtime_prereqs_passed"] == payload[
        "runtimePrereqs"
    ]["passed"]
    assert governance_report_event["payload"]["runtime_prereqs_contract_valid"] == payload[
        "runtimePrereqs"
    ]["contractValid"]
    assert governance_report_event["payload"]["runtime_prereqs_valid"] == payload[
        "runtimePrereqs"
    ]["valid"]
    assert governance_report_event["payload"]["runtime_prereqs_missing_check_count"] == payload[
        "runtimePrereqs"
    ]["missingCheckCount"]
    assert isinstance(
        governance_report_event["payload"]["runtime_prereqs_missing_commands"], list
    )
    assert isinstance(
        governance_report_event["payload"]["runtime_prereqs_missing_workspace"], list
    )
    assert isinstance(governance_report_event["payload"]["runtime_prereqs_command"], str)
    assert isinstance(governance_report_event["payload"]["reason_codes"], list)
    assert governance_report_event["payload"]["recommended_commands"] == payload["recommendedCommands"]
    assert governance_report_event["payload"]["reason_code_count"] == len(payload["reasonCodes"])
    assert (
        governance_report_event["payload"]["recommended_command_count"]
        == len(payload["recommendedCommands"])
    )
    assert (
        governance_report_event["payload"][
            "sendgrid_webhook_timestamp_parity_event_count_matches_nested"
        ]
        is True
    )
    assert (
        governance_report_event["payload"][
            "sendgrid_webhook_timestamp_parity_event_count_matches_totals"
        ]
        is True
    )
    assert (
        governance_report_event["payload"][
            "sendgrid_webhook_timestamp_parity_anomaly_count_total_matches_nested"
        ]
        is True
    )


def test_http_integrations_governance_schema_metadata_endpoint(monkeypatch):
    fake_db = _FakeDb(integration_doc={"userId": "u1"}, telemetry_docs=[])
    client = _build_client(monkeypatch, fake_db)

    response = client.get(
        "/api/integrations/integrations/telemetry/governance-schema"
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["governanceType"] == "schema_metadata"
    assert payload["status"] == "READY"
    assert payload["schemaMetadata"]["activeVersion"] == 1
    assert payload["schemaMetadata"]["defaultVersion"] == 1
    assert payload["schemaMetadata"]["supportedVersions"] == [1]
    assert payload["schemaMetadata"]["source"] == "default"
    assert payload["schemaMetadata"]["override"]["isSet"] is False
    assert isinstance(payload["reasonCodes"], list)
    assert payload["handoff"]["rolloutBlocked"] is False
    assert isinstance(payload["rolloutActions"], list)
    assert "npm run verify:governance:schema:preflight" in payload["recommendedCommands"]
    assert "npm run verify:governance:packet:contract" in payload["recommendedCommands"]
    assert payload["governanceExport"]["governanceType"] == "schema_metadata"
    assert payload["governanceExport"]["status"] == payload["status"]
    assert payload["governanceExport"]["rolloutBlocked"] is False
    assert payload["governanceExport"]["schemaMetadata"]["activeVersion"] == 1
    assert payload["governanceExport"]["ownerRole"] == payload["handoff"]["ownerRole"]
    assert payload["governanceExport"]["recommendedCommands"] == payload["recommendedCommands"]
    assert payload["governanceExport"]["reasonCodes"] == payload["reasonCodes"]
    assert payload["handoff"]["actions"] == [
        action.get("action")
        for action in payload["rolloutActions"]
        if action.get("action")
    ]
    top_level_reason_codes = set(payload.get("reasonCodes") or [])
    rollout_action_reason_codes = {
        action.get("reasonCode")
        for action in payload.get("rolloutActions") or []
        if isinstance(action.get("reasonCode"), str)
    }
    export_action_reason_codes = {
        action.get("reasonCode")
        for action in payload["governanceExport"].get("actions") or []
        if isinstance(action.get("reasonCode"), str)
    }
    export_alert_reason_codes = {
        alert.get("reasonCode")
        for alert in payload["governanceExport"].get("alerts") or []
        if isinstance(alert.get("reasonCode"), str)
    }
    assert top_level_reason_codes == rollout_action_reason_codes
    assert top_level_reason_codes == export_action_reason_codes
    assert top_level_reason_codes == export_alert_reason_codes
    assert payload["schemaContractParity"]["reasonCodeCount"] == len(payload["reasonCodes"])
    assert (
        payload["schemaContractParity"]["recommendedCommandCount"]
        == len(payload["recommendedCommands"])
    )
    assert (
        payload["schemaContractParity"]["reasonCodeParity"]["topLevelVsRolloutActions"]
        is True
    )
    assert (
        payload["schemaContractParity"]["reasonCodeParity"]["topLevelVsExportActions"]
        is True
    )
    assert (
        payload["schemaContractParity"]["reasonCodeParity"]["topLevelVsExportAlerts"]
        is True
    )
    assert (
        payload["schemaContractParity"]["reasonCodeParity"]["topLevelVsExportReasonCodes"]
        is True
    )
    assert (
        payload["schemaContractParity"]["recommendedCommandParity"]["topLevelVsExport"]
        is True
    )
    assert (
        payload["schemaContractParity"]["handoffParity"]["rolloutBlockedMatchesExport"]
        is True
    )
    assert payload["schemaContractParity"]["handoffParity"]["ownerRoleMatchesExport"] is True
    assert (
        payload["schemaContractParity"]["handoffParity"]["handoffActionsMatchRolloutActions"]
        is True
    )
    assert isinstance(payload["schemaContractParity"]["computedAt"], str)
    assert len(fake_db.integration_telemetry.inserted) == 1
    schema_event = fake_db.integration_telemetry.inserted[0]
    assert (
        schema_event["eventType"]
        == "integrations_traceability_governance_schema_viewed"
    )
    assert schema_event["payload"]["status"] == "READY"
    assert schema_event["payload"]["rollout_blocked"] is False
    assert schema_event["payload"]["override_is_set"] is False
    assert schema_event["payload"]["active_version"] == 1
    assert schema_event["payload"]["reason_codes"] == payload["reasonCodes"]
    assert schema_event["payload"]["reason_codes"] == payload["governanceExport"]["reasonCodes"]
    assert schema_event["payload"]["reason_code_count"] == len(payload["reasonCodes"])
    assert (
        schema_event["payload"]["reason_code_count"]
        == len(schema_event["payload"]["reason_codes"])
    )
    assert (
        schema_event["payload"]["recommended_commands"]
        == payload["recommendedCommands"]
    )
    assert (
        schema_event["payload"]["recommended_commands"]
        == payload["governanceExport"]["recommendedCommands"]
    )
    assert (
        schema_event["payload"]["recommended_command_count"]
        == len(payload["recommendedCommands"])
    )
    assert (
        schema_event["payload"]["recommended_command_count"]
        == len(schema_event["payload"]["recommended_commands"])
    )
    assert schema_event["payload"]["rollout_blocked"] == payload["handoff"]["rolloutBlocked"]
    assert schema_event["payload"]["reason_code_parity_ok"] is True
    assert schema_event["payload"]["recommended_command_parity_ok"] is True
    assert schema_event["payload"]["handoff_parity_ok"] is True


def test_http_integrations_governance_schema_metadata_endpoint_invalid_env(monkeypatch):
    monkeypatch.setenv("GOVERNANCE_EXPORT_SCHEMA_VERSION", "invalid")
    fake_db = _FakeDb(integration_doc={"userId": "u1"}, telemetry_docs=[])
    client = _build_client(monkeypatch, fake_db)

    response = client.get(
        "/api/integrations/integrations/telemetry/governance-schema"
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ACTION_REQUIRED"
    assert payload["schemaMetadata"]["activeVersion"] == 1
    assert payload["schemaMetadata"]["source"] == "env_invalid_fallback"
    assert payload["schemaMetadata"]["override"]["isSet"] is True
    assert payload["schemaMetadata"]["override"]["isValid"] is False
    assert len(payload["alerts"]) >= 1
    assert isinstance(payload["reasonCodes"], list)
    assert payload["handoff"]["rolloutBlocked"] is True
    assert isinstance(payload["rolloutActions"], list)
    assert payload["governanceExport"]["governanceType"] == "schema_metadata"
    assert payload["governanceExport"]["status"] == payload["status"]
    assert payload["governanceExport"]["rolloutBlocked"] is True
    assert payload["governanceExport"]["ownerRole"] == payload["handoff"]["ownerRole"]
    assert payload["governanceExport"]["recommendedCommands"] == payload["recommendedCommands"]
    assert payload["governanceExport"]["reasonCodes"] == payload["reasonCodes"]
    assert payload["handoff"]["actions"] == [
        action.get("action")
        for action in payload["rolloutActions"]
        if action.get("action")
    ]
    top_level_reason_codes = set(payload.get("reasonCodes") or [])
    rollout_action_reason_codes = {
        action.get("reasonCode")
        for action in payload.get("rolloutActions") or []
        if isinstance(action.get("reasonCode"), str)
    }
    export_action_reason_codes = {
        action.get("reasonCode")
        for action in payload["governanceExport"].get("actions") or []
        if isinstance(action.get("reasonCode"), str)
    }
    export_alert_reason_codes = {
        alert.get("reasonCode")
        for alert in payload["governanceExport"].get("alerts") or []
        if isinstance(alert.get("reasonCode"), str)
    }
    assert top_level_reason_codes == rollout_action_reason_codes
    assert top_level_reason_codes == export_action_reason_codes
    assert top_level_reason_codes == export_alert_reason_codes
    assert payload["schemaContractParity"]["reasonCodeCount"] == len(payload["reasonCodes"])
    assert (
        payload["schemaContractParity"]["recommendedCommandCount"]
        == len(payload["recommendedCommands"])
    )
    assert (
        payload["schemaContractParity"]["reasonCodeParity"]["topLevelVsRolloutActions"]
        is True
    )
    assert (
        payload["schemaContractParity"]["reasonCodeParity"]["topLevelVsExportActions"]
        is True
    )
    assert (
        payload["schemaContractParity"]["reasonCodeParity"]["topLevelVsExportAlerts"]
        is True
    )
    assert (
        payload["schemaContractParity"]["reasonCodeParity"]["topLevelVsExportReasonCodes"]
        is True
    )
    assert (
        payload["schemaContractParity"]["recommendedCommandParity"]["topLevelVsExport"]
        is True
    )
    assert (
        payload["schemaContractParity"]["handoffParity"]["rolloutBlockedMatchesExport"]
        is True
    )
    assert payload["schemaContractParity"]["handoffParity"]["ownerRoleMatchesExport"] is True
    assert (
        payload["schemaContractParity"]["handoffParity"]["handoffActionsMatchRolloutActions"]
        is True
    )
    assert isinstance(payload["schemaContractParity"]["computedAt"], str)
    assert len(fake_db.integration_telemetry.inserted) == 1
    schema_event = fake_db.integration_telemetry.inserted[0]
    assert (
        schema_event["eventType"]
        == "integrations_traceability_governance_schema_viewed"
    )
    assert schema_event["payload"]["status"] == "ACTION_REQUIRED"
    assert schema_event["payload"]["rollout_blocked"] is True
    assert schema_event["payload"]["override_is_set"] is True
    assert schema_event["payload"]["override_is_valid"] is False
    assert schema_event["payload"]["reason_codes"] == payload["reasonCodes"]
    assert schema_event["payload"]["reason_codes"] == payload["governanceExport"]["reasonCodes"]
    assert schema_event["payload"]["reason_code_count"] == len(payload["reasonCodes"])
    assert (
        schema_event["payload"]["reason_code_count"]
        == len(schema_event["payload"]["reason_codes"])
    )
    assert (
        schema_event["payload"]["recommended_commands"]
        == payload["recommendedCommands"]
    )
    assert (
        schema_event["payload"]["recommended_commands"]
        == payload["governanceExport"]["recommendedCommands"]
    )
    assert (
        schema_event["payload"]["recommended_command_count"]
        == len(payload["recommendedCommands"])
    )
    assert (
        schema_event["payload"]["recommended_command_count"]
        == len(schema_event["payload"]["recommended_commands"])
    )
    assert schema_event["payload"]["rollout_blocked"] == payload["handoff"]["rolloutBlocked"]
    assert schema_event["payload"]["reason_code_parity_ok"] is True
    assert schema_event["payload"]["recommended_command_parity_ok"] is True
    assert schema_event["payload"]["handoff_parity_ok"] is True


def test_http_integrations_governance_report_export_endpoint(monkeypatch):
    fake_db = _FakeDb(
        integration_doc={"userId": "u1"},
        telemetry_docs=[
            {
                "id": "g1",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "integrations_traceability_status_evaluated",
                "payload": {"decision": "PROCEED", "request_id": "req-traceability-1"},
                "createdAt": "2026-02-19T09:00:00+00:00",
            },
            {
                "id": "g2",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "integrations_traceability_snapshot_governance_evaluated",
                "payload": {
                    "status": "READY",
                    "request_id": "req-snapshot-1",
                    "rollout_blocked": False,
                },
                "createdAt": "2026-02-19T10:00:00+00:00",
            },
            {
                "id": "g3",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "integrations_traceability_baseline_governance_evaluated",
                "payload": {"status": "PASS", "request_id": "req-baseline-1"},
                "createdAt": "2026-02-20T10:00:00+00:00",
            },
            {
                "id": "g4",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "integrations_connector_rate_limited",
                "payload": {
                    "endpoint": "company_enrichment_orchestration",
                    "retry_after_seconds": 22,
                    "reset_in_seconds": 21,
                },
                "createdAt": "2026-02-20T11:00:00+00:00",
            },
            {
                "id": "g5",
                "userId": "u1",
                "provider": "sendgrid",
                "eventType": "sendgrid_webhook_processed",
                "payload": {
                    "timestamp_pressure_label": "high",
                    "timestamp_pressure_hint": "Investigate stale or skewed webhook timestamps.",
                    "timestamp_anomaly_count": 3,
                    "timestamp_anomaly_rate_pct": 75.0,
                    "timestamp_fallback_count": 1,
                    "future_skew_event_count": 1,
                    "stale_event_count": 2,
                    "fresh_event_count": 0,
                    "timestamp_age_bucket_counts": {"stale": 2, "future_skew": 1},
                    "timestamp_anomaly_event_type_counts": {"open": 2, "click": 1},
                    "timestamp_dominant_anomaly_bucket": "stale",
                    "timestamp_dominant_anomaly_event_type": "open",
                    "timestamp_pressure_high_anomaly_rate_pct": 20.0,
                    "timestamp_pressure_moderate_anomaly_rate_pct": 5.0,
                    "timestamp_pressure_high_anomaly_count": 10,
                    "timestamp_pressure_moderate_anomaly_count": 3,
                },
                "createdAt": "2026-02-20T11:01:00+00:00",
            },
        ],
    )
    client = _build_client(monkeypatch, fake_db)
    response = client.get(
        "/api/integrations/integrations/telemetry/governance-report/export?days=30&limit=500"
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["governanceType"] == "weekly_report"
    assert payload["exportSchemaVersion"] == 1
    assert payload["schemaMetadata"]["activeVersion"] == 1
    assert payload["status"] == "READY"
    assert payload["windowDays"] == 30
    assert payload["eventLimit"] == 500
    assert isinstance(payload["reasonCodes"], list)
    assert isinstance(payload["reasonCodeCount"], int)
    assert payload["reasonCodeCount"] == len(payload["reasonCodes"])
    assert payload["connectorRateLimit"]["eventCount"] == 1
    assert payload["connectorRateLimit"]["byEndpoint"]["company_enrichment_orchestration"] == 1
    assert payload["connectorRateLimit"]["pressure"]["label"] == "Moderate"
    assert payload["sendgridWebhookTimestamp"]["eventCount"] == 1
    assert payload["sendgridWebhookTimestamp"]["pressureLabelCounts"]["High"] == 1
    assert payload["sendgridWebhookTimestamp"]["timestampAnomalyCountTotal"] == 3
    assert payload["governanceExport"]["sendgridWebhookTimestamp"]["eventCount"] == 1
    assert payload["sendgridWebhookTimestampParity"]["eventCountMatchesNested"] is True
    assert payload["sendgridWebhookTimestampParity"]["eventCountMatchesTotals"] is True
    assert (
        payload["sendgridWebhookTimestampParity"]["anomalyCountTotalMatchesNested"]
        is True
    )
    assert payload["connectorPressureParity"]["eventCountMatchesNested"] is True
    assert payload["connectorPressureParity"]["eventCountMatchesTotals"] is True
    assert payload["connectorPressureParity"]["byEndpointMatchesNested"] is True
    assert payload["connectorPressureParity"]["pressureLabelMatchesNested"] is True
    assert isinstance(payload.get("runtimePrereqs"), dict)
    assert isinstance(payload["governanceExport"].get("runtimePrereqs"), dict)
    assert payload["governanceExport"].get("runtimePrereqs") == payload.get(
        "runtimePrereqs"
    )
    assert isinstance(payload["runtimePrereqs"].get("present"), bool)
    assert isinstance(payload["runtimePrereqs"].get("available"), bool)
    assert payload["runtimePrereqs"].get("passed") in (True, False, None)
    assert payload["runtimePrereqs"].get("contractValid") in (True, False, None)
    assert payload["runtimePrereqs"].get("valid") in (True, False, None)
    assert isinstance(payload["runtimePrereqs"].get("missingCheckCount"), int)
    assert isinstance(
        (payload["runtimePrereqs"].get("missingChecks") or {}).get("commands", []),
        list,
    )
    assert isinstance(
        (payload["runtimePrereqs"].get("missingChecks") or {}).get("workspace", []),
        list,
    )
    assert payload["governanceExport"]["governanceType"] == "weekly_report"
    assert payload["governanceExport"]["exportSchemaVersion"] == 1
    assert payload["governanceExport"]["schemaMetadata"]["activeVersion"] == 1
    assert payload["governanceExport"]["reasonCodes"] == payload["reasonCodes"]
    assert payload["governanceExport"]["reasonCodeCount"] == payload["reasonCodeCount"]
    assert (
        payload["governanceExport"]["recommendedCommandCount"]
        == payload["recommendedCommandCount"]
    )
    assert payload["governanceExport"]["connectorRateLimit"]["eventCount"] == 1
    assert payload["governanceExport"]["rolloutBlocked"] is False
    assert payload["governanceExport"]["requestedBy"] == "u1"
    assert payload["requestedBy"] == "u1"
    assert isinstance(payload["recommendedCommandCount"], int)
    assert payload["recommendedCommandCount"] == len(payload["recommendedCommands"])
    assert len(fake_db.integration_telemetry.inserted) == 2
    assert (
        fake_db.integration_telemetry.inserted[0]["eventType"]
        == "integrations_traceability_governance_report_generated"
    )
    assert (
        fake_db.integration_telemetry.inserted[1]["eventType"]
        == "integrations_traceability_governance_report_exported"
    )
    assert (
        fake_db.integration_telemetry.inserted[0]["payload"]["recommended_commands"]
        == payload["recommendedCommands"]
    )
    assert (
        fake_db.integration_telemetry.inserted[0]["payload"]["recommended_command_count"]
        == len(payload["recommendedCommands"])
    )
    assert (
        fake_db.integration_telemetry.inserted[0]["payload"]["reason_code_count"]
        == len(payload["reasonCodes"])
    )
    assert fake_db.integration_telemetry.inserted[1]["payload"]["export_schema_version"] == 1
    assert fake_db.integration_telemetry.inserted[1]["payload"]["connector_rate_limit_event_count"] == 1
    assert fake_db.integration_telemetry.inserted[1]["payload"]["connector_rate_limit_pressure_label"] == "Moderate"
    assert (
        fake_db.integration_telemetry.inserted[1]["payload"][
            "sendgrid_webhook_timestamp_event_count"
        ]
        == 1
    )
    assert (
        fake_db.integration_telemetry.inserted[1]["payload"][
            "sendgrid_webhook_timestamp_anomaly_count_total"
        ]
        == 3
    )
    assert (
        fake_db.integration_telemetry.inserted[1]["payload"]["runtime_prereqs_present"]
        == payload["runtimePrereqs"]["present"]
    )
    assert (
        fake_db.integration_telemetry.inserted[1]["payload"]["runtime_prereqs_available"]
        == payload["runtimePrereqs"]["available"]
    )
    assert (
        fake_db.integration_telemetry.inserted[1]["payload"]["runtime_prereqs_passed"]
        == payload["runtimePrereqs"]["passed"]
    )
    assert (
        fake_db.integration_telemetry.inserted[1]["payload"][
            "runtime_prereqs_contract_valid"
        ]
        == payload["runtimePrereqs"]["contractValid"]
    )
    assert (
        fake_db.integration_telemetry.inserted[1]["payload"]["runtime_prereqs_valid"]
        == payload["runtimePrereqs"]["valid"]
    )
    assert (
        fake_db.integration_telemetry.inserted[1]["payload"][
            "sendgrid_webhook_timestamp_parity_event_count_matches_nested"
        ]
        is True
    )
    assert (
        fake_db.integration_telemetry.inserted[1]["payload"][
            "sendgrid_webhook_timestamp_parity_event_count_matches_totals"
        ]
        is True
    )
    assert (
        fake_db.integration_telemetry.inserted[1]["payload"][
            "runtime_prereqs_missing_check_count"
        ]
        == payload["runtimePrereqs"]["missingCheckCount"]
    )
    assert isinstance(
        fake_db.integration_telemetry.inserted[1]["payload"][
            "runtime_prereqs_missing_commands"
        ],
        list,
    )
    assert isinstance(
        fake_db.integration_telemetry.inserted[1]["payload"][
            "runtime_prereqs_missing_workspace"
        ],
        list,
    )
    assert isinstance(
        fake_db.integration_telemetry.inserted[1]["payload"]["runtime_prereqs_command"],
        str,
    )
    assert isinstance(fake_db.integration_telemetry.inserted[1]["payload"]["reason_codes"], list)
    assert (
        fake_db.integration_telemetry.inserted[1]["payload"]["recommended_commands"]
        == payload["recommendedCommands"]
    )
    assert (
        fake_db.integration_telemetry.inserted[1]["payload"]["recommended_command_count"]
        == len(payload["recommendedCommands"])
    )
    assert (
        fake_db.integration_telemetry.inserted[1]["payload"]["reason_code_count"]
        == len(payload["reasonCodes"])
    )


def test_http_governance_export_schema_version_respects_env_override(monkeypatch):
    monkeypatch.setenv("GOVERNANCE_EXPORT_SCHEMA_VERSION", "7")
    fake_db = _FakeDb(
        integration_doc={"userId": "u1"},
        telemetry_docs=[
            {
                "id": "g1",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "integrations_traceability_status_evaluated",
                "payload": {"decision": "PROCEED", "request_id": "req-traceability-override"},
                "createdAt": "2026-02-19T09:00:00+00:00",
            },
            {
                "id": "g2",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "integrations_traceability_snapshot_governance_evaluated",
                "payload": {"status": "READY", "request_id": "req-snapshot-override"},
                "createdAt": "2026-02-19T10:00:00+00:00",
            },
        ],
    )
    client = _build_client(monkeypatch, fake_db)

    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)

        snapshot_path = tmp_path / "connector-telemetry-summary-2026-02-22.json"
        snapshot_path.write_text(
            json.dumps({"generatedAt": datetime.now(timezone.utc).isoformat()}),
            encoding="utf-8",
        )
        pass_fixture = tmp_path / "connector_release_gate_result.json"
        hold_fixture = tmp_path / "connector_release_gate_result_hold.json"
        validation_fail_fixture = (
            tmp_path / "connector_release_gate_result_validation_fail.json"
        )
        for path in (pass_fixture, hold_fixture, validation_fail_fixture):
            path.write_text(json.dumps({"approved": True}), encoding="utf-8")

        baseline_path = tmp_path / "baseline_metrics.json"
        baseline_path.write_text(
            json.dumps(
                {
                    "generatedAt": "2026-02-22T00:00:00+00:00",
                    "overallStatus": "pass",
                    "releaseGateFixturePolicy": {
                        "passed": True,
                        "requiredProfiles": ["pass", "hold", "validation-fail"],
                        "missingProfiles": [],
                    },
                    "releaseGateFixtures": {
                        "allProfilesAvailable": True,
                        "availableProfileCount": 3,
                        "profileCount": 3,
                    },
                    "orchestrationGate": {
                        "available": True,
                        "decision": "PROCEED",
                        "attemptErrorGatePassed": True,
                        "attemptSkippedGatePassed": True,
                        "maxAttemptErrorCountThreshold": 5,
                        "observedAttemptErrorCount": 1,
                        "maxAttemptSkippedCountThreshold": 25,
                        "observedAttemptSkippedCount": 2,
                    },
                }
            ),
            encoding="utf-8",
        )

        history_path = tmp_path / "connector_governance_weekly_report_recent.json"
        history_path.write_text(
            json.dumps(
                {
                    "generatedAt": datetime.now(timezone.utc).isoformat(),
                    "governanceExport": {
                        "status": "READY",
                        "rolloutBlocked": False,
                        "exportSchemaVersion": 7,
                    },
                    "exportSchemaVersion": 7,
                }
            ),
            encoding="utf-8",
        )
        packet_validation_path = tmp_path / "governance_packet_validation.json"
        packet_validation_path.write_text(
            json.dumps(
                {
                    "validatedAt": datetime.now(timezone.utc).isoformat(),
                    "checks": {},
                    "errors": [],
                    "valid": True,
                }
            ),
            encoding="utf-8",
        )

        monkeypatch.setattr(real_integrations, "TELEMETRY_SNAPSHOT_DIR", tmp_path)
        monkeypatch.setattr(
            real_integrations,
            "RELEASE_GATE_ARTIFACT_PATHS",
            {
                "pass": pass_fixture,
                "hold": hold_fixture,
                "validation-fail": validation_fail_fixture,
            },
        )
        monkeypatch.setattr(
            real_integrations,
            "BASELINE_METRICS_ARTIFACT_PATH",
            baseline_path,
        )
        monkeypatch.setattr(real_integrations, "GOVERNANCE_WEEKLY_REPORT_DIR", tmp_path)
        monkeypatch.setattr(
            real_integrations,
            "GOVERNANCE_WEEKLY_REPORT_PREFIX",
            "connector_governance_weekly_report",
        )
        monkeypatch.setattr(
            real_integrations,
            "GOVERNANCE_PACKET_VALIDATION_ARTIFACT_PATH",
            packet_validation_path,
        )

        report_response = client.get(
            "/api/integrations/integrations/telemetry/governance-report?days=30&limit=500"
        )
        assert report_response.status_code == 200
        report_payload = report_response.json()
        assert report_payload["exportSchemaVersion"] == 7
        assert report_payload["governanceExport"]["exportSchemaVersion"] == 7
        assert report_payload["schemaMetadata"]["activeVersion"] == 7
        assert report_payload["schemaMetadata"]["source"] == "env_override"

        export_response = client.get(
            "/api/integrations/integrations/telemetry/governance-report/export?days=30&limit=500"
        )
        assert export_response.status_code == 200
        export_payload = export_response.json()
        assert export_payload["exportSchemaVersion"] == 7
        assert export_payload["governanceExport"]["exportSchemaVersion"] == 7
        assert export_payload["schemaMetadata"]["activeVersion"] == 7

        history_response = client.get(
            "/api/integrations/integrations/telemetry/governance-report/history?retention_days=30&limit=10"
        )
        assert history_response.status_code == 200
        history_payload = history_response.json()
        assert history_payload["exportSchemaVersion"] == 7
        assert history_payload["governanceExport"]["exportSchemaVersion"] == 7
        assert history_payload["items"][0]["exportSchemaVersion"] == 7
        assert history_payload["schemaMetadata"]["activeVersion"] == 7

        snapshot_response = client.get(
            "/api/integrations/integrations/telemetry/snapshot-governance?retention_days=30"
        )
        assert snapshot_response.status_code == 200
        snapshot_payload = snapshot_response.json()
        assert snapshot_payload["exportSchemaVersion"] == 7
        assert snapshot_payload["governanceExport"]["exportSchemaVersion"] == 7
        assert snapshot_payload["schemaMetadata"]["activeVersion"] == 7

        baseline_response = client.get(
            "/api/integrations/integrations/telemetry/baseline-governance"
        )
        assert baseline_response.status_code == 200
        baseline_payload = baseline_response.json()
        assert baseline_payload["exportSchemaVersion"] == 7
        assert baseline_payload["governanceExport"]["exportSchemaVersion"] == 7
        assert baseline_payload["schemaMetadata"]["activeVersion"] == 7
        assert baseline_payload["orchestrationGate"]["available"] is True


def test_http_governance_export_schema_version_falls_back_to_default_on_invalid_env(
    monkeypatch,
):
    monkeypatch.setenv("GOVERNANCE_EXPORT_SCHEMA_VERSION", "invalid")
    fake_db = _FakeDb(
        integration_doc={"userId": "u1"},
        telemetry_docs=[
            {
                "id": "g1",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "integrations_traceability_status_evaluated",
                "payload": {"decision": "PROCEED", "request_id": "req-traceability-default"},
                "createdAt": "2026-02-19T09:00:00+00:00",
            },
            {
                "id": "g2",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "integrations_traceability_snapshot_governance_evaluated",
                "payload": {"status": "READY", "request_id": "req-snapshot-default"},
                "createdAt": "2026-02-19T10:00:00+00:00",
            },
        ],
    )
    client = _build_client(monkeypatch, fake_db)

    response = client.get(
        "/api/integrations/integrations/telemetry/governance-report?days=30&limit=500"
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["exportSchemaVersion"] == 1
    assert payload["governanceExport"]["exportSchemaVersion"] == 1
    assert payload["schemaMetadata"]["source"] == "env_invalid_fallback"


def test_http_integrations_governance_report_validates_query_bounds(monkeypatch):
    fake_db = _FakeDb(integration_doc={"userId": "u1"}, telemetry_docs=[])
    client = _build_client(monkeypatch, fake_db)
    response = client.get(
        "/api/integrations/integrations/telemetry/governance-report?days=0&limit=500"
    )
    assert response.status_code == 400
    response = client.get(
        "/api/integrations/integrations/telemetry/governance-report?days=7&limit=1"
    )
    assert response.status_code == 400


def test_http_integrations_governance_report_marks_missing_telemetry_as_action_required(monkeypatch):
    fake_db = _FakeDb(integration_doc={"userId": "u1"}, telemetry_docs=[])
    client = _build_client(monkeypatch, fake_db)
    response = client.get(
        "/api/integrations/integrations/telemetry/governance-report?days=7&limit=500"
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ACTION_REQUIRED"
    assert payload["handoff"]["rolloutBlocked"] is True
    assert any(
        "no governance telemetry events" in str(message).lower()
        for message in payload["alerts"]
    )
    assert "npm run verify:governance:weekly" in payload["recommendedCommands"]


def test_http_integrations_governance_report_history(monkeypatch):
    fake_db = _FakeDb(integration_doc={"userId": "u1"}, telemetry_docs=[])
    client = _build_client(monkeypatch, fake_db)

    with tempfile.TemporaryDirectory() as tmp:
        artifact_dir = Path(tmp)
        recent_path = artifact_dir / "connector_governance_weekly_report_recent.json"
        stale_path = artifact_dir / "connector_governance_weekly_report_stale.json"
        invalid_path = artifact_dir / "connector_governance_weekly_report_invalid.json"

        recent_path.write_text(
            json.dumps(
                {
                    "generatedAt": datetime.now(timezone.utc).isoformat(),
                    "summary": {
                        "rolloutBlocked": False,
                        "connectorRateLimit": {
                            "eventCount": 2,
                            "byEndpoint": {"apollo_search": 2},
                            "latestEventAt": datetime.now(timezone.utc).isoformat(),
                            "maxRetryAfterSeconds": 28,
                            "avgRetryAfterSeconds": 27.5,
                            "maxResetInSeconds": 26,
                            "avgResetInSeconds": 25.5,
                        },
                        "sendgridWebhookTimestamp": {
                            "eventCount": 2,
                            "pressureLabelCounts": {"Moderate": 2},
                            "pressureHintCounts": {
                                "Validate event timestamp source clocks.": 2
                            },
                            "timestampFallbackCount": 1,
                            "futureSkewEventCount": 0,
                            "staleEventCount": 1,
                            "freshEventCount": 1,
                            "timestampAnomalyCountTotal": 3,
                            "avgTimestampAnomalyCount": 1.5,
                            "avgTimestampAnomalyRatePct": 37.5,
                            "maxTimestampAnomalyRatePct": 50.0,
                            "timestampAgeBucketCounts": {"stale": 1, "fallback": 1},
                            "timestampAnomalyEventTypeCounts": {
                                "open": 2,
                                "processed": 1,
                            },
                            "timestampDominantAnomalyBucketCounts": {"stale": 2},
                            "timestampDominantAnomalyEventTypeCounts": {"open": 2},
                            "timestampPressureHighAnomalyRatePct": 20.0,
                            "timestampPressureModerateAnomalyRatePct": 5.0,
                            "timestampPressureHighAnomalyCount": 10,
                            "timestampPressureModerateAnomalyCount": 3,
                            "latestEventAt": datetime.now(timezone.utc).isoformat(),
                        },
                    },
                    "governanceExport": {"status": "READY", "rolloutBlocked": False},
                }
            ),
            encoding="utf-8",
        )
        stale_path.write_text(
            json.dumps(
                {
                    "generatedAt": (
                        datetime.now(timezone.utc) - timedelta(days=45)
                    ).isoformat(),
                    "summary": {
                        "rolloutBlocked": True,
                        "connectorRateLimit": {
                            "eventCount": 1,
                            "byEndpoint": {
                                "company_enrichment_orchestration": 1
                            },
                            "latestEventAt": (
                                datetime.now(timezone.utc) - timedelta(days=45)
                            ).isoformat(),
                            "maxRetryAfterSeconds": 47,
                            "avgRetryAfterSeconds": 47,
                            "maxResetInSeconds": 46,
                            "avgResetInSeconds": 46,
                        },
                        "sendgridWebhookTimestamp": {
                            "eventCount": 1,
                            "pressureLabelCounts": {"High": 1},
                            "pressureHintCounts": {
                                "Investigate stale or skewed webhook timestamps.": 1
                            },
                            "timestampFallbackCount": 1,
                            "futureSkewEventCount": 1,
                            "staleEventCount": 1,
                            "freshEventCount": 0,
                            "timestampAnomalyCountTotal": 2,
                            "avgTimestampAnomalyCount": 2.0,
                            "avgTimestampAnomalyRatePct": 66.67,
                            "maxTimestampAnomalyRatePct": 66.67,
                            "timestampAgeBucketCounts": {
                                "stale": 1,
                                "future_skew": 1,
                            },
                            "timestampAnomalyEventTypeCounts": {"click": 1, "open": 1},
                            "timestampDominantAnomalyBucketCounts": {"stale": 1},
                            "timestampDominantAnomalyEventTypeCounts": {"open": 1},
                            "timestampPressureHighAnomalyRatePct": 20.0,
                            "timestampPressureModerateAnomalyRatePct": 5.0,
                            "timestampPressureHighAnomalyCount": 10,
                            "timestampPressureModerateAnomalyCount": 3,
                            "latestEventAt": (
                                datetime.now(timezone.utc) - timedelta(days=45)
                            ).isoformat(),
                        },
                    },
                    "governanceExport": {
                        "status": "ACTION_REQUIRED",
                        "rolloutBlocked": True,
                    },
                }
            ),
            encoding="utf-8",
        )
        invalid_path.write_text("{invalid", encoding="utf-8")
        packet_validation_path = artifact_dir / "governance_packet_validation.json"
        packet_validation_path.write_text(
            json.dumps(
                {
                    "validatedAt": datetime.now(timezone.utc).isoformat(),
                    "checks": {},
                    "errors": [],
                    "valid": True,
                }
            ),
            encoding="utf-8",
        )

        monkeypatch.setattr(real_integrations, "GOVERNANCE_WEEKLY_REPORT_DIR", artifact_dir)
        monkeypatch.setattr(
            real_integrations,
            "GOVERNANCE_WEEKLY_REPORT_PREFIX",
            "connector_governance_weekly_report",
        )
        monkeypatch.setattr(
            real_integrations,
            "GOVERNANCE_PACKET_VALIDATION_ARTIFACT_PATH",
            packet_validation_path,
        )

        response = client.get(
            "/api/integrations/integrations/telemetry/governance-report/history?retention_days=30&limit=10"
        )
        assert response.status_code == 200
        payload = response.json()
        assert payload["governanceType"] == "weekly_report_history"
        assert payload["exportSchemaVersion"] == 1
        assert payload["schemaMetadata"]["activeVersion"] == 1
        assert isinstance(payload["reasonCodes"], list)
        assert isinstance(payload["reasonCodeCount"], int)
        assert payload["reasonCodeCount"] == len(payload["reasonCodes"])
        assert payload["artifactCount"] == 3
        assert payload["staleCount"] >= 1
        assert payload["status"] == "ACTION_REQUIRED"
        assert isinstance(payload["schemaVersionCounts"], dict)
        assert payload["schemaVersionCounts"]["1"] >= 1
        assert payload["duplicateArtifactNames"] == []
        assert payload["governanceExport"]["governanceType"] == "weekly_report_history"
        assert payload["governanceExport"]["exportSchemaVersion"] == 1
        assert payload["governanceExport"]["schemaMetadata"]["activeVersion"] == 1
        assert payload["governanceExport"]["reasonCodes"] == payload["reasonCodes"]
        assert payload["governanceExport"]["reasonCodeCount"] == payload["reasonCodeCount"]
        assert (
            payload["governanceExport"]["recommendedCommandCount"]
            == payload["recommendedCommandCount"]
        )
        assert isinstance(payload["governanceExport"]["alerts"][0]["reasonCode"], str)
        assert payload["governanceExport"]["rolloutBlocked"] is True
        assert payload["connectorRateLimit"]["eventCount"] == 3
        assert payload["connectorRateLimit"]["byEndpoint"]["apollo_search"] == 2
        assert (
            payload["connectorRateLimit"]["byEndpoint"][
                "company_enrichment_orchestration"
            ]
            == 1
        )
        assert payload["connectorRateLimit"]["pressure"]["label"] == "High"
        assert payload["sendgridWebhookTimestamp"]["eventCount"] == 3
        assert payload["sendgridWebhookTimestamp"]["timestampAnomalyCountTotal"] == 5
        assert payload["sendgridWebhookTimestamp"]["pressureLabelCounts"]["Moderate"] == 2
        assert payload["sendgridWebhookTimestamp"]["pressureLabelCounts"]["High"] == 1
        assert payload["sendgridWebhookTimestampParity"]["eventCountMatchesNested"] is True
        assert payload["sendgridWebhookTimestampParity"]["eventCountMatchesTotals"] is True
        assert (
            payload["sendgridWebhookTimestampParity"]["anomalyCountTotalMatchesNested"]
            is True
        )
        assert payload["connectorPressureParity"]["eventCountMatchesNested"] is True
        assert payload["connectorPressureParity"]["eventCountMatchesTotals"] is True
        assert payload["connectorPressureParity"]["byEndpointMatchesNested"] is True
        assert payload["connectorPressureParity"]["pressureLabelMatchesNested"] is True
        assert isinstance(payload.get("runtimePrereqs"), dict)
        assert isinstance(payload["governanceExport"].get("runtimePrereqs"), dict)
        assert payload["governanceExport"].get("runtimePrereqs") == payload.get(
            "runtimePrereqs"
        )
        assert isinstance(payload["runtimePrereqs"].get("present"), bool)
        assert isinstance(payload["runtimePrereqs"].get("available"), bool)
        assert payload["runtimePrereqs"].get("passed") in (True, False, None)
        assert payload["runtimePrereqs"].get("contractValid") in (True, False, None)
        assert payload["runtimePrereqs"].get("valid") in (True, False, None)
        assert isinstance(payload["runtimePrereqs"].get("missingCheckCount"), int)
        assert isinstance(
            (payload["runtimePrereqs"].get("missingChecks") or {}).get("commands", []),
            list,
        )
        assert isinstance(
            (payload["runtimePrereqs"].get("missingChecks") or {}).get("workspace", []),
            list,
        )
        assert (
            payload["governanceExport"]["connectorRateLimit"]["eventCount"] == 3
        )
        assert payload["governanceExport"]["sendgridWebhookTimestamp"]["eventCount"] == 3
        assert isinstance(payload.get("governancePacketValidation"), dict)
        assert payload["governancePacketValidation"]["status"] == "READY"
        assert payload["governancePacketValidation"]["withinFreshnessWindow"] is True
        assert len(payload["items"]) == 3
        assert isinstance(payload["items"][0]["exportSchemaVersion"], int)
        assert payload["items"][0]["name"].startswith(
            "connector_governance_weekly_report"
        )
        assert len(fake_db.integration_telemetry.inserted) == 1
        assert (
            fake_db.integration_telemetry.inserted[0]["eventType"]
            == "integrations_traceability_governance_report_history_viewed"
        )
        assert isinstance(
            fake_db.integration_telemetry.inserted[0]["payload"]["reason_codes"], list
        )
        assert (
            fake_db.integration_telemetry.inserted[0]["payload"]["recommended_commands"]
            == payload["recommendedCommands"]
        )
        assert isinstance(payload["recommendedCommandCount"], int)
        assert payload["recommendedCommandCount"] == len(payload["recommendedCommands"])
        assert (
            fake_db.integration_telemetry.inserted[0]["payload"]["recommended_command_count"]
            == len(payload["recommendedCommands"])
        )
        assert (
            fake_db.integration_telemetry.inserted[0]["payload"]["reason_code_count"]
            == len(payload["reasonCodes"])
        )
        assert (
            fake_db.integration_telemetry.inserted[0]["payload"]["runtime_prereqs_available"]
            == payload["runtimePrereqs"]["available"]
        )
        assert (
            fake_db.integration_telemetry.inserted[0]["payload"]["runtime_prereqs_passed"]
            == payload["runtimePrereqs"]["passed"]
        )
        assert (
            fake_db.integration_telemetry.inserted[0]["payload"][
                "runtime_prereqs_contract_valid"
            ]
            == payload["runtimePrereqs"]["contractValid"]
        )
        assert (
            fake_db.integration_telemetry.inserted[0]["payload"]["runtime_prereqs_valid"]
            == payload["runtimePrereqs"]["valid"]
        )
        assert (
            fake_db.integration_telemetry.inserted[0]["payload"][
                "sendgrid_webhook_timestamp_parity_event_count_matches_nested"
            ]
            is True
        )
        assert (
            fake_db.integration_telemetry.inserted[0]["payload"][
                "sendgrid_webhook_timestamp_parity_event_count_matches_totals"
            ]
            is True
        )
        assert (
            fake_db.integration_telemetry.inserted[0]["payload"][
                "runtime_prereqs_missing_check_count"
            ]
            == payload["runtimePrereqs"]["missingCheckCount"]
        )
        assert isinstance(
            fake_db.integration_telemetry.inserted[0]["payload"][
                "runtime_prereqs_missing_commands"
            ],
            list,
        )
        assert isinstance(
            fake_db.integration_telemetry.inserted[0]["payload"][
                "runtime_prereqs_missing_workspace"
            ],
            list,
        )
        assert isinstance(
            fake_db.integration_telemetry.inserted[0]["payload"][
                "runtime_prereqs_present_count"
            ],
            int,
        )
        assert isinstance(
            fake_db.integration_telemetry.inserted[0]["payload"][
                "runtime_prereqs_failure_count"
            ],
            int,
        )
        assert isinstance(
            fake_db.integration_telemetry.inserted[0]["payload"]["runtime_prereqs_command"],
            str,
        )
        assert (
            fake_db.integration_telemetry.inserted[0]["payload"][
                "sendgrid_webhook_timestamp_event_count"
            ]
            == 3
        )
        assert (
            fake_db.integration_telemetry.inserted[0]["payload"][
                "sendgrid_webhook_timestamp_anomaly_count_total"
            ]
            == 5
        )


def test_http_integrations_governance_report_history_validates_bounds(monkeypatch):
    fake_db = _FakeDb(integration_doc={"userId": "u1"}, telemetry_docs=[])
    client = _build_client(monkeypatch, fake_db)
    response = client.get(
        "/api/integrations/integrations/telemetry/governance-report/history?retention_days=0&limit=10"
    )
    assert response.status_code == 400
    response = client.get(
        "/api/integrations/integrations/telemetry/governance-report/history?retention_days=30&limit=0"
    )
    assert response.status_code == 400


def test_http_integrations_slo_gates(monkeypatch):
    monkeypatch.setenv("INTEGRATION_SLO_MAX_ERROR_RATE_PCT", "5")
    monkeypatch.setenv("INTEGRATION_SLO_SENDGRID_P95_MS", "2000")
    monkeypatch.setenv("INTEGRATION_SLO_APOLLO_P95_MS", "3000")

    recent_base = datetime.now(timezone.utc).replace(microsecond=0)
    slo_created_at_1 = (recent_base - timedelta(minutes=7)).isoformat()
    slo_created_at_2 = (recent_base - timedelta(minutes=5)).isoformat()
    slo_created_at_3 = (recent_base - timedelta(minutes=3)).isoformat()

    fake_db = _FakeDb(
        integration_doc={"userId": "u1"},
        telemetry_docs=[
            {
                "id": "t1",
                "userId": "u1",
                "provider": "apollo",
                "eventType": "apollo_search_success",
                "payload": {"latency_ms": 1200},
                "createdAt": slo_created_at_1,
            },
            {
                "id": "t2",
                "userId": "u1",
                "provider": "sendgrid",
                "eventType": "sendgrid_send_error",
                "payload": {"error": "timeout", "latency_ms": 1500},
                "createdAt": slo_created_at_2,
            },
            {
                "id": "t3",
                "userId": "u1",
                "provider": "sales_intelligence",
                "eventType": "sales_pipeline_forecast_generated",
                "schemaVersion": 2,
                "payload": {"schema_version": 2},
                "createdAt": slo_created_at_3,
            },
        ],
    )
    client = _build_client(monkeypatch, fake_db)
    response = client.get(
        "/api/integrations/integrations/telemetry/slo-gates?days=30&limit=1000&min_schema_v2_sample_count=1"
    )
    assert response.status_code == 200
    payload = response.json()
    assert "gates" in payload
    assert payload["eventCount"] == 3
    assert "errorRate" in payload
    assert "schemaCoverage" in payload
    assert "providerLatency" in payload
    assert "decision" in payload
    assert "rolloutActions" in payload
    assert "signoff" in payload
    assert "requiredApprovals" in payload["signoff"]
    assert payload["gates"]["schemaCoveragePassed"] is True
    assert payload["gates"]["schemaSampleSizePassed"] is True
    assert payload["gates"]["orchestrationAttemptErrorPassed"] is True
    assert payload["gates"]["orchestrationAttemptSkippedPassed"] is True
    assert payload["schemaCoverage"]["sampleCount"] == 1
    assert payload["schemaCoverage"]["minSampleCount"] == 1
    assert payload["schemaCoverage"]["observedPct"] == 100.0
    assert payload["gates"]["retryAuditVolumePassed"] is True
    assert payload["gates"]["retryAuditDelayPassed"] is True
    assert payload["retryAudit"]["observedEventCount"] == 0
    assert payload["retryAudit"]["observedAvgNextDelaySeconds"] == 0.0
    assert payload["retryAudit"]["maxEventCountThreshold"] >= 0
    assert payload["retryAudit"]["maxAvgNextDelaySecondsThreshold"] >= 0
    assert payload["retryAudit"]["observedMaxNextDelaySeconds"] is None
    assert payload["orchestrationAudit"]["observedAttemptErrorCount"] == 0
    assert payload["orchestrationAudit"]["observedAttemptSkippedCount"] == 0
    assert payload["orchestrationAudit"]["maxAttemptErrorCountThreshold"] >= 0
    assert payload["orchestrationAudit"]["maxAttemptSkippedCountThreshold"] >= 0
    assert len(fake_db.integration_telemetry.inserted) == 1
    audit_event = fake_db.integration_telemetry.inserted[0]
    assert audit_event["eventType"] == "integrations_traceability_status_evaluated"
    assert audit_event["payload"]["decision"] == payload["decision"]
    assert audit_event["payload"]["traceability_ready"] is False
    assert audit_event["payload"]["event_count"] == 3


def test_http_integrations_slo_gates_signoff_governance_evidence_contract(monkeypatch):
    monkeypatch.setenv("INTEGRATION_SLO_MAX_ERROR_RATE_PCT", "100")

    recent_base = datetime.now(timezone.utc).replace(microsecond=0)
    signoff_created_at_1 = (recent_base - timedelta(minutes=5)).isoformat()
    signoff_created_at_2 = (recent_base - timedelta(minutes=4)).isoformat()

    fake_db = _FakeDb(
        integration_doc={"userId": "u1"},
        telemetry_docs=[
            {
                "id": "t1",
                "userId": "u1",
                "provider": "apollo",
                "eventType": "apollo_search_success",
                "payload": {"latency_ms": 900},
                "createdAt": signoff_created_at_1,
            },
            {
                "id": "t2",
                "userId": "u1",
                "provider": "sales_intelligence",
                "eventType": "sales_pipeline_forecast_generated",
                "schemaVersion": 2,
                "payload": {"schema_version": 2},
                "createdAt": signoff_created_at_2,
            },
        ],
    )
    client = _build_client(monkeypatch, fake_db)
    response = client.get(
        "/api/integrations/integrations/telemetry/slo-gates?days=30&limit=1000&min_schema_v2_sample_count=1"
    )
    assert response.status_code == 200
    payload = response.json()

    signoff = payload.get("signoff") or {}
    required_evidence = signoff.get("requiredEvidence")
    required_approvals = signoff.get("requiredApprovals")
    assert isinstance(required_evidence, list)
    assert isinstance(required_approvals, list)
    assert all(isinstance(item, str) and item.strip() for item in required_evidence)
    assert len(required_evidence) == len(set(required_evidence))
    assert "connector_governance_weekly_report.json" in required_evidence
    assert "governance_handoff_export.json" in required_evidence
    assert "governance_history_export.json" in required_evidence
    assert "governance_packet_validation.json" in required_evidence
    assert all(
        isinstance(approval, dict)
        and isinstance(approval.get("role"), str)
        and isinstance(approval.get("required"), bool)
        for approval in required_approvals
    )


def test_http_integrations_slo_gates_excludes_existing_traceability_audit_events(monkeypatch):
    recent_base = datetime.now(timezone.utc).replace(microsecond=0)
    audit_created_at_1 = (recent_base - timedelta(minutes=8)).isoformat()
    audit_created_at_2 = (recent_base - timedelta(minutes=7, seconds=30)).isoformat()
    audit_created_at_3 = (recent_base - timedelta(minutes=7, seconds=15)).isoformat()
    audit_created_at_4 = (recent_base - timedelta(minutes=7, seconds=5)).isoformat()
    audit_created_at_5 = (recent_base - timedelta(minutes=7, seconds=2)).isoformat()
    audit_created_at_6 = (recent_base - timedelta(minutes=7, seconds=1)).isoformat()
    audit_created_at_7 = (recent_base - timedelta(minutes=7)).isoformat()
    audit_created_at_8 = (recent_base - timedelta(minutes=6, seconds=59)).isoformat()

    fake_db = _FakeDb(
        integration_doc={"userId": "u1"},
        telemetry_docs=[
            {
                "id": "a1",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "integrations_traceability_status_evaluated",
                "payload": {"decision": "PROCEED", "traceability_ready": True},
                "createdAt": audit_created_at_1,
            },
            {
                "id": "a2",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "integrations_traceability_snapshot_governance_evaluated",
                "payload": {"status": "READY", "within_retention": True},
                "createdAt": audit_created_at_2,
            },
            {
                "id": "a3",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "integrations_traceability_baseline_governance_evaluated",
                "payload": {"status": "PASS", "policy_passed": True},
                "createdAt": audit_created_at_3,
            },
            {
                "id": "a4",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "integrations_traceability_governance_report_generated",
                "payload": {"governance_event_count": 5},
                "createdAt": audit_created_at_4,
            },
            {
                "id": "a5",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "integrations_traceability_governance_report_exported",
                "payload": {"status": "READY", "rollout_blocked": False},
                "createdAt": audit_created_at_5,
            },
            {
                "id": "a6",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "integrations_traceability_governance_report_history_viewed",
                "payload": {"status": "ACTION_REQUIRED", "artifact_count": 0},
                "createdAt": audit_created_at_6,
            },
            {
                "id": "a7",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "integrations_traceability_governance_schema_viewed",
                "payload": {
                    "status": "READY",
                    "active_version": 1,
                    "override_is_set": False,
                },
                "createdAt": audit_created_at_7,
            },
            {
                "id": "s1",
                "userId": "u1",
                "provider": "sales_intelligence",
                "eventType": "sales_pipeline_forecast_generated",
                "schemaVersion": 2,
                "payload": {"schema_version": 2},
                "createdAt": audit_created_at_8,
            },
        ],
    )
    client = _build_client(monkeypatch, fake_db)
    response = client.get(
        "/api/integrations/integrations/telemetry/slo-gates?days=30&limit=1000&min_schema_v2_sample_count=1",
        headers={"X-Request-Id": "req-traceability-audit-1"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["eventCount"] == 1
    assert payload["schemaCoverage"]["sampleCount"] == 1
    assert len(fake_db.integration_telemetry.inserted) == 1
    inserted = fake_db.integration_telemetry.inserted[0]
    assert inserted["payload"]["request_id"] == "req-traceability-audit-1"


def test_http_integrations_slo_gates_can_hold_on_schema_coverage(monkeypatch):
    recent_base = datetime.now(timezone.utc).replace(microsecond=0)
    schema_created_at_1 = (recent_base - timedelta(minutes=5)).isoformat()
    schema_created_at_2 = (recent_base - timedelta(minutes=4)).isoformat()

    fake_db = _FakeDb(
        integration_doc={"userId": "u1"},
        telemetry_docs=[
            {
                "id": "s1",
                "userId": "u1",
                "provider": "sales_intelligence",
                "eventType": "sales_pipeline_forecast_generated",
                "schemaVersion": 2,
                "payload": {"schema_version": 2},
                "createdAt": schema_created_at_1,
            },
            {
                "id": "s2",
                "userId": "u1",
                "provider": "sales_intelligence",
                "eventType": "sales_campaign_created",
                "schemaVersion": 1,
                "payload": {"schema_version": 1},
                "createdAt": schema_created_at_2,
            },
        ],
    )
    client = _build_client(monkeypatch, fake_db)
    response = client.get(
        "/api/integrations/integrations/telemetry/slo-gates?days=30&limit=1000&max_error_rate_pct=100&min_schema_v2_pct=90"
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["gates"]["schemaCoveragePassed"] is False
    assert payload["gates"]["overallPassed"] is False
    assert payload["decision"] == "HOLD"
    assert payload["schemaCoverage"]["sampleCount"] == 2
    assert payload["schemaCoverage"]["schemaV2Count"] == 1
    assert payload["schemaCoverage"]["observedPct"] == 50.0
    assert any(alert["gate"] == "schema_coverage" for alert in payload["alerts"])


def test_http_integrations_slo_gates_can_hold_on_schema_sample_size(monkeypatch):
    recent_base = datetime.now(timezone.utc).replace(microsecond=0)
    sample_created_at_1 = (recent_base - timedelta(minutes=5)).isoformat()
    sample_created_at_2 = (recent_base - timedelta(minutes=4)).isoformat()

    fake_db = _FakeDb(
        integration_doc={"userId": "u1"},
        telemetry_docs=[
            {
                "id": "s1",
                "userId": "u1",
                "provider": "sales_intelligence",
                "eventType": "sales_pipeline_forecast_generated",
                "schemaVersion": 2,
                "payload": {"schema_version": 2},
                "createdAt": sample_created_at_1,
            },
            {
                "id": "s2",
                "userId": "u1",
                "provider": "sales_intelligence",
                "eventType": "sales_campaign_created",
                "schemaVersion": 2,
                "payload": {"schema_version": 2},
                "createdAt": sample_created_at_2,
            },
        ],
    )
    client = _build_client(monkeypatch, fake_db)
    response = client.get(
        "/api/integrations/integrations/telemetry/slo-gates?days=30&limit=1000&max_error_rate_pct=100&min_schema_v2_pct=90&min_schema_v2_sample_count=5"
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["gates"]["schemaCoveragePassed"] is True
    assert payload["gates"]["schemaSampleSizePassed"] is False
    assert payload["gates"]["overallPassed"] is False
    assert payload["decision"] == "HOLD"
    assert payload["schemaCoverage"]["sampleCount"] == 2
    assert payload["schemaCoverage"]["minSampleCount"] == 5
    assert any(alert["gate"] == "schema_sample_size" for alert in payload["alerts"])
    assert any(action["ownerRole"] == "Sales Ops Lead" for action in payload["rolloutActions"])
    assert any(
        "minimum sample threshold" in str(action.get("action", "")).lower()
        for action in payload["rolloutActions"]
    )


def test_http_integrations_slo_gates_can_hold_on_retry_audit_volume(monkeypatch):
    recent_base = datetime.now(timezone.utc).replace(microsecond=0)
    retry_volume_created_at_1 = (recent_base - timedelta(minutes=6)).isoformat()
    retry_volume_created_at_2 = (recent_base - timedelta(minutes=5)).isoformat()
    retry_volume_created_at_3 = (recent_base - timedelta(minutes=4)).isoformat()

    fake_db = _FakeDb(
        integration_doc={"userId": "u1"},
        telemetry_docs=[
            {
                "id": "r1",
                "userId": "u1",
                "provider": "sendgrid",
                "eventType": "integrations_retry_attempt",
                "payload": {"operation": "sendgrid_health_check", "next_delay_seconds": 0.5},
                "createdAt": retry_volume_created_at_1,
            },
            {
                "id": "r2",
                "userId": "u1",
                "provider": "sendgrid",
                "eventType": "integrations_retry_attempt",
                "payload": {"operation": "sendgrid_health_check", "next_delay_seconds": 0.8},
                "createdAt": retry_volume_created_at_2,
            },
            {
                "id": "s1",
                "userId": "u1",
                "provider": "sales_intelligence",
                "eventType": "sales_pipeline_forecast_generated",
                "schemaVersion": 2,
                "payload": {"schema_version": 2},
                "createdAt": retry_volume_created_at_3,
            },
        ],
    )
    client = _build_client(monkeypatch, fake_db)
    response = client.get(
        "/api/integrations/integrations/telemetry/slo-gates?days=30&limit=1000&max_error_rate_pct=100&min_schema_v2_pct=90&min_schema_v2_sample_count=1&max_retry_audit_event_count=1"
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["decision"] == "HOLD"
    assert payload["gates"]["retryAuditVolumePassed"] is False
    assert payload["gates"]["retryAuditDelayPassed"] is True
    assert payload["retryAudit"]["observedEventCount"] == 2
    assert payload["retryAudit"]["maxEventCountThreshold"] == 1
    assert any(alert["gate"] == "retry_audit_volume" for alert in payload["alerts"])
    assert any(action["ownerRole"] == "Integrations Engineer" for action in payload["rolloutActions"])


def test_http_integrations_slo_gates_can_hold_on_retry_audit_delay(monkeypatch):
    recent_base = datetime.now(timezone.utc).replace(microsecond=0)
    retry_delay_created_at_1 = (recent_base - timedelta(minutes=6)).isoformat()
    retry_delay_created_at_2 = (recent_base - timedelta(minutes=5)).isoformat()
    retry_delay_created_at_3 = (recent_base - timedelta(minutes=4)).isoformat()

    fake_db = _FakeDb(
        integration_doc={"userId": "u1"},
        telemetry_docs=[
            {
                "id": "r1",
                "userId": "u1",
                "provider": "sendgrid",
                "eventType": "integrations_retry_attempt",
                "payload": {"operation": "sendgrid_health_check", "next_delay_seconds": 1.2},
                "createdAt": retry_delay_created_at_1,
            },
            {
                "id": "r2",
                "userId": "u1",
                "provider": "sendgrid",
                "eventType": "integrations_retry_attempt",
                "payload": {"operation": "sendgrid_health_check", "next_delay_seconds": 0.8},
                "createdAt": retry_delay_created_at_2,
            },
            {
                "id": "s1",
                "userId": "u1",
                "provider": "sales_intelligence",
                "eventType": "sales_pipeline_forecast_generated",
                "schemaVersion": 2,
                "payload": {"schema_version": 2},
                "createdAt": retry_delay_created_at_3,
            },
        ],
    )
    client = _build_client(monkeypatch, fake_db)
    response = client.get(
        "/api/integrations/integrations/telemetry/slo-gates?days=30&limit=1000&max_error_rate_pct=100&min_schema_v2_pct=90&min_schema_v2_sample_count=1&max_retry_audit_avg_next_delay_seconds=0.5"
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["decision"] == "HOLD"
    assert payload["gates"]["retryAuditVolumePassed"] is True
    assert payload["gates"]["retryAuditDelayPassed"] is False
    assert payload["retryAudit"]["observedEventCount"] == 2
    assert payload["retryAudit"]["observedAvgNextDelaySeconds"] == 1.0
    assert payload["retryAudit"]["maxAvgNextDelaySecondsThreshold"] == 0.5
    assert payload["retryAudit"]["observedMaxNextDelaySeconds"] == 1.2
    assert any(alert["gate"] == "retry_audit_delay" for alert in payload["alerts"])
    assert any(action["ownerRole"] == "On-call Engineer" for action in payload["rolloutActions"])


def test_http_integrations_slo_gates_can_hold_on_orchestration_attempt_error_count(monkeypatch):
    recent_base = datetime.now(timezone.utc).replace(microsecond=0)
    orchestration_error_created_at_1 = (recent_base - timedelta(minutes=5)).isoformat()
    orchestration_error_created_at_2 = (recent_base - timedelta(minutes=3)).isoformat()

    fake_db = _FakeDb(
        integration_doc={"userId": "u1"},
        telemetry_docs=[
            {
                "id": "o1",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "company_enrichment_orchestrated",
                "payload": {
                    "attempt_error_count": 2,
                    "attempt_skipped_count": 0,
                    "attempt_success_count": 0,
                },
                "createdAt": orchestration_error_created_at_1,
            },
            {
                "id": "s1",
                "userId": "u1",
                "provider": "sales_intelligence",
                "eventType": "sales_pipeline_forecast_generated",
                "schemaVersion": 2,
                "payload": {"schema_version": 2},
                "createdAt": orchestration_error_created_at_2,
            },
        ],
    )
    client = _build_client(monkeypatch, fake_db)
    response = client.get(
        "/api/integrations/integrations/telemetry/slo-gates?"
        "days=30&limit=1000&max_error_rate_pct=100&min_schema_v2_pct=90&min_schema_v2_sample_count=1&max_orchestration_attempt_error_count=1"
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["decision"] == "HOLD"
    assert payload["gates"]["orchestrationAttemptErrorPassed"] is False
    assert payload["gates"]["orchestrationAttemptSkippedPassed"] is True
    assert payload["orchestrationAudit"]["observedAttemptErrorCount"] == 2
    assert payload["orchestrationAudit"]["maxAttemptErrorCountThreshold"] == 1
    assert any(alert["gate"] == "orchestration_attempt_error" for alert in payload["alerts"])
    assert any(action["ownerRole"] == "Integrations Engineer" for action in payload["rolloutActions"])


def test_http_integrations_slo_gates_can_hold_on_orchestration_attempt_skipped_count(monkeypatch):
    recent_base = datetime.now(timezone.utc).replace(microsecond=0)
    orchestration_skipped_created_at_1 = (recent_base - timedelta(minutes=5)).isoformat()
    orchestration_skipped_created_at_2 = (recent_base - timedelta(minutes=3)).isoformat()

    fake_db = _FakeDb(
        integration_doc={"userId": "u1"},
        telemetry_docs=[
            {
                "id": "o1",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "company_enrichment_orchestrated",
                "payload": {
                    "attempt_error_count": 0,
                    "attempt_skipped_count": 3,
                    "attempt_success_count": 0,
                },
                "createdAt": orchestration_skipped_created_at_1,
            },
            {
                "id": "s1",
                "userId": "u1",
                "provider": "sales_intelligence",
                "eventType": "sales_pipeline_forecast_generated",
                "schemaVersion": 2,
                "payload": {"schema_version": 2},
                "createdAt": orchestration_skipped_created_at_2,
            },
        ],
    )
    client = _build_client(monkeypatch, fake_db)
    response = client.get(
        "/api/integrations/integrations/telemetry/slo-gates?"
        "days=30&limit=1000&max_error_rate_pct=100&min_schema_v2_pct=90&min_schema_v2_sample_count=1&max_orchestration_attempt_skipped_count=2"
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["decision"] == "HOLD"
    assert payload["gates"]["orchestrationAttemptErrorPassed"] is True
    assert payload["gates"]["orchestrationAttemptSkippedPassed"] is False
    assert payload["orchestrationAudit"]["observedAttemptSkippedCount"] == 3
    assert payload["orchestrationAudit"]["maxAttemptSkippedCountThreshold"] == 2
    assert any(alert["gate"] == "orchestration_attempt_skipped" for alert in payload["alerts"])
    assert any(action["ownerRole"] == "Sales Ops Lead" for action in payload["rolloutActions"])


def test_http_integrations_telemetry_summary_rejects_invalid_days(monkeypatch):
    client = _build_client(monkeypatch, _FakeDb(integration_doc={"userId": "u1"}, telemetry_docs=[]))

    response = client.get("/api/integrations/integrations/telemetry/summary?days=0&limit=500")
    assert response.status_code == 400
    assert "days must be between 1 and 30" in response.text

    response = client.get("/api/integrations/integrations/telemetry/summary?days=31&limit=500")
    assert response.status_code == 400
    assert "days must be between 1 and 30" in response.text


def test_http_integrations_telemetry_summary_rejects_invalid_limit(monkeypatch):
    client = _build_client(monkeypatch, _FakeDb(integration_doc={"userId": "u1"}, telemetry_docs=[]))

    response = client.get("/api/integrations/integrations/telemetry/summary?days=7&limit=49")
    assert response.status_code == 400
    assert "limit must be between 50 and 5000" in response.text

    response = client.get("/api/integrations/integrations/telemetry/summary?days=7&limit=5001")
    assert response.status_code == 400
    assert "limit must be between 50 and 5000" in response.text


def test_http_integrations_slo_gates_rejects_invalid_query_bounds(monkeypatch):
    client = _build_client(monkeypatch, _FakeDb(integration_doc={"userId": "u1"}, telemetry_docs=[]))

    response = client.get("/api/integrations/integrations/telemetry/slo-gates?days=0&limit=1000")
    assert response.status_code == 400
    assert "days must be between 1 and 30" in response.text

    response = client.get("/api/integrations/integrations/telemetry/slo-gates?days=7&limit=99")
    assert response.status_code == 400
    assert "limit must be between 100 and 5000" in response.text

    response = client.get(
        "/api/integrations/integrations/telemetry/slo-gates?days=7&limit=1000&max_error_rate_pct=101"
    )
    assert response.status_code == 400
    assert "max_error_rate_pct must be between 0 and 100" in response.text

    response = client.get(
        "/api/integrations/integrations/telemetry/slo-gates?days=7&limit=1000&min_schema_v2_pct=101"
    )
    assert response.status_code == 400
    assert "min_schema_v2_pct must be between 0 and 100" in response.text

    response = client.get(
        "/api/integrations/integrations/telemetry/slo-gates?days=7&limit=1000&min_schema_v2_sample_count=0"
    )
    assert response.status_code == 400
    assert "min_schema_v2_sample_count must be between 1 and 5000" in response.text

    response = client.get(
        "/api/integrations/integrations/telemetry/slo-gates?days=7&limit=1000&max_retry_audit_event_count=-1"
    )
    assert response.status_code == 400
    assert "max_retry_audit_event_count must be between 0 and 5000" in response.text

    response = client.get(
        "/api/integrations/integrations/telemetry/slo-gates?days=7&limit=1000&max_retry_audit_avg_next_delay_seconds=301"
    )
    assert response.status_code == 400
    assert "max_retry_audit_avg_next_delay_seconds must be between 0 and 300" in response.text

    response = client.get(
        "/api/integrations/integrations/telemetry/slo-gates?days=7&limit=1000&max_orchestration_attempt_error_count=-1"
    )
    assert response.status_code == 400
    assert "max_orchestration_attempt_error_count must be between 0 and 5000" in response.text

    response = client.get(
        "/api/integrations/integrations/telemetry/slo-gates?days=7&limit=1000&max_orchestration_attempt_skipped_count=-1"
    )
    assert response.status_code == 400
    assert "max_orchestration_attempt_skipped_count must be between 0 and 5000" in response.text


def test_http_integrations_slo_gates_rejects_non_numeric_threshold_env(monkeypatch):
    client = _build_client(monkeypatch, _FakeDb(integration_doc={"userId": "u1"}, telemetry_docs=[]))

    monkeypatch.setenv("INTEGRATION_SLO_MAX_ERROR_RATE_PCT", "bad-value")
    response = client.get("/api/integrations/integrations/telemetry/slo-gates?days=7&limit=1000")
    assert response.status_code == 400
    assert "INTEGRATION_SLO_MAX_ERROR_RATE_PCT must be numeric" in response.text

    monkeypatch.delenv("INTEGRATION_SLO_MAX_ERROR_RATE_PCT", raising=False)
    monkeypatch.setenv("INTEGRATION_SLO_MIN_SCHEMA_V2_PCT", "bad-value")
    response = client.get("/api/integrations/integrations/telemetry/slo-gates?days=7&limit=1000")
    assert response.status_code == 400
    assert "INTEGRATION_SLO_MIN_SCHEMA_V2_PCT must be numeric" in response.text

    monkeypatch.delenv("INTEGRATION_SLO_MIN_SCHEMA_V2_PCT", raising=False)
    monkeypatch.setenv("INTEGRATION_SLO_MIN_SCHEMA_V2_SAMPLE_COUNT", "bad-value")
    response = client.get("/api/integrations/integrations/telemetry/slo-gates?days=7&limit=1000")
    assert response.status_code == 400
    assert "INTEGRATION_SLO_MIN_SCHEMA_V2_SAMPLE_COUNT must be an integer" in response.text

    monkeypatch.delenv("INTEGRATION_SLO_MIN_SCHEMA_V2_SAMPLE_COUNT", raising=False)
    monkeypatch.setenv("INTEGRATION_SLO_MAX_RETRY_AUDIT_EVENT_COUNT", "bad-value")
    response = client.get("/api/integrations/integrations/telemetry/slo-gates?days=7&limit=1000")
    assert response.status_code == 400
    assert "INTEGRATION_SLO_MAX_RETRY_AUDIT_EVENT_COUNT must be an integer" in response.text

    monkeypatch.delenv("INTEGRATION_SLO_MAX_RETRY_AUDIT_EVENT_COUNT", raising=False)
    monkeypatch.setenv("INTEGRATION_SLO_MAX_RETRY_AUDIT_AVG_NEXT_DELAY_SECONDS", "bad-value")
    response = client.get("/api/integrations/integrations/telemetry/slo-gates?days=7&limit=1000")
    assert response.status_code == 400
    assert (
        "INTEGRATION_SLO_MAX_RETRY_AUDIT_AVG_NEXT_DELAY_SECONDS must be numeric"
        in response.text
    )

    monkeypatch.delenv("INTEGRATION_SLO_MAX_RETRY_AUDIT_AVG_NEXT_DELAY_SECONDS", raising=False)
    monkeypatch.setenv("INTEGRATION_SLO_MAX_ORCHESTRATION_ATTEMPT_ERROR_COUNT", "bad-value")
    response = client.get("/api/integrations/integrations/telemetry/slo-gates?days=7&limit=1000")
    assert response.status_code == 400
    assert (
        "INTEGRATION_SLO_MAX_ORCHESTRATION_ATTEMPT_ERROR_COUNT must be an integer"
        in response.text
    )

    monkeypatch.delenv("INTEGRATION_SLO_MAX_ORCHESTRATION_ATTEMPT_ERROR_COUNT", raising=False)
    monkeypatch.setenv("INTEGRATION_SLO_MAX_ORCHESTRATION_ATTEMPT_SKIPPED_COUNT", "bad-value")
    response = client.get("/api/integrations/integrations/telemetry/slo-gates?days=7&limit=1000")
    assert response.status_code == 400
    assert (
        "INTEGRATION_SLO_MAX_ORCHESTRATION_ATTEMPT_SKIPPED_COUNT must be an integer"
        in response.text
    )
