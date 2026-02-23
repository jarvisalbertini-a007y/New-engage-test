from pathlib import Path


RUNBOOK_PATH = (
    Path(__file__).resolve().parents[2]
    / "docs"
    / "runbooks"
    / "CONNECTOR_ENRICHMENT_RUNBOOK.md"
)


def _runbook_text() -> str:
    return RUNBOOK_PATH.read_text(encoding="utf-8")


def test_runbook_includes_operations_and_verification_commands():
    content = _runbook_text()
    assert "## Operational Checklist" in content
    assert "## Verification Commands" in content
    assert "npm run verify:backend:sales:connectors:runtime" in content


def test_runbook_includes_connector_lookup_validation_steps():
    content = _runbook_text()
    assert "run one Company Enrichment lookup from the Connector Enrichment Sandbox" in content
    assert "run one Apollo Prospect Lookup from the same sandbox" in content
    assert "Validate result counts, selected provider, and top-record summaries" in content


def test_runbook_includes_slo_gate_review_step():
    content = _runbook_text()
    assert "Connector Rollout SLO Gate" in content
    assert "confirm decision/actions/signoff requirements align with telemetry" in content
    assert "Traceability Readiness" in content
    assert "schema coverage gate pass, schema sample gate pass" in content
    assert "Traceability Readiness` shows `NOT READY`" in content
    assert "remediation checklist items shown in the SLO card" in content


def test_runbook_includes_telemetry_refresh_and_snapshot_export_steps():
    content = _runbook_text()
    assert "Use Integrations UI telemetry controls to refresh the telemetry window and limit" in content
    assert "Export both telemetry and SLO JSON snapshots" in content


def test_runbook_includes_notice_dismiss_and_auto_clear_validation_step():
    content = _runbook_text()
    assert "notice banner can be dismissed" in content
    assert "stale notices clear automatically after a short interval" in content


def test_runbook_includes_combined_sales_smoke_command():
    content = _runbook_text()
    assert "npm run verify:smoke:sales" in content
