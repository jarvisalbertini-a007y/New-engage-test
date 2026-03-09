from pathlib import Path


SCRIPT_PATH = (
    Path(__file__).resolve().parents[1]
    / "scripts"
    / "run_smoke_workflow_contracts_workflow.sh"
)


def test_workflow_contracts_smoke_workflow_exists():
    assert SCRIPT_PATH.exists()


def test_workflow_contracts_smoke_workflow_runs_expected_contract_suite():
    content = SCRIPT_PATH.read_text(encoding="utf-8")
    assert "backend/tests/test_smoke_workflow_contract_coverage.py" in content
