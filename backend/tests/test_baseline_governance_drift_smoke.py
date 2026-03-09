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


def test_baseline_governance_artifact_drift_transitions(monkeypatch):
    fake_db = _FakeDb(integration_doc={"userId": "u1"})
    client = _build_client(monkeypatch, fake_db)

    with tempfile.TemporaryDirectory() as tmp:
        artifact_path = Path(tmp) / "baseline_metrics.json"
        monkeypatch.setattr(real_integrations, "BASELINE_METRICS_ARTIFACT_PATH", artifact_path)

        missing_response = client.get("/api/integrations/integrations/telemetry/baseline-governance")
        assert missing_response.status_code == 404

        artifact_path.write_text("{invalid", encoding="utf-8")
        invalid_response = client.get("/api/integrations/integrations/telemetry/baseline-governance")
        assert invalid_response.status_code == 422

        artifact_path.write_text(json.dumps(["invalid-root"]), encoding="utf-8")
        non_object_response = client.get("/api/integrations/integrations/telemetry/baseline-governance")
        assert non_object_response.status_code == 422

        artifact_path.write_text(
            json.dumps(
                {
                    "generatedAt": "2026-02-23T00:00:00+00:00",
                    "overallStatus": "fail",
                    "releaseGateFixturePolicy": {
                        "passed": False,
                        "requiredProfiles": ["pass", "hold", "validation-fail"],
                        "missingProfiles": ["validation-fail"],
                        "message": "Missing release-gate fixture profile(s): validation-fail",
                    },
                    "releaseGateFixtures": {
                        "allProfilesAvailable": False,
                        "availableProfileCount": 2,
                        "profileCount": 3,
                    },
                    "orchestrationGate": {
                        "available": True,
                        "decision": "HOLD",
                        "attemptErrorGatePassed": False,
                        "attemptSkippedGatePassed": True,
                        "maxAttemptErrorCountThreshold": 1,
                        "observedAttemptErrorCount": 4,
                        "maxAttemptSkippedCountThreshold": 2,
                        "observedAttemptSkippedCount": 2,
                    },
                }
            ),
            encoding="utf-8",
        )
        valid_response = client.get("/api/integrations/integrations/telemetry/baseline-governance")
        assert valid_response.status_code == 200
        payload = valid_response.json()
        assert payload["status"] == "FAIL"
        assert payload["releaseGateFixturePolicy"]["passed"] is False
        assert payload["releaseGateFixturePolicy"]["missingProfiles"] == ["validation-fail"]
        assert payload["orchestrationGate"]["available"] is True
        assert payload["orchestrationGate"]["decision"] == "HOLD"
        assert payload["orchestrationGate"]["attemptErrorGatePassed"] is False
        assert payload["orchestrationGate"]["attemptSkippedGatePassed"] is True


def test_baseline_governance_smoke_requires_orchestration_gate_pass(monkeypatch):
    fake_db = _FakeDb(integration_doc={"userId": "u1"})
    client = _build_client(monkeypatch, fake_db)

    with tempfile.TemporaryDirectory() as tmp:
        artifact_path = Path(tmp) / "baseline_metrics.json"
        monkeypatch.setattr(real_integrations, "BASELINE_METRICS_ARTIFACT_PATH", artifact_path)

        artifact_path.write_text(
            json.dumps(
                {
                    "generatedAt": "2026-02-23T00:00:00+00:00",
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
                        "attemptSkippedGatePassed": True,
                        "maxAttemptErrorCountThreshold": 5,
                        "observedAttemptErrorCount": 7,
                        "maxAttemptSkippedCountThreshold": 25,
                        "observedAttemptSkippedCount": 2,
                    },
                }
            ),
            encoding="utf-8",
        )
        failed_response = client.get("/api/integrations/integrations/telemetry/baseline-governance")
        assert failed_response.status_code == 200
        failed_payload = failed_response.json()
        assert failed_payload["status"] == "FAIL"
        assert failed_payload["handoff"]["rolloutBlocked"] is True
        assert any(
            "orchestration gate failed" in alert.lower()
            for alert in failed_payload.get("alerts", [])
        )

        artifact_path.write_text(
            json.dumps(
                {
                    "generatedAt": "2026-02-23T00:10:00+00:00",
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
        recovered_response = client.get("/api/integrations/integrations/telemetry/baseline-governance")
        assert recovered_response.status_code == 200
        recovered_payload = recovered_response.json()
        assert recovered_payload["status"] == "PASS"
        assert recovered_payload["handoff"]["rolloutBlocked"] is False


def test_baseline_governance_runtime_prereqs_recovery_transition(monkeypatch):
    fake_db = _FakeDb(integration_doc={"userId": "u1"})
    client = _build_client(monkeypatch, fake_db)

    with tempfile.TemporaryDirectory() as tmp:
        artifact_path = Path(tmp) / "baseline_metrics.json"
        monkeypatch.setattr(real_integrations, "BASELINE_METRICS_ARTIFACT_PATH", artifact_path)

        artifact_path.write_text(
            json.dumps(
                {
                    "generatedAt": "2026-02-23T00:00:00+00:00",
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
                        "command": "verify_sales_runtime_prereqs",
                        "artifactPath": "/tmp/sales_runtime_prereqs.json",
                        "contractValid": True,
                        "valid": False,
                        "missingChecks": {"commands": ["node"], "workspace": []},
                        "missingCheckCount": 1,
                    },
                }
            ),
            encoding="utf-8",
        )
        failed_response = client.get("/api/integrations/integrations/telemetry/baseline-governance")
        assert failed_response.status_code == 200
        failed_payload = failed_response.json()
        assert failed_payload["status"] == "FAIL"
        assert failed_payload["runtimePrereqs"]["present"] is True
        assert failed_payload["runtimePrereqs"]["passed"] is False
        assert any(
            "runtime prerequisite checks failed" in alert.lower()
            for alert in failed_payload.get("alerts", [])
        )

        artifact_path.write_text(
            json.dumps(
                {
                    "generatedAt": "2026-02-23T00:10:00+00:00",
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
                        "command": "verify_sales_runtime_prereqs",
                        "artifactPath": "/tmp/sales_runtime_prereqs.json",
                        "contractValid": True,
                        "valid": True,
                        "missingChecks": {"commands": [], "workspace": []},
                        "missingCheckCount": 0,
                    },
                }
            ),
            encoding="utf-8",
        )
        recovered_response = client.get("/api/integrations/integrations/telemetry/baseline-governance")
        assert recovered_response.status_code == 200
        recovered_payload = recovered_response.json()
        assert recovered_payload["status"] == "PASS"
        assert recovered_payload["runtimePrereqs"]["present"] is True
        assert recovered_payload["runtimePrereqs"]["passed"] is True
        assert recovered_payload["handoff"]["rolloutBlocked"] is False
