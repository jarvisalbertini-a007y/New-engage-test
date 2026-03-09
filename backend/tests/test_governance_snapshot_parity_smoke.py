import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
import tempfile

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


def test_snapshot_governance_contract_parity_smoke(monkeypatch):
    fake_db = _FakeDb(integration_doc={"userId": "u1"})
    client = _build_client(monkeypatch, fake_db)

    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        stale_snapshot_path = tmp_path / "connector-telemetry-summary-stale.json"
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
        hold_fixture = tmp_path / "connector_release_gate_result_hold.json"
        validation_fail_fixture = (
            tmp_path / "connector_release_gate_result_validation_fail.json"
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

        response = client.get(
            "/api/integrations/integrations/telemetry/snapshot-governance?retention_days=30"
        )
        assert response.status_code == 200
        payload = response.json()
        assert payload["status"] == "ACTION_REQUIRED"
        assert isinstance(payload["recommendedCommands"], list)
        assert payload["governanceExport"]["recommendedCommands"] == payload[
            "recommendedCommands"
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
        assert len(fake_db.integration_telemetry.inserted) == 1
        governance_event = fake_db.integration_telemetry.inserted[0]
        assert (
            governance_event["eventType"]
            == "integrations_traceability_snapshot_governance_evaluated"
        )
        assert governance_event["payload"]["status"] == "ACTION_REQUIRED"
        assert governance_event["payload"]["recommended_commands"] == payload[
            "recommendedCommands"
        ]
        assert set(governance_event["payload"]["reason_codes"]) == top_level_reason_codes
        assert governance_event["payload"]["reason_code_count"] == len(top_level_reason_codes)
        assert (
            governance_event["payload"]["recommended_command_count"]
            == len(payload["recommendedCommands"])
        )
