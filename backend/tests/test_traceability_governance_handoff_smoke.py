import json
from datetime import datetime, timedelta, timezone
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pathlib import Path
import tempfile

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

    def find(self, _flt, *_args, **_kwargs):
        return _FakeCursor([])


class _FakeCursor:
    def __init__(self, docs):
        self.docs = list(docs)
        self._limit = len(self.docs)

    def sort(self, _field, _direction):
        return self

    def limit(self, n):
        self._limit = n
        return self

    async def to_list(self, n):
        return self.docs[: min(self._limit, n)]


class _FakeDb:
    def __init__(self, integration_doc=None):
        self.user_integrations = _FakeCollection(seed_doc=integration_doc or {})
        self.prospects = _FakeCollection()
        self.company_research = _FakeCollection()
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
    monkeypatch.setattr(real_integrations, "get_db", lambda: fake_db)
    return TestClient(app)


def test_snapshot_governance_action_required_handoff_blocks_rollout(monkeypatch):
    fake_db = _FakeDb(integration_doc={"userId": "u1"})
    client = _build_client(monkeypatch, fake_db)

    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        stale_snapshot = tmp_path / "connector-telemetry-summary-2025-01-01.json"
        stale_snapshot.write_text(
            json.dumps(
                {
                    "generatedAt": (
                        datetime.now(timezone.utc) - timedelta(days=120)
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
        assert payload["handoff"]["rolloutBlocked"] is True
        assert payload["handoff"]["ownerRole"] == "Release Manager"
        assert len(payload["handoff"]["actions"]) >= 2
        assert len(payload["alerts"]) >= 1
