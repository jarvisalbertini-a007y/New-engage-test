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


def _write_command_alias_artifact(
    path: Path,
    *,
    valid: bool = True,
    missing_aliases=None,
    mismatched_aliases=None,
):
    path.write_text(
        json.dumps(
            {
                "generatedAt": "2026-02-23T00:00:00+00:00",
                "command": "verify_sales_baseline_command_aliases",
                "artifact": {
                    "valid": valid,
                    "validatedAt": "2026-02-23T00:05:00+00:00",
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
                            "actual": "npm run check",
                            "expected": "npm run check",
                            "valid": True,
                        },
                    },
                    "missingAliases": list(missing_aliases or []),
                    "mismatchedAliases": list(mismatched_aliases or []),
                    "errors": [],
                    "packageJsonExists": True,
                    "packageJsonPath": "/Users/AIL/Documents/EngageAI/EngageAI2/package.json",
                },
            }
        ),
        encoding="utf-8",
    )


def test_baseline_governance_recommended_command_contract_remains_wrapper_first(monkeypatch):
    fake_db = _FakeDb(integration_doc={"userId": "u1"})
    client = _build_client(monkeypatch, fake_db)

    with tempfile.TemporaryDirectory() as tmp:
        artifact_path = Path(tmp) / "baseline_metrics.json"
        alias_artifact_path = Path(tmp) / "sales_baseline_command_aliases.json"
        artifact_path.write_text(
            json.dumps(
                {
                    "generatedAt": "2026-02-23T00:00:00+00:00",
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
                        "npm run verify:smoke:orchestration-slo-gate",
                        "npm run verify:baseline:metrics",
                        "npm run verify:smoke:baseline-governance-drift",
                        "npm run verify:ci:sales:extended",
                    ],
                }
            ),
            encoding="utf-8",
        )
        _write_command_alias_artifact(alias_artifact_path, valid=False, missing_aliases=["verify:smoke:sales"], mismatched_aliases=["typecheck"])
        monkeypatch.setattr(real_integrations, "BASELINE_METRICS_ARTIFACT_PATH", artifact_path)
        monkeypatch.setattr(
            real_integrations,
            "BASELINE_COMMAND_ALIASES_ARTIFACT_PATH",
            alias_artifact_path,
        )

        response = client.get("/api/integrations/integrations/telemetry/baseline-governance")
        assert response.status_code == 200
        payload = response.json()
        assert payload["status"] == "FAIL"
        assert payload["commandAliases"]["present"] is True
        assert payload["commandAliases"]["available"] is True
        assert payload["commandAliases"]["source"] == "artifact_file"
        assert payload["commandAliases"]["valid"] is False
        assert payload["commandAliases"]["gatePassed"] is False
        assert payload["commandAliases"]["missingAliasCount"] == 1
        assert payload["commandAliases"]["mismatchedAliasCount"] == 1
        assert payload["recommendedCommands"][0] == "npm run verify:smoke:baseline-orchestration-remediation"
        assert payload["recommendedCommands"][1:4] == [
            "npm run verify:baseline:command-aliases:artifact",
            "npm run verify:baseline:command-aliases:artifact:contract",
            "npm run verify:smoke:baseline-command-aliases-artifact",
        ]
        assert "npm run verify:smoke:orchestration-slo-gate" not in payload["recommendedCommands"]
        assert "npm run verify:baseline:metrics" not in payload["recommendedCommands"]
        assert "npm run verify:smoke:baseline-governance-drift" not in payload["recommendedCommands"]
        assert payload["governanceExport"]["commandAliases"]["valid"] is False
        assert payload["governanceExport"]["recommendedCommands"] == payload["recommendedCommands"]
        assert len(fake_db.integration_telemetry.inserted) == 1
        governance_event = fake_db.integration_telemetry.inserted[0]
        assert governance_event["payload"]["status"] == "FAIL"
        assert governance_event["payload"]["command_aliases_available"] is True
        assert governance_event["payload"]["command_aliases_valid"] is False
        assert governance_event["payload"]["command_aliases_gate_passed"] is False
        assert governance_event["payload"]["recommended_commands"] == payload["recommendedCommands"]
        assert (
            governance_event["payload"]["recommended_command_count"]
            == len(payload["recommendedCommands"])
        )
        assert governance_event["payload"]["reason_code_count"] == len(payload["reasonCodes"])


def test_baseline_governance_recommended_command_contract_keeps_pass_chain_parity(monkeypatch):
    fake_db = _FakeDb(integration_doc={"userId": "u1"})
    client = _build_client(monkeypatch, fake_db)

    with tempfile.TemporaryDirectory() as tmp:
        artifact_path = Path(tmp) / "baseline_metrics.json"
        alias_artifact_path = Path(tmp) / "sales_baseline_command_aliases.json"
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
        _write_command_alias_artifact(alias_artifact_path, valid=True)
        monkeypatch.setattr(real_integrations, "BASELINE_METRICS_ARTIFACT_PATH", artifact_path)
        monkeypatch.setattr(
            real_integrations,
            "BASELINE_COMMAND_ALIASES_ARTIFACT_PATH",
            alias_artifact_path,
        )

        response = client.get("/api/integrations/integrations/telemetry/baseline-governance")
        assert response.status_code == 200
        payload = response.json()
        assert payload["status"] == "PASS"
        assert payload["commandAliases"]["present"] is True
        assert payload["commandAliases"]["available"] is True
        assert payload["commandAliases"]["valid"] is True
        assert payload["commandAliases"]["gatePassed"] is True
        assert payload["recommendedCommands"] == ["npm run verify:ci:sales:extended"]
        assert payload["governanceExport"]["recommendedCommands"] == payload["recommendedCommands"]
        assert len(fake_db.integration_telemetry.inserted) == 1
        governance_event = fake_db.integration_telemetry.inserted[0]
        assert governance_event["payload"]["status"] == "PASS"
        assert governance_event["payload"]["command_aliases_available"] is True
        assert governance_event["payload"]["command_aliases_valid"] is True
        assert governance_event["payload"]["command_aliases_gate_passed"] is True
        assert governance_event["payload"]["recommended_commands"] == payload["recommendedCommands"]
        assert (
            governance_event["payload"]["recommended_command_count"]
            == len(payload["recommendedCommands"])
        )
        assert governance_event["payload"]["reason_code_count"] == len(payload["reasonCodes"])
