import importlib.util
import json
from pathlib import Path
import tempfile


SCRIPT_PATH = (
    Path(__file__).resolve().parents[1]
    / "scripts"
    / "validate_connector_governance_weekly_report.py"
)


def _load_script_module():
    spec = importlib.util.spec_from_file_location(
        "validate_connector_governance_weekly_report", SCRIPT_PATH
    )
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def _valid_payload():
    return {
        "generatedAt": "2026-02-22T00:00:00+00:00",
        "windowDays": 7,
        "sourceArtifacts": {
            "telemetrySnapshot": "backend/test_reports/connector-telemetry-summary-snapshot.json",
            "baselineMetrics": "backend/test_reports/baseline_metrics.json",
        },
        "summary": {
            "governanceAudit": {
                "eventCount": 2,
                "snapshotEvaluationCount": 1,
                "baselineEvaluationCount": 1,
                "statusCounts": {"ACTION_REQUIRED": 1, "PASS": 1},
            },
            "traceabilityAudit": {
                "eventCount": 2,
                "decisionCounts": {"HOLD": 1, "PROCEED": 1},
                "readyCount": 1,
                "notReadyCount": 1,
            },
            "connectorRateLimit": {
                "eventCount": 3,
                "byEndpoint": {
                    "apollo_search": 2,
                    "company_enrichment_orchestration": 1,
                },
                "latestEventAt": "2026-02-22T09:50:00+00:00",
                "maxRetryAfterSeconds": 46.0,
                "avgRetryAfterSeconds": 35.5,
                "maxResetInSeconds": 44.0,
                "avgResetInSeconds": 22.25,
                "pressure": {
                    "label": "High",
                    "signalSeconds": 46.0,
                },
            },
            "baselinePolicy": {
                "passed": False,
                "missingProfiles": ["validation-fail"],
                "message": "missing fixture",
            },
            "runtimePrereqs": {
                "present": True,
                "available": True,
                "passed": True,
                "contractValid": True,
                "valid": True,
                "missingCheckCount": 0,
                "missingChecks": {
                    "commands": [],
                    "workspace": [],
                },
                "artifactPath": "backend/test_reports/sales_runtime_prereqs.json",
                "generatedAt": "2026-02-22T09:50:00+00:00",
                "validatedAt": "2026-02-22T09:55:00+00:00",
                "command": "npm run verify:baseline:runtime-prereqs:artifact",
            },
            "commandAliases": {
                "present": True,
                "available": True,
                "source": "baseline_metrics",
                "gatePassed": True,
                "contractValid": True,
                "valid": True,
                "missingAliasCount": 0,
                "mismatchedAliasCount": 0,
                "missingAliases": [],
                "mismatchedAliases": [],
                "artifactPath": "backend/test_reports/sales_baseline_command_aliases.json",
                "generatedAt": "2026-02-22T09:50:00+00:00",
                "validatedAt": "2026-02-22T09:55:00+00:00",
                "command": "npm run verify:baseline:command-aliases:artifact",
            },
            "rolloutBlocked": True,
        },
        "totals": {
            "governanceEventCount": 2,
            "traceabilityEvaluationCount": 2,
            "snapshotEvaluationCount": 1,
            "baselineEvaluationCount": 1,
            "actionRequiredCount": 1,
            "connectorRateLimitEventCount": 3,
            "commandAliasesMissingAliasCount": 0,
            "commandAliasesMismatchedAliasCount": 0,
            "rolloutBlocked": True,
        },
        "timeline": [
            {
                "date": "2026-02-22",
                "traceabilityEvents": 1,
                "snapshotGovernanceEvents": 1,
                "baselineGovernanceEvents": 1,
                "actionRequiredEvents": 1,
                "holdDecisions": 1,
                "proceedDecisions": 0,
            }
        ],
        "ownerActionMatrix": [
            {
                "priority": "P1",
                "severity": "high",
                "ownerRole": "Release Manager",
                "trigger": "governance_action_required",
                "action": "Run cleanup policy",
                "command": "npm run verify:telemetry:traceability:cleanup:policy",
            }
        ],
        "recommendedCommands": [
            "npm run verify:telemetry:traceability:cleanup:policy",
            "npm run verify:governance:weekly:report",
            "npm run verify:ci:sales:extended",
        ],
        "signoffChecklist": [
            "Review trend report",
            "Run recommended commands",
            "Confirm rollout block status",
        ],
    }


def test_validate_report_accepts_valid_artifact():
    module = _load_script_module()
    errors = module.validate_report(_valid_payload())
    assert errors == []


def test_validate_report_rejects_missing_totals_fields():
    module = _load_script_module()
    payload = _valid_payload()
    del payload["totals"]["rolloutBlocked"]
    errors = module.validate_report(payload)
    assert any("totals missing key: rolloutBlocked" in error for error in errors)


def test_validate_report_rejects_empty_recommended_commands():
    module = _load_script_module()
    payload = _valid_payload()
    payload["recommendedCommands"] = []
    errors = module.validate_report(payload)
    assert any("recommendedCommands must not be empty" in error for error in errors)


def test_validate_report_rejects_missing_connector_rate_limit_summary():
    module = _load_script_module()
    payload = _valid_payload()
    del payload["summary"]["connectorRateLimit"]
    errors = module.validate_report(payload)
    assert any("summary.connectorRateLimit must be an object" in error for error in errors)


def test_validate_report_rejects_missing_runtime_prereqs_summary():
    module = _load_script_module()
    payload = _valid_payload()
    del payload["summary"]["runtimePrereqs"]
    errors = module.validate_report(payload)
    assert any("summary.runtimePrereqs must be an object" in error for error in errors)


def test_validate_report_rejects_missing_command_aliases_summary():
    module = _load_script_module()
    payload = _valid_payload()
    del payload["summary"]["commandAliases"]
    errors = module.validate_report(payload)
    assert any("summary.commandAliases must be an object" in error for error in errors)


def test_validate_report_rejects_invalid_governance_status_count_tokens():
    module = _load_script_module()
    payload = _valid_payload()
    payload["summary"]["governanceAudit"]["statusCounts"] = {"BLOCKED_NOW": 1}
    errors = module.validate_report(payload)
    assert any(
        "summary.governanceAudit.statusCounts.BLOCKED_NOW must be one of" in error
        for error in errors
    )


def test_validate_report_rejects_invalid_traceability_decision_tokens():
    module = _load_script_module()
    payload = _valid_payload()
    payload["summary"]["traceabilityAudit"]["decisionCounts"] = {"NOT_SURE": 1}
    errors = module.validate_report(payload)
    assert any(
        "summary.traceabilityAudit.decisionCounts.NOT_SURE must be one of" in error
        for error in errors
    )


def test_validate_report_rejects_negative_timeline_counts():
    module = _load_script_module()
    payload = _valid_payload()
    payload["timeline"][0]["traceabilityEvents"] = -1
    errors = module.validate_report(payload)
    assert any(
        "timeline row 0 field traceabilityEvents must be a non-negative integer" in error
        for error in errors
    )


def test_main_returns_nonzero_for_invalid_artifact():
    module = _load_script_module()
    with tempfile.TemporaryDirectory() as tmp:
        artifact_path = Path(tmp) / "governance_report.json"
        artifact_path.write_text(json.dumps({"generatedAt": "2026-02-22"}), encoding="utf-8")

        class _Args:
            artifact = str(artifact_path)

        original_parse = module.parse_args
        try:
            module.parse_args = lambda: _Args
            exit_code = module.main()
        finally:
            module.parse_args = original_parse

        assert exit_code == 1
