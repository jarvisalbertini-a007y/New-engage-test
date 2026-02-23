from pathlib import Path


RUNBOOK_PATH = (
    Path(__file__).resolve().parents[2]
    / "docs"
    / "runbooks"
    / "PREDICTIVE_OPTIMIZATION_RUNBOOK.md"
)


def _runbook_text() -> str:
    return RUNBOOK_PATH.read_text(encoding="utf-8")


def test_predictive_runbook_exists():
    assert RUNBOOK_PATH.exists()


def test_predictive_runbook_includes_sales_dashboard_verification_commands():
    content = _runbook_text()
    assert "npm run verify:frontend:sales" in content
    assert "npm run verify:backend:sales" in content
    assert "npm run verify:ci:sales" in content


def test_predictive_runbook_includes_dashboard_control_and_export_steps():
    content = _runbook_text()
    required_fragments = [
        "Refresh Telemetry",
        "bounded to allowed ranges",
        "Export telemetry and prediction JSON snapshots",
        "operation notice can be dismissed and auto-clears",
        "X-Request-Id",
        "schema_version",
        "schemaVersion=2",
        "gates.schemaSampleSizePassed=true",
        "schemaCoverage.sampleCount >= schemaCoverage.minSampleCount",
        "--min-schema-v2-sample-count 25",
        "sloSummary.gates.schemaSampleSizePassed",
    ]
    for fragment in required_fragments:
        assert fragment in content


def test_predictive_runbook_includes_related_rollout_and_rollback_docs():
    content = _runbook_text()
    required_fragments = [
        "Connector canary rollout plan",
        "Connector rollback drill plan",
        "Connector alert response matrix",
        "Connector release signoff process",
    ]
    for fragment in required_fragments:
        assert fragment in content


def test_predictive_runbook_lists_rollback_evidence_artifacts():
    content = _runbook_text()
    required_fragments = [
        "backend/test_reports/connector_canary_evidence.json",
        "backend/test_reports/connector_signoff_validation.json",
        "backend/test_reports/connector_release_gate_result.json",
        "Incident summary with impacted sales segments/channels and mitigation timeline",
    ]
    for fragment in required_fragments:
        assert fragment in content


def test_predictive_runbook_includes_baseline_artifact_retention_guidance():
    content = _runbook_text()
    required_fragments = [
        "backend/test_reports/baseline_metrics.json",
        "Retain predictive and connector rollout evidence artifacts for at least 14 days",
    ]
    for fragment in required_fragments:
        assert fragment in content
