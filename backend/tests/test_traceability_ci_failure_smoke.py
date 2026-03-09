import json
from pathlib import Path
import subprocess
import tempfile


ROOT_DIR = Path(__file__).resolve().parents[2]
PACKAGE_JSON_PATH = ROOT_DIR / "package.json"
VALIDATOR_PATH = ROOT_DIR / "backend" / "scripts" / "validate_connector_telemetry_snapshot.py"
BACKFILL_ARTIFACT_VALIDATOR_PATH = (
    ROOT_DIR
    / "backend"
    / "scripts"
    / "validate_integration_telemetry_event_root_backfill_artifacts.py"
)
RUNTIME_PREREQS_ARTIFACT_VALIDATOR_PATH = (
    ROOT_DIR
    / "backend"
    / "scripts"
    / "validate_sales_runtime_prereqs_artifact.py"
)
GOVERNANCE_PACKET_FIXTURE_GENERATOR_PATH = (
    ROOT_DIR / "backend" / "scripts" / "generate_governance_packet_fixture.py"
)
GOVERNANCE_PACKET_VALIDATOR_PATH = (
    ROOT_DIR / "backend" / "scripts" / "validate_governance_packet_artifacts.py"
)
PYTHON_BIN = ROOT_DIR / ".venv311" / "bin" / "python"


def _scripts():
    payload = json.loads(PACKAGE_JSON_PATH.read_text(encoding="utf-8"))
    return payload.get("scripts", {})


def test_extended_ci_chain_includes_traceability_verification_gate():
    scripts = _scripts()
    extended = scripts.get("verify:ci:sales:extended", "")
    weekly = scripts.get("verify:governance:weekly", "")
    assert "npm run verify:smoke:frontend-sales" in extended
    assert "npm run verify:smoke:sales-dashboard" in extended
    assert "npm run verify:smoke:multi-channel-controls" in extended
    assert "npm run verify:smoke:baseline-command-aliases" in extended
    assert "npm run verify:baseline:command-aliases:artifact:fixtures" in extended
    assert "npm run verify:smoke:baseline-command-aliases-artifact" in extended
    assert "npm run verify:baseline:runtime-prereqs:artifact:fixtures" in extended
    assert "npm run verify:smoke:runtime-prereqs-artifact" in extended
    assert "npm run verify:baseline:metrics:artifact:fixtures" in extended
    assert "npm run verify:smoke:baseline-metrics-artifact" in extended
    assert "npm run verify:smoke:connector-reliability" in extended
    assert "npm run verify:smoke:telemetry-quality" in extended
    assert "npm run verify:telemetry:traceability" in extended
    assert "npm run verify:telemetry:traceability:cleanup:policy" in extended
    assert "npm run verify:governance:weekly" in extended
    assert "npm run verify:governance:schema:preflight" in weekly
    assert "npm run verify:smoke:governance-report" in extended
    assert "npm run verify:smoke:governance-export-guard" in extended
    assert "npm run verify:smoke:governance-history-retention" in extended
    assert "npm run verify:smoke:governance-packet" in extended
    assert "npm run verify:smoke:governance-connector-pressure" in extended
    assert "npm run verify:smoke:governance-duplicate-artifact-remediation" in extended
    assert "npm run verify:smoke:governance-schema-endpoint" in extended
    assert "npm run verify:smoke:governance-schema-ui" in extended
    assert "npm run verify:smoke:telemetry-packet-filter" in extended
    assert "npm run verify:smoke:telemetry-event-root-backfill" in extended
    assert "npm run verify:smoke:telemetry-event-root-backfill-artifact-cleanup" in extended
    assert "npm run verify:smoke:traceability-governance-handoff" in extended
    assert "npm run verify:smoke:baseline-orchestration-remediation" in extended
    assert "npm run verify:smoke:baseline-governance-drift" in extended
    assert "npm run verify:smoke:workflow-contracts" in extended


def test_traceability_contract_command_fails_on_invalid_snapshot():
    with tempfile.TemporaryDirectory() as tmp:
        snapshot_path = Path(tmp) / "invalid-snapshot.json"
        snapshot_path.write_text(json.dumps({"eventCount": 1}), encoding="utf-8")
        result = subprocess.run(
            [
                str(PYTHON_BIN),
                str(VALIDATOR_PATH),
                "--snapshot",
                str(snapshot_path),
            ],
            cwd=ROOT_DIR,
            capture_output=True,
            text=True,
            check=False,
        )
        assert result.returncode == 1
        assert "validation failed" in (result.stdout + result.stderr).lower()


def test_traceability_contract_command_fails_when_packet_validation_audit_is_missing():
    with tempfile.TemporaryDirectory() as tmp:
        snapshot_path = Path(tmp) / "invalid-packet-validation-snapshot.json"
        snapshot_path.write_text(
            json.dumps(
                {
                    "generatedAt": "2026-02-22T00:00:00+00:00",
                    "eventCount": 1,
                    "byProvider": {"integrations": 1},
                    "byEventType": {"integrations_traceability_status_evaluated": 1},
                    "traceabilityAudit": {
                        "eventCount": 1,
                        "decisionCounts": {"HOLD": 1},
                        "readyCount": 0,
                        "notReadyCount": 1,
                    },
                    "governanceAudit": {
                        "eventCount": 0,
                        "snapshotEvaluationCount": 0,
                        "baselineEvaluationCount": 0,
                        "statusCounts": {},
                    },
                    "recentEvents": [
                        {
                            "eventType": "integrations_traceability_status_evaluated",
                            "requestId": "req-1",
                            "traceabilityDecision": "HOLD",
                            "traceabilityReady": False,
                        }
                    ],
                }
            ),
            encoding="utf-8",
        )
        result = subprocess.run(
            [
                str(PYTHON_BIN),
                str(VALIDATOR_PATH),
                "--snapshot",
                str(snapshot_path),
            ],
            cwd=ROOT_DIR,
            capture_output=True,
            text=True,
            check=False,
        )
        assert result.returncode == 1
        assert "packetvalidationaudit" in (result.stdout + result.stderr).lower()


def test_governance_packet_fixture_generation_fails_on_invalid_weekly_report_shape():
    with tempfile.TemporaryDirectory() as tmp:
        report_path = Path(tmp) / "connector_governance_weekly_report.json"
        handoff_path = Path(tmp) / "governance_handoff_export.json"
        history_path = Path(tmp) / "governance_history_export.json"
        report_path.write_text(json.dumps([]), encoding="utf-8")

        result = subprocess.run(
            [
                str(PYTHON_BIN),
                str(GOVERNANCE_PACKET_FIXTURE_GENERATOR_PATH),
                "--report",
                str(report_path),
                "--handoff",
                str(handoff_path),
                "--history",
                str(history_path),
                "--requested-by",
                "u1",
            ],
            cwd=ROOT_DIR,
            capture_output=True,
            text=True,
            check=False,
        )
        assert result.returncode == 1
        assert "failed to load governance report artifact" in (
            result.stdout + result.stderr
        ).lower()


def test_governance_packet_validator_fails_on_runtime_prereqs_parity_mismatch():
    with tempfile.TemporaryDirectory() as tmp:
        report_path = Path(tmp) / "connector_governance_weekly_report.json"
        handoff_path = Path(tmp) / "governance_handoff_export.json"
        history_path = Path(tmp) / "governance_history_export.json"
        validation_path = Path(tmp) / "governance_packet_validation.json"
        report_path.write_text(
            json.dumps(
                {
                    "generatedAt": "2026-02-27T00:00:00+00:00",
                    "exportSchemaVersion": 1,
                    "windowDays": 7,
                    "eventLimit": 1000,
                    "status": "READY",
                    "handoff": {"ownerRole": "Release Manager"},
                    "runtimePrereqs": {
                        "present": True,
                        "available": True,
                        "passed": True,
                        "contractValid": True,
                        "valid": True,
                        "missingCheckCount": 0,
                        "missingChecks": {"commands": [], "workspace": []},
                        "command": "npm run verify:baseline:runtime-prereqs:artifact",
                    },
                    "governanceExport": {
                        "status": "READY",
                        "rolloutBlocked": False,
                        "ownerRole": "Release Manager",
                        "exportSchemaVersion": 1,
                        "runtimePrereqs": {
                            "present": True,
                            "available": True,
                            "passed": True,
                            "contractValid": True,
                            "valid": True,
                            "missingCheckCount": 0,
                            "missingChecks": {"commands": [], "workspace": []},
                            "command": "npm run verify:baseline:runtime-prereqs:artifact",
                        },
                    },
                    "summary": {
                        "connectorRateLimit": {
                            "eventCount": 1,
                            "byEndpoint": {"apollo_search": 1},
                            "pressure": {"label": "Low"},
                        }
                    },
                }
            ),
            encoding="utf-8",
        )

        generation = subprocess.run(
            [
                str(PYTHON_BIN),
                str(GOVERNANCE_PACKET_FIXTURE_GENERATOR_PATH),
                "--report",
                str(report_path),
                "--handoff",
                str(handoff_path),
                "--history",
                str(history_path),
                "--requested-by",
                "u1",
            ],
            cwd=ROOT_DIR,
            capture_output=True,
            text=True,
            check=False,
        )
        assert generation.returncode == 0

        history_payload = json.loads(history_path.read_text(encoding="utf-8"))
        history_payload["governanceExport"]["runtimePrereqs"]["missingCheckCount"] = 2
        history_path.write_text(json.dumps(history_payload), encoding="utf-8")

        result = subprocess.run(
            [
                str(PYTHON_BIN),
                str(GOVERNANCE_PACKET_VALIDATOR_PATH),
                "--handoff",
                str(handoff_path),
                "--history",
                str(history_path),
                "--output",
                str(validation_path),
            ],
            cwd=ROOT_DIR,
            capture_output=True,
            text=True,
            check=False,
        )
        assert result.returncode == 1
        assert "runtimeprereqs" in (result.stdout + result.stderr).lower()


def test_governance_packet_validator_fails_on_command_alias_parity_mismatch():
    with tempfile.TemporaryDirectory() as tmp:
        report_path = Path(tmp) / "connector_governance_weekly_report.json"
        handoff_path = Path(tmp) / "governance_handoff_export.json"
        history_path = Path(tmp) / "governance_history_export.json"
        validation_path = Path(tmp) / "governance_packet_validation.json"
        report_path.write_text(
            json.dumps(
                {
                    "generatedAt": "2026-02-27T00:00:00+00:00",
                    "exportSchemaVersion": 1,
                    "windowDays": 7,
                    "eventLimit": 1000,
                    "status": "READY",
                    "handoff": {"ownerRole": "Release Manager"},
                    "runtimePrereqs": {
                        "present": True,
                        "available": True,
                        "passed": True,
                        "contractValid": True,
                        "valid": True,
                        "missingCheckCount": 0,
                        "missingChecks": {"commands": [], "workspace": []},
                        "command": "npm run verify:baseline:runtime-prereqs:artifact",
                    },
                    "commandAliases": {
                        "present": True,
                        "available": True,
                        "source": "governance_weekly_report",
                        "gatePassed": True,
                        "contractValid": True,
                        "valid": True,
                        "missingAliasCount": 0,
                        "mismatchedAliasCount": 0,
                        "missingAliases": [],
                        "mismatchedAliases": [],
                        "command": "npm run verify:baseline:command-aliases:artifact",
                    },
                    "governanceExport": {
                        "status": "READY",
                        "rolloutBlocked": False,
                        "ownerRole": "Release Manager",
                        "exportSchemaVersion": 1,
                        "runtimePrereqs": {
                            "present": True,
                            "available": True,
                            "passed": True,
                            "contractValid": True,
                            "valid": True,
                            "missingCheckCount": 0,
                            "missingChecks": {"commands": [], "workspace": []},
                            "command": "npm run verify:baseline:runtime-prereqs:artifact",
                        },
                        "commandAliases": {
                            "present": True,
                            "available": True,
                            "source": "governance_weekly_report",
                            "gatePassed": True,
                            "contractValid": True,
                            "valid": True,
                            "missingAliasCount": 0,
                            "mismatchedAliasCount": 0,
                            "missingAliases": [],
                            "mismatchedAliases": [],
                            "command": "npm run verify:baseline:command-aliases:artifact",
                        },
                    },
                    "summary": {
                        "connectorRateLimit": {
                            "eventCount": 1,
                            "byEndpoint": {"apollo_search": 1},
                            "pressure": {"label": "Low"},
                        }
                    },
                }
            ),
            encoding="utf-8",
        )

        generation = subprocess.run(
            [
                str(PYTHON_BIN),
                str(GOVERNANCE_PACKET_FIXTURE_GENERATOR_PATH),
                "--report",
                str(report_path),
                "--handoff",
                str(handoff_path),
                "--history",
                str(history_path),
                "--requested-by",
                "u1",
            ],
            cwd=ROOT_DIR,
            capture_output=True,
            text=True,
            check=False,
        )
        assert generation.returncode == 0

        history_payload = json.loads(history_path.read_text(encoding="utf-8"))
        history_payload["governanceExport"]["commandAliases"]["missingAliasCount"] = 1
        history_payload["governanceExport"]["commandAliases"]["missingAliases"] = [
            "verify:smoke:sales"
        ]
        history_path.write_text(json.dumps(history_payload), encoding="utf-8")

        result = subprocess.run(
            [
                str(PYTHON_BIN),
                str(GOVERNANCE_PACKET_VALIDATOR_PATH),
                "--handoff",
                str(handoff_path),
                "--history",
                str(history_path),
                "--output",
                str(validation_path),
            ],
            cwd=ROOT_DIR,
            capture_output=True,
            text=True,
            check=False,
        )
        assert result.returncode == 1
        assert "commandaliases" in (result.stdout + result.stderr).lower()


def test_governance_packet_validator_fails_on_command_alias_command_parity_mismatch():
    with tempfile.TemporaryDirectory() as tmp:
        report_path = Path(tmp) / "connector_governance_weekly_report.json"
        handoff_path = Path(tmp) / "governance_handoff_export.json"
        history_path = Path(tmp) / "governance_history_export.json"
        validation_path = Path(tmp) / "governance_packet_validation.json"
        report_path.write_text(
            json.dumps(
                {
                    "generatedAt": "2026-02-27T00:00:00+00:00",
                    "exportSchemaVersion": 1,
                    "windowDays": 7,
                    "eventLimit": 1000,
                    "status": "READY",
                    "handoff": {"ownerRole": "Release Manager"},
                    "runtimePrereqs": {
                        "present": True,
                        "available": True,
                        "passed": True,
                        "contractValid": True,
                        "valid": True,
                        "missingCheckCount": 0,
                        "missingChecks": {"commands": [], "workspace": []},
                        "command": "npm run verify:baseline:runtime-prereqs:artifact",
                    },
                    "commandAliases": {
                        "present": True,
                        "available": True,
                        "source": "governance_weekly_report",
                        "gatePassed": True,
                        "contractValid": True,
                        "valid": True,
                        "missingAliasCount": 0,
                        "mismatchedAliasCount": 0,
                        "missingAliases": [],
                        "mismatchedAliases": [],
                        "command": "npm run verify:baseline:command-aliases:artifact",
                    },
                    "governanceExport": {
                        "status": "READY",
                        "rolloutBlocked": False,
                        "ownerRole": "Release Manager",
                        "exportSchemaVersion": 1,
                        "runtimePrereqs": {
                            "present": True,
                            "available": True,
                            "passed": True,
                            "contractValid": True,
                            "valid": True,
                            "missingCheckCount": 0,
                            "missingChecks": {"commands": [], "workspace": []},
                            "command": "npm run verify:baseline:runtime-prereqs:artifact",
                        },
                        "commandAliases": {
                            "present": True,
                            "available": True,
                            "source": "governance_weekly_report",
                            "gatePassed": True,
                            "contractValid": True,
                            "valid": True,
                            "missingAliasCount": 0,
                            "mismatchedAliasCount": 0,
                            "missingAliases": [],
                            "mismatchedAliases": [],
                            "command": "npm run verify:baseline:command-aliases:artifact",
                        },
                    },
                    "summary": {
                        "connectorRateLimit": {
                            "eventCount": 1,
                            "byEndpoint": {"apollo_search": 1},
                            "pressure": {"label": "Low"},
                        }
                    },
                }
            ),
            encoding="utf-8",
        )

        generation = subprocess.run(
            [
                str(PYTHON_BIN),
                str(GOVERNANCE_PACKET_FIXTURE_GENERATOR_PATH),
                "--report",
                str(report_path),
                "--handoff",
                str(handoff_path),
                "--history",
                str(history_path),
                "--requested-by",
                "u1",
            ],
            cwd=ROOT_DIR,
            capture_output=True,
            text=True,
            check=False,
        )
        assert generation.returncode == 0

        history_payload = json.loads(history_path.read_text(encoding="utf-8"))
        history_payload["governanceExport"]["commandAliases"]["command"] = (
            "npm run verify:baseline:command-aliases"
        )
        history_path.write_text(json.dumps(history_payload), encoding="utf-8")

        result = subprocess.run(
            [
                str(PYTHON_BIN),
                str(GOVERNANCE_PACKET_VALIDATOR_PATH),
                "--handoff",
                str(handoff_path),
                "--history",
                str(history_path),
                "--output",
                str(validation_path),
            ],
            cwd=ROOT_DIR,
            capture_output=True,
            text=True,
            check=False,
        )
        assert result.returncode == 1
        assert "commandaliases" in (result.stdout + result.stderr).lower()


def test_backfill_artifact_contract_validator_fails_on_decision_parity_mismatch():
    with tempfile.TemporaryDirectory() as tmp:
        policy_path = Path(tmp) / "policy.json"
        guarded_path = Path(tmp) / "guarded.json"
        policy_path.write_text(
            json.dumps(
                {
                    "generatedAt": "2026-02-27T00:00:00+00:00",
                    "command": "evaluate_integration_telemetry_event_root_backfill_policy",
                    "decision": "SKIP_APPLY",
                    "reason": "none",
                    "candidateCount": 0,
                    "maxApplyCandidates": 2000,
                    "allowApplyFlag": False,
                    "allowApplyEnvVar": "BACKFILL_ALLOW_APPLY",
                    "recommendedCommand": None,
                    "dryRunSummary": {"mode": "dry-run", "candidateCount": 0},
                }
            ),
            encoding="utf-8",
        )
        guarded_path.write_text(
            json.dumps(
                {
                    "generatedAt": "2026-02-27T00:00:01+00:00",
                    "command": "run_integration_telemetry_event_root_backfill_guarded_apply",
                    "policy": {
                        "decision": "ACTION_REQUIRED",
                        "reason": "manual review required",
                        "candidateCount": 0,
                        "maxApplyCandidates": 2000,
                        "allowApplyFlag": False,
                        "allowApplyEnvVar": "BACKFILL_ALLOW_APPLY",
                        "recommendedCommand": "npm run verify:telemetry:event-root:backfill:dry-run -- --max-docs 5000",
                        "dryRunSummary": {"mode": "dry-run", "candidateCount": 0},
                    },
                }
            ),
            encoding="utf-8",
        )

        result = subprocess.run(
            [
                str(PYTHON_BIN),
                str(BACKFILL_ARTIFACT_VALIDATOR_PATH),
                "--policy-artifact",
                str(policy_path),
                "--guarded-artifact",
                str(guarded_path),
            ],
            cwd=ROOT_DIR,
            capture_output=True,
            text=True,
            check=False,
        )
        assert result.returncode == 1
        assert "matching decision values" in (result.stdout + result.stderr).lower()


def test_runtime_prereqs_artifact_validator_fails_on_missing_checks_parity():
    with tempfile.TemporaryDirectory() as tmp:
        artifact_path = Path(tmp) / "runtime-prereqs-invalid.json"
        artifact_path.write_text(
            json.dumps(
                {
                    "generatedAt": "2026-02-27T00:00:00+00:00",
                    "command": "verify_sales_runtime_prereqs",
                    "artifact": {
                        "validatedAt": "2026-02-27T00:00:01+00:00",
                        "workspaceRoot": "/tmp/workspace",
                        "requiredCommands": ["bash", "git", "node", "npm"],
                        "commandChecks": {
                            "bash": True,
                            "git": True,
                            "node": False,
                            "npm": True,
                        },
                        "workspaceChecks": {
                            "root_exists": True,
                            "backend_dir_exists": True,
                            "frontend_dir_exists": True,
                            "venv_python_exists": True,
                        },
                        "missingChecks": {
                            "commands": [],
                            "workspace": [],
                        },
                        "recommendedCommands": [
                            "Install node and npm, then re-run: brew install node"
                        ],
                        "valid": False,
                    },
                }
            ),
            encoding="utf-8",
        )

        result = subprocess.run(
            [
                str(PYTHON_BIN),
                str(RUNTIME_PREREQS_ARTIFACT_VALIDATOR_PATH),
                "--artifact",
                str(artifact_path),
            ],
            cwd=ROOT_DIR,
            capture_output=True,
            text=True,
            check=False,
        )
        assert result.returncode == 1
        assert "missingcommandparity" in (result.stdout + result.stderr).lower()
