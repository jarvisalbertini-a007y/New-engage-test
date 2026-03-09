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
        if not isinstance(self.seed_doc, dict):
            self.seed_doc = {}
        if isinstance(payload, dict):
            set_payload = payload.get("$set")
            unset_payload = payload.get("$unset")
            if isinstance(set_payload, dict):
                for key, value in set_payload.items():
                    self.seed_doc[key] = value
            if isinstance(unset_payload, dict):
                for key in unset_payload.keys():
                    self.seed_doc.pop(key, None)
        return {"ok": 1}

    async def insert_one(self, doc):
        self.inserted.append(doc)
        return {"ok": 1}

    def find(self, flt, *_args, **_kwargs):
        if isinstance(self.seed_doc, list):
            docs = [*self.seed_doc, *self.inserted]
        else:
            docs = self.inserted
        user_id = flt.get("userId")
        created_at_filter = (flt.get("createdAt") or {}).get("$gte", "")
        filtered = [
            d
            for d in docs
            if d.get("userId") == user_id and d.get("createdAt", "") >= created_at_filter
        ]
        return _FakeCursor(filtered)


class _FakeDb:
    def __init__(self):
        self.user_integrations = _FakeCollection(seed_doc={"userId": "u1"})
        self.prospects = _FakeCollection(seed_doc={})
        self.company_research = _FakeCollection(seed_doc={})
        self.integration_event_dedup = _FakeCollection(seed_doc={})
        self.email_sends = _FakeCollection(seed_doc={})
        self.email_events = _FakeCollection(seed_doc={})
        self.integration_telemetry = _FakeCollection(seed_doc=[])


def _build_client(monkeypatch, fake_db):
    app = FastAPI()
    app.include_router(real_integrations.router, prefix="/api/integrations")
    app.dependency_overrides[real_integrations.get_current_user] = (
        lambda: {"id": "u1", "email": "sales@example.com"}
    )
    real_integrations._reset_connector_rate_limit_state()
    monkeypatch.setattr(real_integrations, "get_db", lambda: fake_db)
    return TestClient(app)


def test_connector_credential_lifecycle_smoke_workflow(monkeypatch):
    fake_db = _FakeDb()

    async def fake_sendgrid_health(_api_key, **_kwargs):
        return {
            "provider": "sendgrid",
            "healthy": True,
            "statusCode": 200,
            "latencyMs": 10,
            "error": None,
        }

    monkeypatch.setattr(real_integrations, "_health_check_sendgrid", fake_sendgrid_health)
    client = _build_client(monkeypatch, fake_db)

    save_sendgrid = client.post(
        "/api/integrations/integrations/sendgrid",
        json={"api_key": "SG.lifecycle-key-1", "from_email": "owner@example.com"},
        headers={"X-Request-Id": "req-lifecycle-sendgrid-save"},
    )
    assert save_sendgrid.status_code == 200
    assert save_sendgrid.json().get("keyRotated") is True

    save_apollo = client.post(
        "/api/integrations/integrations/apollo",
        json={"api_key": "apollo-lifecycle-key-1"},
        headers={"X-Request-Id": "req-lifecycle-apollo-save"},
    )
    assert save_apollo.status_code == 200
    assert save_apollo.json().get("keyRotated") is True

    remove_sendgrid = client.delete(
        "/api/integrations/integrations/sendgrid",
        headers={"X-Request-Id": "req-lifecycle-sendgrid-remove"},
    )
    assert remove_sendgrid.status_code == 200
    assert remove_sendgrid.json().get("hadKey") is True

    summary_response = client.get(
        "/api/integrations/integrations/telemetry/summary?days=30&limit=500"
    )
    assert summary_response.status_code == 200
    summary_payload = summary_response.json()
    lifecycle = summary_payload.get("connectorLifecycle") or {}
    by_action = lifecycle.get("byAction") or {}
    by_provider = lifecycle.get("byProvider") or {}

    assert lifecycle.get("eventCount") == 3
    assert by_action.get("saved") == 2
    assert by_action.get("removed") == 1
    assert (by_provider.get("sendgrid") or {}).get("saved") == 1
    assert (by_provider.get("sendgrid") or {}).get("removed") == 1
    assert (by_provider.get("apollo") or {}).get("saved") == 1
    assert (by_provider.get("apollo") or {}).get("removed") == 0
