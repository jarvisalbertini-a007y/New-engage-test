import json
from datetime import datetime, timedelta, timezone

from fastapi import FastAPI
from fastapi.testclient import TestClient

from routes import real_integrations


class _FakeCollection:
    def __init__(self, seed_doc=None):
        self.seed_doc = seed_doc
        self.inserted = []

    async def find_one(self, _flt=None, *_args, **_kwargs):
        if isinstance(self.seed_doc, dict):
            return self.seed_doc
        return None

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
            doc
            for doc in docs
            if doc.get("userId") == user_id and doc.get("createdAt", "") >= created_at_filter
        ]
        return _FakeCursor(filtered)


class _FakeCursor:
    def __init__(self, docs):
        self.docs = list(docs)
        self._limit = len(self.docs)

    def sort(self, _field, direction):
        reverse = direction == -1
        self.docs.sort(key=lambda item: item.get("createdAt", ""), reverse=reverse)
        return self

    def limit(self, n):
        self._limit = n
        return self

    async def to_list(self, n):
        return self.docs[: min(self._limit, n)]


class _FakeDb:
    def __init__(self, telemetry_docs=None):
        self.user_integrations = _FakeCollection(seed_doc={})
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
    monkeypatch.setattr(real_integrations, "get_db", lambda: fake_db)
    return TestClient(app)


def test_packet_filter_smoke_rejects_invalid_query_value(monkeypatch):
    fake_db = _FakeDb()
    client = _build_client(monkeypatch, fake_db)

    response = client.get(
        "/api/integrations/integrations/telemetry/summary?days=7&limit=500&packet_only_recent_events=not-a-bool"
    )
    assert response.status_code == 422
    payload = response.json()
    details = payload.get("detail") or []
    assert any(
        isinstance(item, dict)
        and item.get("loc") == ["query", "packet_only_recent_events"]
        for item in details
    )


def test_packet_filter_smoke_survives_malformed_payload_mix(monkeypatch):
    recent_base = datetime.now(timezone.utc).replace(
        hour=12, minute=0, second=0, microsecond=0
    )
    created_at_1 = recent_base.isoformat()
    created_at_2 = (recent_base - timedelta(minutes=1)).isoformat()
    created_at_3 = (recent_base - timedelta(minutes=2)).isoformat()
    fake_db = _FakeDb(
        telemetry_docs=[
            {
                "id": "pf1",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "integrations_traceability_status_evaluated",
                "payload": {
                    "request_id": "req-packet-only",
                    "decision": "HOLD",
                    "traceability_ready": False,
                    "governance_packet_validation_status": "ACTION_REQUIRED",
                    "governance_packet_validation_within_freshness": False,
                },
                "createdAt": created_at_1,
            },
            {
                "id": "pf2",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "integrations_traceability_snapshot_governance_evaluated",
                "payload": "malformed-payload",
                "createdAt": created_at_2,
            },
            {
                "id": "pf3",
                "userId": "u1",
                "provider": "sales_intelligence",
                "eventType": "sales_pipeline_forecast_generated",
                "payload": {"schema_version": 2, "request_id": "req-sales"},
                "schemaVersion": 2,
                "createdAt": created_at_3,
            },
        ]
    )
    client = _build_client(monkeypatch, fake_db)

    response = client.get(
        "/api/integrations/integrations/telemetry/summary?days=30&limit=500&packet_only_recent_events=true"
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["eventCount"] == 3
    assert payload["recentEventsFilter"] == "packet"
    assert payload["recentEventsTotalCount"] == 3
    assert payload["recentEventsFilteredCount"] == 1
    assert len(payload["recentEvents"]) == 1
    assert payload["recentEvents"][0]["requestId"] == "req-packet-only"
    assert payload["recentEvents"][0]["governancePacketValidationStatus"] == "ACTION_REQUIRED"


def test_packet_filter_smoke_explicit_false_query_retains_all_rows_and_normalizes_status(
    monkeypatch,
):
    recent_base = datetime.now(timezone.utc).replace(
        hour=12, minute=0, second=0, microsecond=0
    )
    created_at_1 = recent_base.isoformat()
    created_at_2 = (recent_base - timedelta(minutes=1)).isoformat()
    created_at_3 = (recent_base - timedelta(minutes=2)).isoformat()
    fake_db = _FakeDb(
        telemetry_docs=[
            {
                "id": "pf-false-1",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "integrations_traceability_status_evaluated",
                "payload": {
                    "request_id": "req-packet-false-filter",
                    "governance_packet_validation_status": " action required ",
                    "governance_packet_validation_within_freshness": False,
                },
                "createdAt": created_at_1,
            },
            {
                "id": "pf-false-2",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "integrations_traceability_status_evaluated",
                "payload": {
                    "request_id": "req-packet-false-filter-freshness-only",
                    "governance_packet_validation_status": " !!! ",
                    "governance_packet_validation_within_freshness": True,
                },
                "createdAt": created_at_2,
            },
            {
                "id": "pf-false-3",
                "userId": "u1",
                "provider": "sales_intelligence",
                "eventType": "sales_pipeline_forecast_generated",
                "payload": {"schema_version": 2, "request_id": "req-non-packet"},
                "schemaVersion": 2,
                "createdAt": created_at_3,
            },
        ]
    )
    client = _build_client(monkeypatch, fake_db)

    response = client.get(
        "/api/integrations/integrations/telemetry/summary?days=30&limit=500&packet_only_recent_events=false"
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["eventCount"] == 3
    assert payload["recentEventsFilter"] == "all"
    assert payload["recentEventsTotalCount"] == 3
    assert payload["recentEventsFilteredCount"] == 3
    assert payload["recentEventsPacketValidationCount"] == 2
    assert payload["recentEventsNonPacketCount"] == 1
    assert payload["recentEventsGovernanceStatusCounts"] == {}
    assert payload["recentEventsPacketValidationStatusCounts"] == {"ACTION_REQUIRED": 1}
    assert len(payload["recentEvents"]) == 3
    recent_by_request_id = {
        event.get("requestId"): event for event in payload["recentEvents"]
    }
    assert (
        recent_by_request_id["req-packet-false-filter"][
            "governancePacketValidationStatus"
        ]
        == "ACTION_REQUIRED"
    )
    assert (
        recent_by_request_id["req-packet-false-filter-freshness-only"][
            "governancePacketValidationStatus"
        ]
        is None
    )


def test_packet_filter_smoke_combines_packet_only_and_status_filters(monkeypatch):
    recent_base = datetime.now(timezone.utc).replace(
        hour=12, minute=0, second=0, microsecond=0
    )
    created_at_1 = recent_base.isoformat()
    created_at_2 = (recent_base - timedelta(minutes=1)).isoformat()
    created_at_3 = (recent_base - timedelta(minutes=2)).isoformat()
    fake_db = _FakeDb(
        telemetry_docs=[
            {
                "id": "pf-combined-1",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "integrations_traceability_status_evaluated",
                "payload": {
                    "request_id": "req-combined-ready",
                    "governance_packet_validation_status": "ready",
                    "governance_packet_validation_within_freshness": True,
                    "status": "pass",
                },
                "createdAt": created_at_1,
            },
            {
                "id": "pf-combined-2",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "integrations_traceability_status_evaluated",
                "payload": {
                    "request_id": "req-combined-action-required",
                    "governance_packet_validation_status": "ACTION_REQUIRED",
                    "governance_packet_validation_within_freshness": False,
                    "status": "ACTION_REQUIRED",
                },
                "createdAt": created_at_2,
            },
            {
                "id": "pf-combined-3",
                "userId": "u1",
                "provider": "sales_intelligence",
                "eventType": "sales_pipeline_forecast_generated",
                "payload": {"schema_version": 2, "request_id": "req-combined-sales"},
                "schemaVersion": 2,
                "createdAt": created_at_3,
            },
        ]
    )
    client = _build_client(monkeypatch, fake_db)

    response = client.get(
        "/api/integrations/integrations/telemetry/summary?days=30&limit=500&packet_only_recent_events=true&packet_validation_status=ready"
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["eventCount"] == 3
    assert payload["recentEventsFilter"] == "packet"
    assert payload["recentEventsPacketValidationStatusFilter"] == "READY"
    assert payload["recentEventsGovernanceStatusFilter"] is None
    assert payload["recentEventsFilteredCount"] == 1
    assert payload["recentEventsGovernanceStatusCounts"] == {"PASS": 1}
    assert payload["recentEventsPacketValidationStatusCounts"] == {"READY": 1}
    assert len(payload["recentEvents"]) == 1
    assert payload["recentEvents"][0]["requestId"] == "req-combined-ready"
    assert payload["recentEvents"][0]["governancePacketValidationStatus"] == "READY"


def test_packet_filter_smoke_rejects_blank_status_filter_query_values(monkeypatch):
    fake_db = _FakeDb()
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
