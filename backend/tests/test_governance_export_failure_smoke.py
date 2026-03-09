import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
import subprocess
import tempfile

from fastapi import FastAPI
from fastapi.testclient import TestClient

from routes import real_integrations


ROOT_DIR = Path(__file__).resolve().parents[2]
PYTHON_BIN = ROOT_DIR / ".venv311" / "bin" / "python"
VALIDATOR_PATH = (
    ROOT_DIR / "backend" / "scripts" / "validate_connector_governance_weekly_report.py"
)
SIGNOFF_VALIDATOR_PATH = (
    ROOT_DIR / "backend" / "scripts" / "validate_connector_signoff_bundle.py"
)


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
        self.integration_telemetry = _FakeCollection(seed_doc=telemetry_docs or [])
        self.integration_event_dedup = _FakeCollection(seed_doc={})
        self.prospects = _FakeCollection()
        self.company_research = _FakeCollection()
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


def test_governance_report_export_blocks_when_telemetry_evidence_is_missing(monkeypatch):
    fake_db = _FakeDb(telemetry_docs=[])
    client = _build_client(monkeypatch, fake_db)

    response = client.get(
        "/api/integrations/integrations/telemetry/governance-report/export?days=7&limit=500"
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ACTION_REQUIRED"
    assert payload["governanceExport"]["rolloutBlocked"] is True
    assert isinstance(payload.get("runtimePrereqs"), dict)
    assert isinstance(payload["governanceExport"].get("runtimePrereqs"), dict)
    assert payload["governanceExport"]["runtimePrereqs"] == payload["runtimePrereqs"]
    assert isinstance(payload["runtimePrereqs"].get("missingCheckCount"), int)
    assert isinstance((payload["runtimePrereqs"].get("missingChecks") or {}).get("commands", []), list)
    assert isinstance((payload["runtimePrereqs"].get("missingChecks") or {}).get("workspace", []), list)
    assert "npm run verify:governance:weekly" in payload["recommendedCommands"]
    assert len(fake_db.integration_telemetry.inserted) == 2
    assert (
        fake_db.integration_telemetry.inserted[1]["eventType"]
        == "integrations_traceability_governance_report_exported"
    )


def test_governance_weekly_report_validator_fails_on_invalid_artifact():
    with tempfile.TemporaryDirectory() as tmp:
        artifact_path = Path(tmp) / "invalid-governance-weekly-report.json"
        artifact_path.write_text(
            json.dumps({"generatedAt": "2026-02-23T00:00:00+00:00"}),
            encoding="utf-8",
        )
        result = subprocess.run(
            [
                str(PYTHON_BIN),
                str(VALIDATOR_PATH),
                "--artifact",
                str(artifact_path),
            ],
            cwd=ROOT_DIR,
            capture_output=True,
            text=True,
            check=False,
        )
        assert result.returncode == 1
        assert "validation failed" in (result.stdout + result.stderr).lower()


def test_release_gate_smoke_blocks_invalid_governance_handoff_attachment_payload():
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        evidence_path = tmp_path / "connector_canary_evidence.json"
        signoff_path = tmp_path / "connector_signoff.md"
        output_path = tmp_path / "connector_signoff_validation.json"

        evidence_payload = {
            "sloSummary": {
                "decision": "PROCEED",
                "signoff": {
                    "requiredEvidence": [
                        "connector_canary_evidence.json",
                        "telemetry_slo_gates_snapshot.json",
                        "integration_health_snapshot.json",
                        "connector_governance_weekly_report.json",
                        "governance_handoff_export.json",
                        "governance_history_export.json",
                        "governance_packet_validation.json",
                    ],
                    "requiredApprovals": [
                        {"role": "Release Manager", "required": True},
                        {"role": "Sales Ops Lead", "required": True},
                    ],
                },
            }
        }
        evidence_path.write_text(json.dumps(evidence_payload), encoding="utf-8")
        signoff_path.write_text(
            "\n".join(
                [
                    "- [x] Release Manager",
                    "- [x] Sales Ops Lead",
                    "- [ ] schemaCoverage.thresholdPct = 95.0",
                    "- [ ] schemaCoverage.observedPct = 100.0",
                    "- [ ] schemaCoverage.sampleCount = 30",
                    "- [ ] schemaCoverage.minSampleCount = 25",
                    "- [ ] gates.schemaCoveragePassed = True",
                    "- [ ] gates.schemaSampleSizePassed = True",
                    "- [ ] gates.orchestrationAttemptErrorPassed = True",
                    "- [ ] gates.orchestrationAttemptSkippedPassed = True",
                    "- [ ] orchestrationAudit.maxAttemptErrorCountThreshold = 5",
                    "- [ ] orchestrationAudit.observedAttemptErrorCount = 1",
                    "- [ ] orchestrationAudit.maxAttemptSkippedCountThreshold = 25",
                    "- [ ] orchestrationAudit.observedAttemptSkippedCount = 2",
                ]
            ),
            encoding="utf-8",
        )

        (tmp_path / "telemetry_slo_gates_snapshot.json").write_text("{}", encoding="utf-8")
        (tmp_path / "integration_health_snapshot.json").write_text("{}", encoding="utf-8")
        (tmp_path / "connector_governance_weekly_report.json").write_text(
            json.dumps(
                {
                    "generatedAt": "2026-02-23T00:00:00+00:00",
                    "summary": {"status": "READY"},
                }
            ),
            encoding="utf-8",
        )
        (tmp_path / "governance_handoff_export.json").write_text(
            json.dumps(
                {
                    "status": "READY",
                    "exportSchemaVersion": 1,
                    "reasonCodes": ["governance_ready"],
                    "reasonCodeCount": 1,
                    "recommendedCommands": ["npm run verify:ci:sales:extended"],
                    "recommendedCommandCount": 1,
                    "totals": {
                        "connectorRateLimitEventCount": 1,
                        "sendgridWebhookTimestampEventCount": 1,
                        "sendgridWebhookTimestampAnomalyCountTotal": 1,
                    },
                    "connectorRateLimit": {
                        "eventCount": 1,
                        "byEndpoint": {"apollo_search": 1},
                        "pressure": {"label": "Low"},
                    },
                    "sendgridWebhookTimestamp": {
                        "eventCount": 1,
                        "timestampAnomalyCountTotal": 1,
                        "pressureLabelCounts": {"moderate": 1},
                        "pressureHintCounts": {"monitor_rollout": 1},
                        "timestampAgeBucketCounts": {"fresh_1h_to_24h": 1},
                        "timestampAnomalyEventTypeCounts": {"delivered": 1},
                        "latestEventAt": "2026-02-24T00:00:00+00:00",
                    },
                    "governanceExport": "invalid-shape",
                }
            ),
            encoding="utf-8",
        )
        (tmp_path / "governance_history_export.json").write_text(
            json.dumps(
                {
                    "status": "READY",
                    "exportSchemaVersion": 1,
                    "reasonCodes": ["governance_ready"],
                    "reasonCodeCount": 1,
                    "recommendedCommands": ["npm run verify:ci:sales:extended"],
                    "recommendedCommandCount": 1,
                    "totals": {
                        "connectorRateLimitEventCount": 1,
                        "sendgridWebhookTimestampEventCount": 1,
                        "sendgridWebhookTimestampAnomalyCountTotal": 1,
                    },
                    "connectorRateLimit": {
                        "eventCount": 1,
                        "byEndpoint": {"apollo_search": 1},
                        "pressure": {"label": "Low"},
                    },
                    "sendgridWebhookTimestamp": {
                        "eventCount": 1,
                        "timestampAnomalyCountTotal": 1,
                        "pressureLabelCounts": {"moderate": 1},
                        "pressureHintCounts": {"monitor_rollout": 1},
                        "timestampAgeBucketCounts": {"fresh_1h_to_24h": 1},
                        "timestampAnomalyEventTypeCounts": {"delivered": 1},
                        "latestEventAt": "2026-02-24T00:00:00+00:00",
                    },
                    "connectorPressureParity": {
                        "topLevelEventCount": 1,
                        "nestedEventCount": 1,
                        "totalsEventCount": 1,
                        "eventCountMatchesNested": True,
                        "eventCountMatchesTotals": True,
                        "byEndpointMatchesNested": True,
                        "pressureLabelMatchesNested": True,
                        "normalizedTopLevelByEndpoint": {"apollo_search": 1},
                        "normalizedNestedByEndpoint": {"apollo_search": 1},
                        "computedAt": "2026-02-24T00:00:00+00:00",
                    },
                    "sendgridWebhookTimestampParity": {
                        "topLevelEventCount": 1,
                        "nestedEventCount": 1,
                        "totalsEventCount": 1,
                        "topLevelAnomalyCountTotal": 1,
                        "nestedAnomalyCountTotal": 1,
                        "totalsAnomalyCountTotal": 1,
                        "eventCountMatchesNested": True,
                        "eventCountMatchesTotals": True,
                        "anomalyCountTotalMatchesNested": True,
                        "anomalyCountTotalMatchesTotals": True,
                        "pressureLabelCountsMatchNested": True,
                        "pressureHintCountsMatchNested": True,
                        "ageBucketCountsMatchNested": True,
                        "anomalyEventTypeCountsMatchNested": True,
                        "latestEventAtMatchesNested": True,
                        "normalizedTopLevelPressureLabelCounts": {"moderate": 1},
                        "normalizedNestedPressureLabelCounts": {"moderate": 1},
                        "normalizedTopLevelPressureHintCounts": {"monitor_rollout": 1},
                        "normalizedNestedPressureHintCounts": {"monitor_rollout": 1},
                        "normalizedTopLevelAgeBucketCounts": {"fresh_1h_to_24h": 1},
                        "normalizedNestedAgeBucketCounts": {"fresh_1h_to_24h": 1},
                        "normalizedTopLevelAnomalyEventTypeCounts": {"delivered": 1},
                        "normalizedNestedAnomalyEventTypeCounts": {"delivered": 1},
                        "normalizedLatestEventAtTopLevel": "2026-02-24T00:00:00+00:00",
                        "normalizedLatestEventAtNested": "2026-02-24T00:00:00+00:00",
                        "computedAt": "2026-02-24T00:00:00+00:00",
                    },
                    "governanceExport": {
                        "status": "READY",
                        "exportSchemaVersion": 1,
                        "rolloutBlocked": False,
                        "reasonCodes": ["governance_ready"],
                        "reasonCodeCount": 1,
                        "recommendedCommands": ["npm run verify:ci:sales:extended"],
                        "recommendedCommandCount": 1,
                        "connectorRateLimit": {
                            "eventCount": 1,
                            "byEndpoint": {"apollo_search": 1},
                            "pressure": {"label": "Low"},
                        },
                        "sendgridWebhookTimestamp": {
                            "eventCount": 1,
                            "timestampAnomalyCountTotal": 1,
                            "pressureLabelCounts": {"moderate": 1},
                            "pressureHintCounts": {"monitor_rollout": 1},
                            "timestampAgeBucketCounts": {"fresh_1h_to_24h": 1},
                            "timestampAnomalyEventTypeCounts": {"delivered": 1},
                            "latestEventAt": "2026-02-24T00:00:00+00:00",
                        },
                    },
                    "items": [],
                }
            ),
            encoding="utf-8",
        )
        (tmp_path / "governance_packet_validation.json").write_text(
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

        result = subprocess.run(
            [
                str(PYTHON_BIN),
                str(SIGNOFF_VALIDATOR_PATH),
                "--evidence",
                str(evidence_path),
                "--signoff",
                str(signoff_path),
                "--artifacts-dir",
                str(tmp_path),
                "--output",
                str(output_path),
            ],
            cwd=ROOT_DIR,
            capture_output=True,
            text=True,
            check=False,
        )

        assert result.returncode == 1
        assert "governance handoff evidence is missing governanceexport payload" in (
            result.stdout + result.stderr
        ).lower()


def test_release_gate_smoke_blocks_stale_governance_packet_validation_artifact():
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        evidence_path = tmp_path / "connector_canary_evidence.json"
        signoff_path = tmp_path / "connector_signoff.md"
        output_path = tmp_path / "connector_signoff_validation.json"

        evidence_payload = {
            "sloSummary": {
                "decision": "PROCEED",
                "signoff": {
                    "requiredEvidence": [
                        "connector_canary_evidence.json",
                        "telemetry_slo_gates_snapshot.json",
                        "integration_health_snapshot.json",
                        "connector_governance_weekly_report.json",
                        "governance_handoff_export.json",
                        "governance_history_export.json",
                        "governance_packet_validation.json",
                    ],
                    "requiredApprovals": [
                        {"role": "Release Manager", "required": True},
                        {"role": "Sales Ops Lead", "required": True},
                    ],
                },
            }
        }
        evidence_path.write_text(json.dumps(evidence_payload), encoding="utf-8")
        signoff_path.write_text(
            "\n".join(
                [
                    "- [x] Release Manager",
                    "- [x] Sales Ops Lead",
                    "- [ ] schemaCoverage.thresholdPct = 95.0",
                    "- [ ] schemaCoverage.observedPct = 100.0",
                    "- [ ] schemaCoverage.sampleCount = 30",
                    "- [ ] schemaCoverage.minSampleCount = 25",
                    "- [ ] gates.schemaCoveragePassed = True",
                    "- [ ] gates.schemaSampleSizePassed = True",
                    "- [ ] gates.orchestrationAttemptErrorPassed = True",
                    "- [ ] gates.orchestrationAttemptSkippedPassed = True",
                    "- [ ] orchestrationAudit.maxAttemptErrorCountThreshold = 5",
                    "- [ ] orchestrationAudit.observedAttemptErrorCount = 1",
                    "- [ ] orchestrationAudit.maxAttemptSkippedCountThreshold = 25",
                    "- [ ] orchestrationAudit.observedAttemptSkippedCount = 2",
                ]
            ),
            encoding="utf-8",
        )

        (tmp_path / "telemetry_slo_gates_snapshot.json").write_text("{}", encoding="utf-8")
        (tmp_path / "integration_health_snapshot.json").write_text("{}", encoding="utf-8")
        (tmp_path / "connector_governance_weekly_report.json").write_text(
            json.dumps(
                {
                    "generatedAt": datetime.now(timezone.utc).isoformat(),
                    "summary": {"status": "READY"},
                }
            ),
            encoding="utf-8",
        )
        (tmp_path / "governance_handoff_export.json").write_text(
            json.dumps(
                {
                    "status": "READY",
                    "exportSchemaVersion": 1,
                    "reasonCodes": ["governance_ready"],
                    "reasonCodeCount": 1,
                    "recommendedCommands": ["npm run verify:ci:sales:extended"],
                    "recommendedCommandCount": 1,
                    "totals": {
                        "connectorRateLimitEventCount": 1,
                        "sendgridWebhookTimestampEventCount": 1,
                        "sendgridWebhookTimestampAnomalyCountTotal": 1,
                    },
                    "connectorRateLimit": {
                        "eventCount": 1,
                        "byEndpoint": {"apollo_search": 1},
                        "pressure": {"label": "Low"},
                    },
                    "sendgridWebhookTimestamp": {
                        "eventCount": 1,
                        "timestampAnomalyCountTotal": 1,
                        "pressureLabelCounts": {"moderate": 1},
                        "pressureHintCounts": {"monitor_rollout": 1},
                        "timestampAgeBucketCounts": {"fresh_1h_to_24h": 1},
                        "timestampAnomalyEventTypeCounts": {"delivered": 1},
                        "latestEventAt": "2026-02-24T00:00:00+00:00",
                    },
                    "connectorPressureParity": {
                        "topLevelEventCount": 1,
                        "nestedEventCount": 1,
                        "totalsEventCount": 1,
                        "eventCountMatchesNested": True,
                        "eventCountMatchesTotals": True,
                        "byEndpointMatchesNested": True,
                        "pressureLabelMatchesNested": True,
                        "normalizedTopLevelByEndpoint": {"apollo_search": 1},
                        "normalizedNestedByEndpoint": {"apollo_search": 1},
                        "computedAt": "2026-02-24T00:00:00+00:00",
                    },
                    "sendgridWebhookTimestampParity": {
                        "topLevelEventCount": 1,
                        "nestedEventCount": 1,
                        "totalsEventCount": 1,
                        "topLevelAnomalyCountTotal": 1,
                        "nestedAnomalyCountTotal": 1,
                        "totalsAnomalyCountTotal": 1,
                        "eventCountMatchesNested": True,
                        "eventCountMatchesTotals": True,
                        "anomalyCountTotalMatchesNested": True,
                        "anomalyCountTotalMatchesTotals": True,
                        "pressureLabelCountsMatchNested": True,
                        "pressureHintCountsMatchNested": True,
                        "ageBucketCountsMatchNested": True,
                        "anomalyEventTypeCountsMatchNested": True,
                        "latestEventAtMatchesNested": True,
                        "normalizedTopLevelPressureLabelCounts": {"moderate": 1},
                        "normalizedNestedPressureLabelCounts": {"moderate": 1},
                        "normalizedTopLevelPressureHintCounts": {"monitor_rollout": 1},
                        "normalizedNestedPressureHintCounts": {"monitor_rollout": 1},
                        "normalizedTopLevelAgeBucketCounts": {"fresh_1h_to_24h": 1},
                        "normalizedNestedAgeBucketCounts": {"fresh_1h_to_24h": 1},
                        "normalizedTopLevelAnomalyEventTypeCounts": {"delivered": 1},
                        "normalizedNestedAnomalyEventTypeCounts": {"delivered": 1},
                        "normalizedLatestEventAtTopLevel": "2026-02-24T00:00:00+00:00",
                        "normalizedLatestEventAtNested": "2026-02-24T00:00:00+00:00",
                        "computedAt": "2026-02-24T00:00:00+00:00",
                    },
                    "governanceExport": {
                        "status": "READY",
                        "exportSchemaVersion": 1,
                        "rolloutBlocked": False,
                        "reasonCodes": ["governance_ready"],
                        "reasonCodeCount": 1,
                        "recommendedCommands": ["npm run verify:ci:sales:extended"],
                        "recommendedCommandCount": 1,
                        "connectorRateLimit": {
                            "eventCount": 1,
                            "byEndpoint": {"apollo_search": 1},
                            "pressure": {"label": "Low"},
                        },
                        "sendgridWebhookTimestamp": {
                            "eventCount": 1,
                            "timestampAnomalyCountTotal": 1,
                            "pressureLabelCounts": {"moderate": 1},
                            "pressureHintCounts": {"monitor_rollout": 1},
                            "timestampAgeBucketCounts": {"fresh_1h_to_24h": 1},
                            "timestampAnomalyEventTypeCounts": {"delivered": 1},
                            "latestEventAt": "2026-02-24T00:00:00+00:00",
                        },
                    },
                }
            ),
            encoding="utf-8",
        )
        (tmp_path / "governance_history_export.json").write_text(
            json.dumps(
                {
                    "status": "READY",
                    "exportSchemaVersion": 1,
                    "reasonCodes": ["governance_ready"],
                    "reasonCodeCount": 1,
                    "recommendedCommands": ["npm run verify:ci:sales:extended"],
                    "recommendedCommandCount": 1,
                    "totals": {"connectorRateLimitEventCount": 1},
                    "connectorRateLimit": {
                        "eventCount": 1,
                        "byEndpoint": {"apollo_search": 1},
                        "pressure": {"label": "Low"},
                    },
                    "connectorPressureParity": {
                        "topLevelEventCount": 1,
                        "nestedEventCount": 1,
                        "totalsEventCount": 5,
                        "eventCountMatchesNested": True,
                        "eventCountMatchesTotals": False,
                        "byEndpointMatchesNested": True,
                        "pressureLabelMatchesNested": True,
                        "normalizedTopLevelByEndpoint": {"apollo_search": 1},
                        "normalizedNestedByEndpoint": {"apollo_search": 1},
                        "computedAt": "2026-02-24T00:00:00+00:00",
                    },
                    "governanceExport": {
                        "status": "READY",
                        "exportSchemaVersion": 1,
                        "rolloutBlocked": False,
                        "reasonCodes": ["governance_ready"],
                        "reasonCodeCount": 1,
                        "recommendedCommands": ["npm run verify:ci:sales:extended"],
                        "recommendedCommandCount": 1,
                        "connectorRateLimit": {
                            "eventCount": 1,
                            "byEndpoint": {"apollo_search": 1},
                            "pressure": {"label": "Low"},
                        },
                    },
                    "items": [],
                }
            ),
            encoding="utf-8",
        )
        (tmp_path / "governance_packet_validation.json").write_text(
            json.dumps(
                {
                    "validatedAt": (
                        datetime.now(timezone.utc) - timedelta(days=14)
                    ).isoformat(),
                    "checks": {},
                    "errors": [],
                    "valid": True,
                }
            ),
            encoding="utf-8",
        )

        result = subprocess.run(
            [
                str(PYTHON_BIN),
                str(SIGNOFF_VALIDATOR_PATH),
                "--evidence",
                str(evidence_path),
                "--signoff",
                str(signoff_path),
                "--artifacts-dir",
                str(tmp_path),
                "--output",
                str(output_path),
            ],
            cwd=ROOT_DIR,
            capture_output=True,
            text=True,
            check=False,
        )

        assert result.returncode == 1
        assert "governance packet validation artifact is stale" in (
            result.stdout + result.stderr
        ).lower()


def test_release_gate_smoke_blocks_governance_connector_rate_limit_totals_parity_drift():
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        evidence_path = tmp_path / "connector_canary_evidence.json"
        signoff_path = tmp_path / "connector_signoff.md"
        output_path = tmp_path / "connector_signoff_validation.json"

        evidence_payload = {
            "sloSummary": {
                "decision": "PROCEED",
                "signoff": {
                    "requiredEvidence": [
                        "connector_canary_evidence.json",
                        "telemetry_slo_gates_snapshot.json",
                        "integration_health_snapshot.json",
                        "connector_governance_weekly_report.json",
                        "governance_handoff_export.json",
                        "governance_history_export.json",
                        "governance_packet_validation.json",
                    ],
                    "requiredApprovals": [
                        {"role": "Release Manager", "required": True},
                        {"role": "Sales Ops Lead", "required": True},
                    ],
                },
            }
        }
        evidence_path.write_text(json.dumps(evidence_payload), encoding="utf-8")
        signoff_path.write_text(
            "\n".join(
                [
                    "- [x] Release Manager",
                    "- [x] Sales Ops Lead",
                    "- [ ] schemaCoverage.thresholdPct = 95.0",
                    "- [ ] schemaCoverage.observedPct = 100.0",
                    "- [ ] schemaCoverage.sampleCount = 30",
                    "- [ ] schemaCoverage.minSampleCount = 25",
                    "- [ ] gates.schemaCoveragePassed = True",
                    "- [ ] gates.schemaSampleSizePassed = True",
                    "- [ ] gates.orchestrationAttemptErrorPassed = True",
                    "- [ ] gates.orchestrationAttemptSkippedPassed = True",
                    "- [ ] orchestrationAudit.maxAttemptErrorCountThreshold = 5",
                    "- [ ] orchestrationAudit.observedAttemptErrorCount = 1",
                    "- [ ] orchestrationAudit.maxAttemptSkippedCountThreshold = 25",
                    "- [ ] orchestrationAudit.observedAttemptSkippedCount = 2",
                ]
            ),
            encoding="utf-8",
        )

        (tmp_path / "telemetry_slo_gates_snapshot.json").write_text("{}", encoding="utf-8")
        (tmp_path / "integration_health_snapshot.json").write_text("{}", encoding="utf-8")
        (tmp_path / "connector_governance_weekly_report.json").write_text(
            json.dumps(
                {
                    "generatedAt": datetime.now(timezone.utc).isoformat(),
                    "summary": {"status": "READY"},
                }
            ),
            encoding="utf-8",
        )
        (tmp_path / "governance_handoff_export.json").write_text(
            json.dumps(
                {
                    "status": "READY",
                    "exportSchemaVersion": 1,
                    "reasonCodes": ["governance_ready"],
                    "reasonCodeCount": 1,
                    "recommendedCommands": ["npm run verify:ci:sales:extended"],
                    "recommendedCommandCount": 1,
                    "totals": {"connectorRateLimitEventCount": 5},
                    "connectorRateLimit": {
                        "eventCount": 1,
                        "byEndpoint": {"apollo_search": 1},
                        "pressure": {"label": "Low"},
                    },
                    "connectorPressureParity": {
                        "topLevelEventCount": 1,
                        "nestedEventCount": 1,
                        "totalsEventCount": 1,
                        "eventCountMatchesNested": True,
                        "eventCountMatchesTotals": True,
                        "byEndpointMatchesNested": True,
                        "pressureLabelMatchesNested": True,
                        "normalizedTopLevelByEndpoint": {"apollo_search": 1},
                        "normalizedNestedByEndpoint": {"apollo_search": 1},
                        "computedAt": "2026-02-24T00:00:00+00:00",
                    },
                    "governanceExport": {
                        "status": "READY",
                        "exportSchemaVersion": 1,
                        "rolloutBlocked": False,
                        "reasonCodes": ["governance_ready"],
                        "reasonCodeCount": 1,
                        "recommendedCommands": ["npm run verify:ci:sales:extended"],
                        "recommendedCommandCount": 1,
                        "connectorRateLimit": {
                            "eventCount": 1,
                            "byEndpoint": {"apollo_search": 1},
                            "pressure": {"label": "Low"},
                        },
                    },
                }
            ),
            encoding="utf-8",
        )
        (tmp_path / "governance_history_export.json").write_text(
            json.dumps(
                {
                    "status": "READY",
                    "exportSchemaVersion": 1,
                    "reasonCodes": ["governance_ready"],
                    "reasonCodeCount": 1,
                    "recommendedCommands": ["npm run verify:ci:sales:extended"],
                    "recommendedCommandCount": 1,
                    "totals": {"connectorRateLimitEventCount": 1},
                    "connectorRateLimit": {
                        "eventCount": 1,
                        "byEndpoint": {"apollo_search": 1},
                        "pressure": {"label": "Low"},
                    },
                    "governanceExport": {
                        "status": "READY",
                        "exportSchemaVersion": 1,
                        "rolloutBlocked": False,
                        "reasonCodes": ["governance_ready"],
                        "reasonCodeCount": 1,
                        "recommendedCommands": ["npm run verify:ci:sales:extended"],
                        "recommendedCommandCount": 1,
                        "connectorRateLimit": {
                            "eventCount": 1,
                            "byEndpoint": {"apollo_search": 1},
                            "pressure": {"label": "Low"},
                        },
                    },
                    "items": [],
                }
            ),
            encoding="utf-8",
        )
        (tmp_path / "governance_packet_validation.json").write_text(
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

        result = subprocess.run(
            [
                str(PYTHON_BIN),
                str(SIGNOFF_VALIDATOR_PATH),
                "--evidence",
                str(evidence_path),
                "--signoff",
                str(signoff_path),
                "--artifacts-dir",
                str(tmp_path),
                "--output",
                str(output_path),
            ],
            cwd=ROOT_DIR,
            capture_output=True,
            text=True,
            check=False,
        )

        assert result.returncode == 1
        assert "totals.connectorratelimiteventcount must match connectorratelimit.eventcount" in (
            result.stdout + result.stderr
        ).lower()


def test_release_gate_smoke_blocks_governance_connector_pressure_parity_flag_drift():
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        evidence_path = tmp_path / "connector_canary_evidence.json"
        signoff_path = tmp_path / "connector_signoff.md"
        output_path = tmp_path / "connector_signoff_validation.json"

        evidence_payload = {
            "sloSummary": {
                "decision": "PROCEED",
                "signoff": {
                    "requiredEvidence": [
                        "connector_canary_evidence.json",
                        "telemetry_slo_gates_snapshot.json",
                        "integration_health_snapshot.json",
                        "connector_governance_weekly_report.json",
                        "governance_handoff_export.json",
                        "governance_history_export.json",
                        "governance_packet_validation.json",
                    ],
                    "requiredApprovals": [
                        {"role": "Release Manager", "required": True},
                        {"role": "Sales Ops Lead", "required": True},
                    ],
                },
            }
        }
        evidence_path.write_text(json.dumps(evidence_payload), encoding="utf-8")
        signoff_path.write_text(
            "\n".join(
                [
                    "- [x] Release Manager",
                    "- [x] Sales Ops Lead",
                    "- [ ] schemaCoverage.thresholdPct = 95.0",
                    "- [ ] schemaCoverage.observedPct = 100.0",
                    "- [ ] schemaCoverage.sampleCount = 30",
                    "- [ ] schemaCoverage.minSampleCount = 25",
                    "- [ ] gates.schemaCoveragePassed = True",
                    "- [ ] gates.schemaSampleSizePassed = True",
                    "- [ ] gates.orchestrationAttemptErrorPassed = True",
                    "- [ ] gates.orchestrationAttemptSkippedPassed = True",
                    "- [ ] orchestrationAudit.maxAttemptErrorCountThreshold = 5",
                    "- [ ] orchestrationAudit.observedAttemptErrorCount = 1",
                    "- [ ] orchestrationAudit.maxAttemptSkippedCountThreshold = 25",
                    "- [ ] orchestrationAudit.observedAttemptSkippedCount = 2",
                ]
            ),
            encoding="utf-8",
        )
        (tmp_path / "telemetry_slo_gates_snapshot.json").write_text("{}", encoding="utf-8")
        (tmp_path / "integration_health_snapshot.json").write_text("{}", encoding="utf-8")
        (tmp_path / "connector_governance_weekly_report.json").write_text(
            json.dumps(
                {
                    "generatedAt": datetime.now(timezone.utc).isoformat(),
                    "summary": {"status": "READY"},
                }
            ),
            encoding="utf-8",
        )
        (tmp_path / "governance_handoff_export.json").write_text(
            json.dumps(
                {
                    "status": "READY",
                    "exportSchemaVersion": 1,
                    "reasonCodes": ["governance_ready"],
                    "reasonCodeCount": 1,
                    "recommendedCommands": ["npm run verify:ci:sales:extended"],
                    "recommendedCommandCount": 1,
                    "totals": {
                        "connectorRateLimitEventCount": 1,
                        "sendgridWebhookTimestampEventCount": 1,
                        "sendgridWebhookTimestampAnomalyCountTotal": 1,
                    },
                    "connectorRateLimit": {
                        "eventCount": 1,
                        "byEndpoint": {"apollo_search": 1},
                        "pressure": {"label": "Low"},
                    },
                    "sendgridWebhookTimestamp": {
                        "eventCount": 1,
                        "timestampAnomalyCountTotal": 1,
                        "pressureLabelCounts": {"moderate": 1},
                        "pressureHintCounts": {"monitor_rollout": 1},
                        "timestampAgeBucketCounts": {"fresh_1h_to_24h": 1},
                        "timestampAnomalyEventTypeCounts": {"delivered": 1},
                        "latestEventAt": "2026-02-24T00:00:00+00:00",
                    },
                    "connectorPressureParity": {
                        "topLevelEventCount": 1,
                        "nestedEventCount": 1,
                        "totalsEventCount": 1,
                        "eventCountMatchesNested": False,
                        "eventCountMatchesTotals": True,
                        "byEndpointMatchesNested": True,
                        "pressureLabelMatchesNested": True,
                        "normalizedTopLevelByEndpoint": {"apollo_search": 1},
                        "normalizedNestedByEndpoint": {"apollo_search": 1},
                        "computedAt": "2026-02-24T00:00:00+00:00",
                    },
                    "sendgridWebhookTimestampParity": {
                        "topLevelEventCount": 1,
                        "nestedEventCount": 1,
                        "totalsEventCount": 1,
                        "topLevelAnomalyCountTotal": 1,
                        "nestedAnomalyCountTotal": 1,
                        "totalsAnomalyCountTotal": 1,
                        "eventCountMatchesNested": True,
                        "eventCountMatchesTotals": True,
                        "anomalyCountTotalMatchesNested": True,
                        "anomalyCountTotalMatchesTotals": True,
                        "pressureLabelCountsMatchNested": True,
                        "pressureHintCountsMatchNested": True,
                        "ageBucketCountsMatchNested": True,
                        "anomalyEventTypeCountsMatchNested": True,
                        "latestEventAtMatchesNested": True,
                        "normalizedTopLevelPressureLabelCounts": {"moderate": 1},
                        "normalizedNestedPressureLabelCounts": {"moderate": 1},
                        "normalizedTopLevelPressureHintCounts": {"monitor_rollout": 1},
                        "normalizedNestedPressureHintCounts": {"monitor_rollout": 1},
                        "normalizedTopLevelAgeBucketCounts": {"fresh_1h_to_24h": 1},
                        "normalizedNestedAgeBucketCounts": {"fresh_1h_to_24h": 1},
                        "normalizedTopLevelAnomalyEventTypeCounts": {"delivered": 1},
                        "normalizedNestedAnomalyEventTypeCounts": {"delivered": 1},
                        "normalizedLatestEventAtTopLevel": "2026-02-24T00:00:00+00:00",
                        "normalizedLatestEventAtNested": "2026-02-24T00:00:00+00:00",
                        "computedAt": "2026-02-24T00:00:00+00:00",
                    },
                    "governanceExport": {
                        "status": "READY",
                        "exportSchemaVersion": 1,
                        "rolloutBlocked": False,
                        "reasonCodes": ["governance_ready"],
                        "reasonCodeCount": 1,
                        "recommendedCommands": ["npm run verify:ci:sales:extended"],
                        "recommendedCommandCount": 1,
                        "connectorRateLimit": {
                            "eventCount": 1,
                            "byEndpoint": {"apollo_search": 1},
                            "pressure": {"label": "Low"},
                        },
                    },
                }
            ),
            encoding="utf-8",
        )
        (tmp_path / "governance_history_export.json").write_text(
            json.dumps(
                {
                    "status": "READY",
                    "exportSchemaVersion": 1,
                    "reasonCodes": ["governance_ready"],
                    "reasonCodeCount": 1,
                    "recommendedCommands": ["npm run verify:ci:sales:extended"],
                    "recommendedCommandCount": 1,
                    "totals": {"connectorRateLimitEventCount": 1},
                    "connectorRateLimit": {
                        "eventCount": 1,
                        "byEndpoint": {"apollo_search": 1},
                        "pressure": {"label": "Low"},
                    },
                    "connectorPressureParity": {
                        "topLevelEventCount": 1,
                        "nestedEventCount": 1,
                        "totalsEventCount": 1,
                        "eventCountMatchesNested": True,
                        "eventCountMatchesTotals": True,
                        "byEndpointMatchesNested": True,
                        "pressureLabelMatchesNested": True,
                        "normalizedTopLevelByEndpoint": {"apollo_search": 1},
                        "normalizedNestedByEndpoint": {"apollo_search": 1},
                        "computedAt": "2026-02-24T00:00:00+00:00",
                    },
                    "governanceExport": {
                        "status": "READY",
                        "exportSchemaVersion": 1,
                        "rolloutBlocked": False,
                        "reasonCodes": ["governance_ready"],
                        "reasonCodeCount": 1,
                        "recommendedCommands": ["npm run verify:ci:sales:extended"],
                        "recommendedCommandCount": 1,
                        "connectorRateLimit": {
                            "eventCount": 1,
                            "byEndpoint": {"apollo_search": 1},
                            "pressure": {"label": "Low"},
                        },
                        "sendgridWebhookTimestamp": {
                            "eventCount": 1,
                            "timestampAnomalyCountTotal": 1,
                            "pressureLabelCounts": {"moderate": 1},
                            "pressureHintCounts": {"monitor_rollout": 1},
                            "timestampAgeBucketCounts": {"fresh_1h_to_24h": 1},
                            "timestampAnomalyEventTypeCounts": {"delivered": 1},
                            "latestEventAt": "2026-02-24T00:00:00+00:00",
                        },
                    },
                    "items": [],
                }
            ),
            encoding="utf-8",
        )
        (tmp_path / "governance_packet_validation.json").write_text(
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

        result = subprocess.run(
            [
                str(PYTHON_BIN),
                str(SIGNOFF_VALIDATOR_PATH),
                "--evidence",
                str(evidence_path),
                "--signoff",
                str(signoff_path),
                "--artifacts-dir",
                str(tmp_path),
                "--output",
                str(output_path),
            ],
            cwd=ROOT_DIR,
            capture_output=True,
            text=True,
            check=False,
        )

        assert result.returncode == 1
        assert "connectorpressureparity fields are inconsistent" in (
            result.stdout + result.stderr
        ).lower()


def test_release_gate_smoke_blocks_governance_reason_count_parity_drift():
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        evidence_path = tmp_path / "connector_canary_evidence.json"
        signoff_path = tmp_path / "connector_signoff.md"
        output_path = tmp_path / "connector_signoff_validation.json"

        evidence_payload = {
            "sloSummary": {
                "decision": "PROCEED",
                "signoff": {
                    "requiredEvidence": [
                        "connector_canary_evidence.json",
                        "telemetry_slo_gates_snapshot.json",
                        "integration_health_snapshot.json",
                        "connector_governance_weekly_report.json",
                        "governance_handoff_export.json",
                        "governance_history_export.json",
                        "governance_packet_validation.json",
                    ],
                    "requiredApprovals": [
                        {"role": "Release Manager", "required": True},
                        {"role": "Sales Ops Lead", "required": True},
                    ],
                },
            }
        }
        evidence_path.write_text(json.dumps(evidence_payload), encoding="utf-8")
        signoff_path.write_text(
            "\n".join(
                [
                    "- [x] Release Manager",
                    "- [x] Sales Ops Lead",
                    "- [ ] schemaCoverage.thresholdPct = 95.0",
                    "- [ ] schemaCoverage.observedPct = 100.0",
                    "- [ ] schemaCoverage.sampleCount = 30",
                    "- [ ] schemaCoverage.minSampleCount = 25",
                    "- [ ] gates.schemaCoveragePassed = True",
                    "- [ ] gates.schemaSampleSizePassed = True",
                    "- [ ] gates.orchestrationAttemptErrorPassed = True",
                    "- [ ] gates.orchestrationAttemptSkippedPassed = True",
                    "- [ ] orchestrationAudit.maxAttemptErrorCountThreshold = 5",
                    "- [ ] orchestrationAudit.observedAttemptErrorCount = 1",
                    "- [ ] orchestrationAudit.maxAttemptSkippedCountThreshold = 25",
                    "- [ ] orchestrationAudit.observedAttemptSkippedCount = 2",
                ]
            ),
            encoding="utf-8",
        )
        (tmp_path / "telemetry_slo_gates_snapshot.json").write_text("{}", encoding="utf-8")
        (tmp_path / "integration_health_snapshot.json").write_text("{}", encoding="utf-8")
        (tmp_path / "connector_governance_weekly_report.json").write_text(
            json.dumps(
                {
                    "generatedAt": datetime.now(timezone.utc).isoformat(),
                    "summary": {"status": "READY"},
                }
            ),
            encoding="utf-8",
        )
        (tmp_path / "governance_handoff_export.json").write_text(
            json.dumps(
                {
                    "status": "READY",
                    "exportSchemaVersion": 1,
                    "reasonCodes": ["governance_ready"],
                    "reasonCodeCount": 2,
                    "recommendedCommands": ["npm run verify:ci:sales:extended"],
                    "recommendedCommandCount": 1,
                    "totals": {"connectorRateLimitEventCount": 1},
                    "connectorRateLimit": {
                        "eventCount": 1,
                        "byEndpoint": {"apollo_search": 1},
                        "pressure": {"label": "Low"},
                    },
                    "connectorPressureParity": {
                        "topLevelEventCount": 1,
                        "nestedEventCount": 1,
                        "totalsEventCount": 1,
                        "eventCountMatchesNested": True,
                        "eventCountMatchesTotals": True,
                        "byEndpointMatchesNested": True,
                        "pressureLabelMatchesNested": True,
                        "normalizedTopLevelByEndpoint": {"apollo_search": 1},
                        "normalizedNestedByEndpoint": {"apollo_search": 1},
                        "computedAt": "2026-02-24T00:00:00+00:00",
                    },
                    "governanceExport": {
                        "status": "READY",
                        "exportSchemaVersion": 1,
                        "rolloutBlocked": False,
                        "reasonCodes": ["governance_ready"],
                        "reasonCodeCount": 1,
                        "recommendedCommands": ["npm run verify:ci:sales:extended"],
                        "recommendedCommandCount": 1,
                        "connectorRateLimit": {
                            "eventCount": 1,
                            "byEndpoint": {"apollo_search": 1},
                            "pressure": {"label": "Low"},
                        },
                    },
                }
            ),
            encoding="utf-8",
        )
        (tmp_path / "governance_history_export.json").write_text(
            json.dumps(
                {
                    "status": "READY",
                    "exportSchemaVersion": 1,
                    "reasonCodes": ["governance_ready"],
                    "reasonCodeCount": 1,
                    "recommendedCommands": ["npm run verify:ci:sales:extended"],
                    "recommendedCommandCount": 1,
                    "totals": {"connectorRateLimitEventCount": 1},
                    "connectorRateLimit": {
                        "eventCount": 1,
                        "byEndpoint": {"apollo_search": 1},
                        "pressure": {"label": "Low"},
                    },
                    "connectorPressureParity": {
                        "topLevelEventCount": 1,
                        "nestedEventCount": 1,
                        "totalsEventCount": 1,
                        "eventCountMatchesNested": True,
                        "eventCountMatchesTotals": True,
                        "byEndpointMatchesNested": True,
                        "pressureLabelMatchesNested": True,
                        "normalizedTopLevelByEndpoint": {"apollo_search": 1},
                        "normalizedNestedByEndpoint": {"apollo_search": 1},
                        "computedAt": "2026-02-24T00:00:00+00:00",
                    },
                    "governanceExport": {
                        "status": "READY",
                        "exportSchemaVersion": 1,
                        "rolloutBlocked": False,
                        "reasonCodes": ["governance_ready"],
                        "reasonCodeCount": 1,
                        "recommendedCommands": ["npm run verify:ci:sales:extended"],
                        "recommendedCommandCount": 1,
                        "connectorRateLimit": {
                            "eventCount": 1,
                            "byEndpoint": {"apollo_search": 1},
                            "pressure": {"label": "Low"},
                        },
                    },
                    "items": [],
                }
            ),
            encoding="utf-8",
        )
        (tmp_path / "governance_packet_validation.json").write_text(
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

        result = subprocess.run(
            [
                str(PYTHON_BIN),
                str(SIGNOFF_VALIDATOR_PATH),
                "--evidence",
                str(evidence_path),
                "--signoff",
                str(signoff_path),
                "--artifacts-dir",
                str(tmp_path),
                "--output",
                str(output_path),
            ],
            cwd=ROOT_DIR,
            capture_output=True,
            text=True,
            check=False,
        )

        assert result.returncode == 1
        assert "reasoncodecount must match len(reasoncodes)" in (
            result.stdout + result.stderr
        ).lower()
