from fastapi import FastAPI
from fastapi.testclient import TestClient

from routes import sales_intelligence


class _FakeCursor:
    def __init__(self, docs):
        self.docs = list(docs)
        self._limit = len(self.docs)

    def sort(self, field, direction):
        reverse = direction == -1
        self.docs.sort(key=lambda d: d.get(field, ""), reverse=reverse)
        return self

    def limit(self, n):
        self._limit = n
        return self

    async def to_list(self, n):
        return self.docs[: min(self._limit, n)]


class _FakeUpdateResult:
    def __init__(self, matched_count):
        self.matched_count = matched_count


def _set_nested(doc, key_path, value):
    keys = key_path.split(".")
    target = doc
    for key in keys[:-1]:
        if key not in target or not isinstance(target[key], dict):
            target[key] = {}
        target = target[key]
    target[keys[-1]] = value


def _inc_nested(doc, key_path, amount):
    keys = key_path.split(".")
    target = doc
    for key in keys[:-1]:
        if key not in target or not isinstance(target[key], dict):
            target[key] = {}
        target = target[key]
    leaf = keys[-1]
    target[leaf] = int(target.get(leaf, 0)) + int(amount)


def _add_to_set_nested(doc, key_path, value):
    keys = key_path.split(".")
    target = doc
    for key in keys[:-1]:
        if key not in target or not isinstance(target[key], dict):
            target[key] = {}
        target = target[key]
    leaf = keys[-1]
    if leaf not in target or not isinstance(target[leaf], list):
        target[leaf] = []
    if value not in target[leaf]:
        target[leaf].append(value)


def _matches_filter(doc, flt):
    for key, expected in flt.items():
        if isinstance(expected, dict) and "$nin" in expected:
            if doc.get(key) in expected["$nin"]:
                return False
            continue
        if doc.get(key) != expected:
            return False
    return True


class _FakeCollection:
    def __init__(self, docs=None):
        self.docs = list(docs or [])
        self.inserted = []

    async def insert_one(self, doc):
        self.inserted.append(doc)
        self.docs.append(doc)
        return {"ok": 1}

    async def find_one(self, flt=None, *_args, **_kwargs):
        flt = flt or {}
        for doc in self.docs:
            if _matches_filter(doc, flt):
                return doc
        return None

    async def update_one(self, flt, payload, upsert=False):
        for doc in self.docs:
            if _matches_filter(doc, flt):
                if "$set" in payload:
                    for key, value in payload["$set"].items():
                        _set_nested(doc, key, value)
                if "$inc" in payload:
                    for key, value in payload["$inc"].items():
                        _inc_nested(doc, key, value)
                if "$addToSet" in payload:
                    for key, value in payload["$addToSet"].items():
                        _add_to_set_nested(doc, key, value)
                return _FakeUpdateResult(1)
        return _FakeUpdateResult(0)

    def find(self, flt=None, *_args, **_kwargs):
        flt = flt or {}
        return _FakeCursor([doc for doc in self.docs if _matches_filter(doc, flt)])


class _FakeDb:
    def __init__(self):
        self.sales_campaigns = _FakeCollection([])
        self.integration_telemetry = _FakeCollection([])


def _build_client(monkeypatch):
    fake_db = _FakeDb()
    app = FastAPI()
    app.include_router(sales_intelligence.router, prefix="/api/sales-intelligence")
    app.dependency_overrides[sales_intelligence.get_current_user] = (
        lambda: {"id": "u1", "email": "sales@example.com"}
    )
    monkeypatch.setattr(sales_intelligence, "get_db", lambda: fake_db)
    return TestClient(app), fake_db


def test_sales_campaign_workflow_smoke(monkeypatch):
    monkeypatch.setenv("ENABLE_SALES_CAMPAIGNS", "true")
    client, fake_db = _build_client(monkeypatch)

    create_response = client.post(
        "/api/sales-intelligence/campaigns",
        json={"name": "Campaign Smoke", "objective": "pipeline_growth", "channels": ["email", "linkedin"]},
    )
    assert create_response.status_code == 200
    campaign_id = create_response.json()["id"]

    list_response = client.get("/api/sales-intelligence/campaigns?status=draft")
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1

    activate_response = client.post(f"/api/sales-intelligence/campaigns/{campaign_id}/activate", json={})
    assert activate_response.status_code == 200
    assert activate_response.json()["status"] == "active"

    metrics_response = client.post(
        f"/api/sales-intelligence/campaigns/{campaign_id}/metrics",
        json={"channel": "email", "sent": 20, "opened": 8, "replied": 3},
    )
    assert metrics_response.status_code == 200
    metrics = metrics_response.json()["metrics"]["email"]
    assert metrics["sent"] == 20
    assert metrics["opened"] == 8
    assert metrics["replied"] == 3

    event_types = [item["eventType"] for item in fake_db.integration_telemetry.docs]
    assert "sales_campaign_created" in event_types
    assert "sales_campaign_activated" in event_types
    assert "sales_campaign_metrics_recorded" in event_types
