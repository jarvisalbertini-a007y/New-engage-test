from pathlib import Path


SCRIPT_PATH = (
    Path(__file__).resolve().parents[1]
    / "scripts"
    / "run_smoke_governance_schema_endpoint_workflow.sh"
)


def test_governance_schema_endpoint_smoke_workflow_exists():
    assert SCRIPT_PATH.exists()


def test_governance_schema_endpoint_smoke_workflow_runs_contract_and_parity_smokes():
    content = SCRIPT_PATH.read_text(encoding="utf-8")
    contract_index = content.index("backend/tests/test_integration_http_contract.py")
    contract_filter_index = content.index("governance_schema_metadata_endpoint")
    parity_smoke_index = content.index(
        "backend/tests/test_governance_schema_parity_smoke.py"
    )
    assert contract_index < contract_filter_index < parity_smoke_index
