import json
from pathlib import Path
import tempfile

from scripts import generate_connector_governance_weekly_report
from scripts import validate_connector_governance_weekly_report


def _telemetry_fixture_payload() -> dict:
    return {
        "generatedAt": "2026-02-23T00:00:00+00:00",
        "windowDays": 7,
        "eventCount": 4,
        "errorEventCount": 0,
        "byProvider": {"integrations": 4},
        "byEventType": {
            "integrations_traceability_status_evaluated": 1,
            "integrations_traceability_snapshot_governance_evaluated": 2,
            "integrations_traceability_baseline_governance_evaluated": 1,
        },
        "traceabilityAudit": {
            "eventCount": 1,
            "decisionCounts": {"HOLD": 1, "proceed-later": 2},
            "readyCount": 0,
            "notReadyCount": 1,
        },
        "governanceAudit": {
            "eventCount": 3,
            "snapshotEvaluationCount": 2,
            "baselineEvaluationCount": 1,
            "statusCounts": {"ACTION_REQUIRED": 1, "PASS": 2, "!!!": 4},
        },
        "connectorRateLimit": {
            "eventCount": 3,
            "byEndpoint": {
                "apollo_search": 2,
                "company_enrichment_orchestration": 1,
            },
            "latestEventAt": "2026-02-23T00:02:00+00:00",
            "maxRetryAfterSeconds": 46,
            "avgRetryAfterSeconds": 30,
            "maxResetInSeconds": 44,
            "avgResetInSeconds": 21,
        },
        "recentEvents": [
            {
                "eventType": "integrations_traceability_snapshot_governance_evaluated",
                "provider": "integrations",
                "createdAt": "2026-02-23T00:00:00+00:00",
                "requestId": "req-snapshot-smoke",
                "governanceStatus": "ACTION_REQUIRED",
            },
            {
                "eventType": "integrations_traceability_status_evaluated",
                "provider": "integrations",
                "createdAt": "2026-02-23T00:01:00+00:00",
                "requestId": "req-traceability-smoke",
                "traceabilityDecision": "hold-now",
                "traceabilityReady": False,
            },
        ],
    }


def _baseline_fixture_payload() -> dict:
    return {
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
        "runtimePrereqs": {
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
            "generatedAt": "2026-02-23T00:00:00+00:00",
            "validatedAt": "2026-02-23T00:01:00+00:00",
            "command": "npm run verify:baseline:runtime-prereqs:artifact",
        },
        "commandAliases": {
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
            "generatedAt": "2026-02-23T00:00:00+00:00",
            "validatedAt": "2026-02-23T00:01:00+00:00",
            "command": "npm run verify:baseline:command-aliases:artifact",
        },
    }


def _run_generate(telemetry_path: Path, baseline_path: Path, output_path: Path) -> int:
    class _Args:
        telemetry_snapshot = str(telemetry_path)
        baseline_metrics = str(baseline_path)
        output = str(output_path)
        window_days = 7

    original_parse = generate_connector_governance_weekly_report.parse_args
    try:
        generate_connector_governance_weekly_report.parse_args = lambda: _Args
        return generate_connector_governance_weekly_report.main()
    finally:
        generate_connector_governance_weekly_report.parse_args = original_parse


def _run_validate(report_path: Path) -> int:
    class _Args:
        artifact = str(report_path)

    original_parse = validate_connector_governance_weekly_report.parse_args
    try:
        validate_connector_governance_weekly_report.parse_args = lambda: _Args
        return validate_connector_governance_weekly_report.main()
    finally:
        validate_connector_governance_weekly_report.parse_args = original_parse


def test_governance_weekly_report_smoke_artifact_generation_and_validation():
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        telemetry_path = tmp_path / "connector-telemetry-summary-snapshot.json"
        baseline_path = tmp_path / "baseline_metrics.json"
        report_path = tmp_path / "connector_governance_weekly_report.json"

        telemetry_path.write_text(json.dumps(_telemetry_fixture_payload()), encoding="utf-8")
        baseline_path.write_text(json.dumps(_baseline_fixture_payload()), encoding="utf-8")

        assert _run_generate(telemetry_path, baseline_path, report_path) == 0
        assert report_path.exists()

        generated_payload = json.loads(report_path.read_text(encoding="utf-8"))
        assert generated_payload["summary"]["rolloutBlocked"] is True
        assert generated_payload["totals"]["actionRequiredCount"] == 1
        assert generated_payload["totals"]["connectorRateLimitEventCount"] == 3
        assert generated_payload["summary"]["connectorRateLimit"]["eventCount"] == 3
        assert generated_payload["summary"]["connectorRateLimit"]["pressure"]["label"] == "High"
        assert generated_payload["summary"]["governanceAudit"]["statusCounts"]["UNKNOWN"] == 4
        assert generated_payload["summary"]["traceabilityAudit"]["decisionCounts"]["UNKNOWN"] == 2
        assert generated_payload["summary"]["runtimePrereqs"]["present"] is True
        assert generated_payload["summary"]["runtimePrereqs"]["passed"] is True
        assert generated_payload["summary"]["commandAliases"]["present"] is True
        assert generated_payload["summary"]["commandAliases"]["gatePassed"] is True
        assert generated_payload["totals"]["commandAliasesMissingAliasCount"] == 0
        assert generated_payload["totals"]["commandAliasesMismatchedAliasCount"] == 0
        assert generated_payload["timeline"][0]["holdDecisions"] == 0
        assert len(generated_payload["ownerActionMatrix"]) >= 1

        assert _run_validate(report_path) == 0
