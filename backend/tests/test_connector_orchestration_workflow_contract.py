from pathlib import Path


SCRIPT_PATH = (
    Path(__file__).resolve().parents[1]
    / "scripts"
    / "run_smoke_connector_orchestration_workflow.sh"
)


def test_connector_orchestration_smoke_workflow_exists():
    assert SCRIPT_PATH.exists()


def test_connector_orchestration_smoke_workflow_runs_expected_suites_in_order():
    content = SCRIPT_PATH.read_text(encoding="utf-8")
    orchestration_http_contract_index = content.index(
        "backend/tests/test_integration_http_contract.py::test_http_orchestration_returns_provider_order_diagnostics"
    )
    orchestration_unit_index = content.index(
        "backend/tests/test_connector_orchestration_unittest.py"
    )
    assert orchestration_http_contract_index < orchestration_unit_index
