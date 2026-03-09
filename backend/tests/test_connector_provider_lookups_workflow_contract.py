from pathlib import Path


SCRIPT_PATH = (
    Path(__file__).resolve().parents[1]
    / "scripts"
    / "run_smoke_connector_provider_lookups_workflow.sh"
)


def test_connector_provider_lookups_smoke_workflow_exists():
    assert SCRIPT_PATH.exists()


def test_connector_provider_lookups_smoke_workflow_runs_expected_suites_in_order():
    content = SCRIPT_PATH.read_text(encoding="utf-8")
    connector_http_contract_index = content.index(
        'backend/tests/test_integration_http_contract.py -k "apollo_search_success or clearbit_search_success or crunchbase_search_success"'
    )
    endpoint_smoke_index = content.index(
        "backend/tests/test_connector_endpoint_smoke.py"
    )
    fixture_contract_index = content.index(
        "backend/tests/test_provider_contract_fixtures.py"
    )
    assert connector_http_contract_index < endpoint_smoke_index < fixture_contract_index
