from pathlib import Path


SCRIPT_PATH = (
    Path(__file__).resolve().parents[1]
    / "scripts"
    / "run_smoke_sales_dashboard_workflow.sh"
)


def test_sales_dashboard_smoke_workflow_exists():
    assert SCRIPT_PATH.exists()


def test_sales_dashboard_smoke_workflow_runs_deterministic_frontend_then_predictive_contract():
    content = SCRIPT_PATH.read_text(encoding="utf-8")
    frontend_index = content.index(
        "CI=true npm --prefix frontend test -- src/pages/SalesIntelligence.test.tsx --watch=false --runInBand"
    )
    predictive_contract_index = content.index(
        "backend/tests/test_predictive_runbook_contract.py"
    )
    assert frontend_index < predictive_contract_index
