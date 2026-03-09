from pathlib import Path


SCRIPT_PATH = (
    Path(__file__).resolve().parents[1]
    / "scripts"
    / "run_smoke_frontend_sales_workflow.sh"
)


def test_frontend_sales_workflow_exists():
    assert SCRIPT_PATH.exists()


def test_frontend_sales_workflow_runs_frontend_and_predictive_contract_checks():
    content = SCRIPT_PATH.read_text(encoding="utf-8")
    frontend_index = content.index("npm run verify:frontend:sales")
    predictive_contract_index = content.index(
        "backend/tests/test_predictive_runbook_contract.py"
    )
    assert frontend_index < predictive_contract_index

