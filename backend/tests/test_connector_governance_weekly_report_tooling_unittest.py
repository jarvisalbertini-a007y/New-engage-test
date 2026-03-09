import importlib.util
import json
from pathlib import Path
import tempfile


SCRIPT_PATH = (
    Path(__file__).resolve().parents[1]
    / "scripts"
    / "generate_connector_governance_weekly_report.py"
)


def _load_script_module():
    spec = importlib.util.spec_from_file_location(
        "generate_connector_governance_weekly_report", SCRIPT_PATH
    )
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def _telemetry_payload():
    return {
        "generatedAt": "2026-02-22T00:00:00+00:00",
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
            "latestEventAt": "2026-02-21T10:06:00+00:00",
            "maxRetryAfterSeconds": 46,
            "avgRetryAfterSeconds": 35.5,
            "maxResetInSeconds": 44,
            "avgResetInSeconds": 22.25,
        },
        "recentEvents": [
            {
                "createdAt": "2026-02-21T10:00:00+00:00",
                "eventType": "integrations_traceability_snapshot_governance_evaluated",
                "governanceStatus": "ACTION_REQUIRED",
                "requestId": "req-1",
            },
            {
                "createdAt": "2026-02-21T10:05:00+00:00",
                "eventType": "integrations_traceability_status_evaluated",
                "traceabilityDecision": "HOLD",
                "requestId": "req-2",
            },
        ],
    }


def _baseline_payload(
    passed: bool = True,
    *,
    runtime_prereqs_present: bool = True,
    runtime_prereqs_passed: bool = True,
    command_aliases_present: bool = True,
    command_aliases_passed: bool = True,
):
    runtime_prereqs_payload = {
        "available": True,
        "passed": runtime_prereqs_passed,
        "contractValid": runtime_prereqs_passed,
        "valid": runtime_prereqs_passed,
        "missingCheckCount": 0 if runtime_prereqs_passed else 1,
        "missingChecks": {
            "commands": [] if runtime_prereqs_passed else ["git"],
            "workspace": [],
        },
        "artifactPath": "backend/test_reports/sales_runtime_prereqs.json",
        "generatedAt": "2026-02-22T00:00:00+00:00",
        "validatedAt": "2026-02-22T00:00:00+00:00",
        "command": "npm run verify:baseline:runtime-prereqs:artifact",
    }
    command_aliases_payload = {
        "available": True,
        "gatePassed": command_aliases_passed,
        "contractValid": command_aliases_passed,
        "valid": command_aliases_passed,
        "missingAliasCount": 0 if command_aliases_passed else 1,
        "mismatchedAliasCount": 0 if command_aliases_passed else 1,
        "missingAliases": [] if command_aliases_passed else ["verify:smoke:sales"],
        "mismatchedAliases": [] if command_aliases_passed else ["test"],
        "artifactPath": "backend/test_reports/sales_baseline_command_aliases.json",
        "generatedAt": "2026-02-22T00:00:00+00:00",
        "validatedAt": "2026-02-22T00:00:00+00:00",
        "command": "npm run verify:baseline:command-aliases:artifact",
    }
    return {
        "generatedAt": "2026-02-22T00:00:00+00:00",
        "overallStatus": "pass" if passed else "fail",
        "releaseGateFixturePolicy": {
            "passed": passed,
            "requiredProfiles": ["pass", "hold", "validation-fail"],
            "missingProfiles": [] if passed else ["validation-fail"],
            "message": "policy status",
        },
        **({"runtimePrereqs": runtime_prereqs_payload} if runtime_prereqs_present else {}),
        **(
            {"commandAliases": command_aliases_payload}
            if command_aliases_present
            else {}
        ),
    }


def test_build_report_includes_rollout_blocking_and_recommended_commands():
    module = _load_script_module()
    report = module.build_report(
        telemetry_payload=_telemetry_payload(),
        baseline_payload=_baseline_payload(passed=False),
        window_days=7,
        telemetry_source=Path("/tmp/telemetry.json"),
        baseline_source=Path("/tmp/baseline.json"),
    )

    assert report["summary"]["rolloutBlocked"] is True
    assert report["totals"]["governanceEventCount"] == 2
    assert report["totals"]["traceabilityEvaluationCount"] == 2
    assert report["totals"]["actionRequiredCount"] == 1
    assert report["totals"]["connectorRateLimitEventCount"] == 3
    assert report["totals"]["rolloutBlocked"] is True
    assert report["summary"]["connectorRateLimit"]["eventCount"] == 3
    assert report["summary"]["connectorRateLimit"]["byEndpoint"]["apollo_search"] == 2
    assert report["summary"]["connectorRateLimit"]["maxRetryAfterSeconds"] == 46.0
    assert report["summary"]["connectorRateLimit"]["avgResetInSeconds"] == 22.25
    assert report["summary"]["connectorRateLimit"]["pressure"]["label"] == "High"
    assert report["summary"]["connectorRateLimit"]["pressure"]["signalSeconds"] == 46.0
    assert report["summary"]["runtimePrereqs"]["present"] is True
    assert report["summary"]["runtimePrereqs"]["passed"] is True
    assert report["summary"]["commandAliases"]["present"] is True
    assert report["summary"]["commandAliases"]["gatePassed"] is True
    assert report["totals"]["commandAliasesMissingAliasCount"] == 0
    assert report["totals"]["commandAliasesMismatchedAliasCount"] == 0
    assert "npm run verify:governance:weekly:report" in report["recommendedCommands"]
    assert "npm run verify:ci:sales:extended" in report["recommendedCommands"]
    assert len(report["ownerActionMatrix"]) >= 2
    assert len(report["timeline"]) >= 1


def test_build_report_normalizes_malformed_status_and_decision_tokens():
    module = _load_script_module()
    telemetry_payload = _telemetry_payload()
    telemetry_payload["governanceAudit"]["statusCounts"] = {
        " action-required ": 2,
        "pass": 1,
        "!!!": 3,
    }
    telemetry_payload["traceabilityAudit"]["decisionCounts"] = {
        "proceed": 2,
        " HOLD ": 1,
        "blocked-now": 4,
    }
    telemetry_payload["recentEvents"] = [
        {
            "createdAt": "2026-02-21T10:00:00+00:00",
            "eventType": "integrations_traceability_snapshot_governance_evaluated",
            "governanceStatus": "action-required",
            "requestId": "req-1",
        },
        {
            "createdAt": "2026-02-21T10:05:00+00:00",
            "eventType": "integrations_traceability_status_evaluated",
            "traceabilityDecision": "blocked-now",
            "requestId": "req-2",
        },
        {
            "createdAt": "2026-02-21T10:06:00+00:00",
            "eventType": "integrations_traceability_status_evaluated",
            "traceabilityDecision": "proceed",
            "requestId": "req-3",
        },
    ]

    report = module.build_report(
        telemetry_payload=telemetry_payload,
        baseline_payload=_baseline_payload(passed=True),
        window_days=7,
        telemetry_source=Path("/tmp/telemetry.json"),
        baseline_source=Path("/tmp/baseline.json"),
    )

    assert report["summary"]["governanceAudit"]["statusCounts"]["ACTION_REQUIRED"] == 2
    assert report["summary"]["governanceAudit"]["statusCounts"]["PASS"] == 1
    assert report["summary"]["governanceAudit"]["statusCounts"]["UNKNOWN"] == 3
    assert report["summary"]["traceabilityAudit"]["decisionCounts"]["PROCEED"] == 2
    assert report["summary"]["traceabilityAudit"]["decisionCounts"]["HOLD"] == 1
    assert report["summary"]["traceabilityAudit"]["decisionCounts"]["UNKNOWN"] == 4
    assert report["totals"]["actionRequiredCount"] == 2
    assert report["summary"]["rolloutBlocked"] is True
    assert report["timeline"][0]["traceabilityEvents"] == 2
    assert report["timeline"][0]["proceedDecisions"] == 1
    assert report["timeline"][0]["holdDecisions"] == 0


def test_build_report_runtime_prereqs_failure_blocks_rollout_and_adds_commands():
    module = _load_script_module()
    report = module.build_report(
        telemetry_payload=_telemetry_payload(),
        baseline_payload=_baseline_payload(
            passed=True,
            runtime_prereqs_present=True,
            runtime_prereqs_passed=False,
        ),
        window_days=7,
        telemetry_source=Path("/tmp/telemetry.json"),
        baseline_source=Path("/tmp/baseline.json"),
    )

    assert report["summary"]["runtimePrereqs"]["present"] is True
    assert report["summary"]["runtimePrereqs"]["passed"] is False
    assert report["summary"]["runtimePrereqs"]["missingCheckCount"] == 1
    assert report["summary"]["rolloutBlocked"] is True
    action_triggers = {
        item.get("trigger") for item in report.get("ownerActionMatrix") or []
    }
    assert "runtime_prereqs_check_failed" in action_triggers
    assert "npm run verify:smoke:runtime-prereqs-artifact" in report["recommendedCommands"]


def test_build_report_command_alias_failures_block_rollout_and_add_commands():
    module = _load_script_module()
    report = module.build_report(
        telemetry_payload=_telemetry_payload(),
        baseline_payload=_baseline_payload(
            passed=True,
            runtime_prereqs_present=True,
            runtime_prereqs_passed=True,
            command_aliases_present=True,
            command_aliases_passed=False,
        ),
        window_days=7,
        telemetry_source=Path("/tmp/telemetry.json"),
        baseline_source=Path("/tmp/baseline.json"),
    )

    assert report["summary"]["commandAliases"]["present"] is True
    assert report["summary"]["commandAliases"]["gatePassed"] is False
    assert report["summary"]["commandAliases"]["missingAliasCount"] == 1
    assert report["summary"]["commandAliases"]["mismatchedAliasCount"] == 1
    assert report["summary"]["rolloutBlocked"] is True
    action_triggers = {
        item.get("trigger") for item in report.get("ownerActionMatrix") or []
    }
    assert "baseline_command_aliases_check_failed" in action_triggers
    assert (
        "npm run verify:smoke:baseline-command-aliases-artifact"
        in report["recommendedCommands"]
    )


def test_main_writes_governance_weekly_report_artifact():
    module = _load_script_module()
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        telemetry_path = tmp_path / "telemetry.json"
        baseline_path = tmp_path / "baseline.json"
        output_path = tmp_path / "governance_weekly_report.json"

        telemetry_path.write_text(json.dumps(_telemetry_payload()), encoding="utf-8")
        baseline_path.write_text(json.dumps(_baseline_payload(passed=True)), encoding="utf-8")

        class _Args:
            telemetry_snapshot = str(telemetry_path)
            baseline_metrics = str(baseline_path)
            output = str(output_path)
            window_days = 14

        original_parse = module.parse_args
        try:
            module.parse_args = lambda: _Args
            exit_code = module.main()
        finally:
            module.parse_args = original_parse

        assert exit_code == 0
        payload = json.loads(output_path.read_text(encoding="utf-8"))
        assert payload["windowDays"] == 14
        assert payload["summary"]["baselinePolicy"]["passed"] is True
        assert payload["summary"]["runtimePrereqs"]["present"] is True
        assert payload["summary"]["commandAliases"]["present"] is True
        assert payload["summary"]["connectorRateLimit"]["eventCount"] == 3
        assert payload["sourceArtifacts"]["telemetrySnapshot"] == str(telemetry_path)


def test_main_returns_nonzero_when_required_artifacts_are_missing():
    module = _load_script_module()
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        telemetry_path = tmp_path / "missing-telemetry.json"
        baseline_path = tmp_path / "missing-baseline.json"
        output_path = tmp_path / "governance_weekly_report.json"

        class _Args:
            telemetry_snapshot = str(telemetry_path)
            baseline_metrics = str(baseline_path)
            output = str(output_path)
            window_days = 7

        original_parse = module.parse_args
        try:
            module.parse_args = lambda: _Args
            exit_code = module.main()
        finally:
            module.parse_args = original_parse

        assert exit_code == 1
