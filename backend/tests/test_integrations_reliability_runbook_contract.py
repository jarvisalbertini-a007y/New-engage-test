from pathlib import Path


RUNBOOK_PATH = (
    Path(__file__).resolve().parents[2]
    / "docs"
    / "runbooks"
    / "INTEGRATIONS_RELIABILITY_RUNBOOK.md"
)


def _runbook_text() -> str:
    return RUNBOOK_PATH.read_text(encoding="utf-8")


def test_integrations_reliability_runbook_exists():
    assert RUNBOOK_PATH.exists()


def test_integrations_reliability_runbook_includes_schema_tracking_fields():
    content = _runbook_text()
    required_fragments = [
        "bySchemaVersion",
        "salesIntelligence.bySchemaVersion",
    ]
    for fragment in required_fragments:
        assert fragment in content


def test_integrations_reliability_runbook_includes_recent_event_correlation_fields():
    content = _runbook_text()
    required_fragments = [
        "recentEvents",
        "requestId",
        "schemaVersion",
        "traceabilityDecision",
    ]
    for fragment in required_fragments:
        assert fragment in content


def test_integrations_reliability_runbook_includes_schema_slo_gate_fields():
    content = _runbook_text()
    required_fragments = [
        "/api/integrations/integrations/telemetry/slo-gates",
        "/api/integrations/integrations/telemetry/snapshot-governance",
        "/api/integrations/integrations/telemetry/baseline-governance",
        "schemaCoverage.thresholdPct",
        "schemaCoverage.observedPct",
        "schemaCoverage.minSampleCount",
        "gates.schemaCoveragePassed",
        "gates.schemaSampleSizePassed",
        "min_schema_v2_pct=95&min_schema_v2_sample_count=25",
    ]
    for fragment in required_fragments:
        assert fragment in content


def test_integrations_reliability_runbook_includes_schema_gate_smoke_command():
    content = _runbook_text()
    assert "npm run verify:smoke:schema-gate" in content


def test_integrations_reliability_runbook_includes_release_gate_smoke_command():
    content = _runbook_text()
    assert "npm run verify:smoke:release-gate" in content


def test_integrations_reliability_runbook_includes_full_baseline_command():
    content = _runbook_text()
    assert "npm run verify:baseline" in content


def test_integrations_reliability_runbook_includes_required_command_inventory():
    content = _runbook_text()
    required_commands = [
        "npm run verify:ci:sales",
        "npm run verify:ci:sales:extended",
        "npm run verify:baseline:metrics",
        "npm run verify:baseline:metrics:contract",
        "npm run verify:release-gate:artifact:contract",
        "npm run verify:release-gate:artifact:fixtures",
        "npm run verify:telemetry:traceability:fixture",
        "npm run verify:telemetry:traceability:contract",
        "npm run verify:telemetry:traceability:retention",
        "npm run verify:telemetry:traceability:cleanup:dry-run",
        "npm run verify:telemetry:traceability:cleanup:policy",
        "npm run verify:telemetry:traceability",
        "npm run verify:smoke:traceability-ci-guard",
        "npm run verify:smoke:traceability-governance-handoff",
        "npm run verify:backend:sales:integrations",
        "npm run verify:backend:sales:intelligence",
        "npm run verify:backend:sales",
        "npm run verify:docs:sales:connectors",
        "npm run verify:docs:sales",
        "npm run verify:smoke:campaign",
        "npm run verify:smoke:canary-dry-run",
        "npm run verify:smoke:schema-gate",
        "npm run verify:smoke:release-gate",
        "npm run verify:smoke:sales",
    ]
    for command in required_commands:
        assert command in content


def test_integrations_reliability_runbook_includes_traceability_audit_summary_fields():
    content = _runbook_text()
    required_fragments = [
        "traceabilityAudit.eventCount",
        "traceabilityAudit.decisionCounts",
        "traceabilityAudit.readyCount",
        "traceabilityAudit.notReadyCount",
    ]
    for fragment in required_fragments:
        assert fragment in content


def test_integrations_reliability_runbook_includes_traceability_retention_incident_response_section():
    content = _runbook_text()
    required_fragments = [
        "Traceability Snapshot Retention Incident Response",
        "Traceability Snapshot Governance",
        "status is `ACTION_REQUIRED`",
        "npm run verify:telemetry:traceability",
        "npm run verify:telemetry:traceability:cleanup:dry-run",
        "npm run verify:telemetry:traceability:cleanup:policy",
        "npm run verify:smoke:traceability-ci-guard",
        "npm run verify:smoke:traceability-governance-handoff",
    ]
    for fragment in required_fragments:
        assert fragment in content


def test_integrations_reliability_runbook_includes_artifact_paths_and_retention():
    content = _runbook_text()
    required_fragments = [
        "backend/test_reports/baseline_metrics.json",
        "backend/test_reports/connector_canary_evidence.json",
        "backend/test_reports/connector_signoff_validation.json",
        "backend/test_reports/connector_release_gate_result.json",
        "backend/test_reports/connector_release_gate_result_hold.json",
        "backend/test_reports/connector_release_gate_result_validation_fail.json",
        "backend/test_reports/connector-telemetry-summary-<timestamp>.json",
        "backend/test_reports/connector-telemetry-summary-snapshot.json",
        "Retain artifacts for at least 14 days",
        "Retain traceability audit telemetry snapshots for at least 30 days",
    ]
    for fragment in required_fragments:
        assert fragment in content
