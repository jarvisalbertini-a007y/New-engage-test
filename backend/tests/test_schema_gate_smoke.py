from datetime import datetime, timedelta, timezone

from fastapi import FastAPI
from fastapi.testclient import TestClient

from routes import real_integrations


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


class _FakeCollection:
    def __init__(self, docs=None, seed_doc=None):
        self.docs = list(docs or [])
        self.seed_doc = seed_doc

    async def find_one(self, *_args, **_kwargs):
        return self.seed_doc

    def find(self, flt, *_args, **_kwargs):
        user_id = flt.get("userId")
        created_at_filter = (flt.get("createdAt") or {}).get("$gte", "")
        filtered = [
            d
            for d in self.docs
            if d.get("userId") == user_id and d.get("createdAt", "") >= created_at_filter
        ]
        return _FakeCursor(filtered)


class _FakeDb:
    def __init__(self, telemetry_docs):
        self.integration_telemetry = _FakeCollection(docs=telemetry_docs)
        self.user_integrations = _FakeCollection(seed_doc={"userId": "u1"})
        self.prospects = _FakeCollection()
        self.company_research = _FakeCollection()
        self.integration_event_dedup = _FakeCollection(seed_doc={})
        self.email_sends = _FakeCollection(seed_doc={})
        self.email_events = _FakeCollection(seed_doc={})


def _build_client(monkeypatch, fake_db):
    app = FastAPI()
    app.include_router(real_integrations.router, prefix="/api/integrations")
    app.dependency_overrides[real_integrations.get_current_user] = (
        lambda: {"id": "u1", "email": "sales@example.com"}
    )
    monkeypatch.setattr(real_integrations, "get_db", lambda: fake_db)
    return TestClient(app)


def test_schema_gate_smoke_hold_then_proceed(monkeypatch):
    recent_base = datetime.now(timezone.utc).replace(
        hour=12, minute=0, second=0, microsecond=0
    )
    created_at_1 = (recent_base - timedelta(minutes=5)).isoformat()
    created_at_2 = recent_base.isoformat()
    telemetry_docs = [
        {
            "id": "s1",
            "userId": "u1",
            "provider": "sales_intelligence",
            "eventType": "sales_pipeline_forecast_generated",
            "schemaVersion": 2,
            "payload": {"schema_version": 2},
            "createdAt": created_at_1,
        },
        {
            "id": "s2",
            "userId": "u1",
            "provider": "sales_intelligence",
            "eventType": "sales_campaign_created",
            "schemaVersion": 1,
            "payload": {"schema_version": 1},
            "createdAt": created_at_2,
        },
    ]
    fake_db = _FakeDb(telemetry_docs)
    client = _build_client(monkeypatch, fake_db)

    hold_response = client.get(
        "/api/integrations/integrations/telemetry/slo-gates?days=30&limit=1000&max_error_rate_pct=100&min_schema_v2_pct=90&min_schema_v2_sample_count=2"
    )
    assert hold_response.status_code == 200
    hold_payload = hold_response.json()
    assert hold_payload["decision"] == "HOLD"
    assert hold_payload["gates"]["schemaCoveragePassed"] is False
    assert hold_payload["schemaCoverage"]["observedPct"] == 50.0

    telemetry_docs[1]["schemaVersion"] = 2
    telemetry_docs[1]["payload"]["schema_version"] = 2

    proceed_response = client.get(
        "/api/integrations/integrations/telemetry/slo-gates?days=30&limit=1000&max_error_rate_pct=100&min_schema_v2_pct=90&min_schema_v2_sample_count=2"
    )
    assert proceed_response.status_code == 200
    proceed_payload = proceed_response.json()
    assert proceed_payload["decision"] == "PROCEED"
    assert proceed_payload["gates"]["schemaCoveragePassed"] is True
    assert proceed_payload["schemaCoverage"]["observedPct"] == 100.0
