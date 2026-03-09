from datetime import datetime, timezone
import json
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
    monkeypatch.setattr(real_integrations, "get_db", lambda: fake_db)
    return TestClient(app)


def test_governance_export_schema_version_smoke(monkeypatch):
    monkeypatch.setenv("GOVERNANCE_EXPORT_SCHEMA_VERSION", "5")
    fake_db = _FakeDb(
        integration_doc={"userId": "u1"},
        telemetry_docs=[
            {
                "id": "t1",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "integrations_traceability_status_evaluated",
                "payload": {"decision": "PROCEED", "request_id": "req-governance-schema-smoke"},
                "createdAt": "2026-02-23T00:00:00+00:00",
            },
            {
                "id": "t2",
                "userId": "u1",
                "provider": "integrations",
                "eventType": "integrations_traceability_snapshot_governance_evaluated",
                "payload": {"status": "READY", "request_id": "req-governance-schema-smoke-2"},
                "createdAt": "2026-02-23T00:01:00+00:00",
            },
        ],
    )
    client = _build_client(monkeypatch, fake_db)

    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)

        telemetry_snapshot = tmp_path / "connector-telemetry-summary-2026-02-23.json"
        telemetry_snapshot.write_text(
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

        baseline_metrics = tmp_path / "baseline_metrics.json"
        baseline_metrics.write_text(
            json.dumps(
                {
                    "generatedAt": "2026-02-23T00:00:00+00:00",
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
                }
            ),
            encoding="utf-8",
        )

        governance_report_artifact = (
            tmp_path / "connector_governance_weekly_report_recent.json"
        )
        governance_report_artifact.write_text(
            json.dumps(
                {
                    "generatedAt": datetime.now(timezone.utc).isoformat(),
                    "exportSchemaVersion": 5,
                    "governanceExport": {
                        "status": "READY",
                        "rolloutBlocked": False,
                        "exportSchemaVersion": 5,
                    },
                }
            ),
            encoding="utf-8",
        )
        governance_packet_validation = tmp_path / "governance_packet_validation.json"
        governance_packet_validation.write_text(
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
            baseline_metrics,
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
            governance_packet_validation,
        )

        snapshot_response = client.get(
            "/api/integrations/integrations/telemetry/snapshot-governance?retention_days=30"
        )
        assert snapshot_response.status_code == 200
        snapshot_payload = snapshot_response.json()
        assert snapshot_payload["exportSchemaVersion"] == 5
        assert snapshot_payload["governanceExport"]["exportSchemaVersion"] == 5

        baseline_response = client.get(
            "/api/integrations/integrations/telemetry/baseline-governance"
        )
        assert baseline_response.status_code == 200
        baseline_payload = baseline_response.json()
        assert baseline_payload["exportSchemaVersion"] == 5
        assert baseline_payload["governanceExport"]["exportSchemaVersion"] == 5

        report_response = client.get(
            "/api/integrations/integrations/telemetry/governance-report?days=7&limit=500"
        )
        assert report_response.status_code == 200
        report_payload = report_response.json()
        assert report_payload["exportSchemaVersion"] == 5
        assert report_payload["governanceExport"]["exportSchemaVersion"] == 5

        export_response = client.get(
            "/api/integrations/integrations/telemetry/governance-report/export?days=7&limit=500"
        )
        assert export_response.status_code == 200
        export_payload = export_response.json()
        assert export_payload["exportSchemaVersion"] == 5
        assert export_payload["governanceExport"]["exportSchemaVersion"] == 5

        history_response = client.get(
            "/api/integrations/integrations/telemetry/governance-report/history?retention_days=30&limit=25"
        )
        assert history_response.status_code == 200
        history_payload = history_response.json()
        assert history_payload["exportSchemaVersion"] == 5
        assert history_payload["governanceExport"]["exportSchemaVersion"] == 5
        assert history_payload["items"][0]["exportSchemaVersion"] == 5
