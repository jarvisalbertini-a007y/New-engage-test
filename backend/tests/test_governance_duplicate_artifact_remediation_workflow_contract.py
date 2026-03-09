from pathlib import Path


SCRIPT_PATH = (
    Path(__file__).resolve().parents[1]
    / "scripts"
    / "run_smoke_governance_duplicate_artifact_remediation_workflow.sh"
)


def test_governance_duplicate_artifact_remediation_smoke_workflow_exists():
    assert SCRIPT_PATH.exists()


def test_governance_duplicate_artifact_remediation_smoke_workflow_runs_expected_suites():
    content = SCRIPT_PATH.read_text(encoding="utf-8")
    history_retention_index = content.index(
        "backend/tests/test_governance_history_retention_smoke.py"
    )
    weekly_contract_index = content.index(
        "backend/tests/test_governance_weekly_report_endpoint_contract.py"
    )
    duplicate_filter_index = content.index("-k duplicate_logical_artifact_names")
    assert history_retention_index < weekly_contract_index < duplicate_filter_index
