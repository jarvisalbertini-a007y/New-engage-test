from pathlib import Path


SCRIPT_PATH = (
    Path(__file__).resolve().parents[1]
    / "scripts"
    / "run_smoke_connector_input_validation_workflow.sh"
)


def test_connector_input_validation_smoke_workflow_exists():
    assert SCRIPT_PATH.exists()


def test_connector_input_validation_smoke_workflow_runs_expected_stages_in_order():
    content = SCRIPT_PATH.read_text(encoding="utf-8")
    parser_unit_index = content.index(
        "backend/tests/test_integrations_reliability_unittest.py -k parse_request_bounded_int"
    )
    http_contract_index = content.index(
        "backend/tests/test_integration_http_contract.py -k \"invalid_limit_returns_400 or invalid_page_returns_400 or does_not_consume_rate_limit\""
    )
    endpoint_smoke_index = content.index(
        "backend/tests/test_connector_endpoint_smoke.py -k invalid"
    )
    telemetry_summary_index = content.index(
        "backend/tests/test_integration_telemetry_summary.py -k connector_input_validation_failures"
    )
    frontend_validation_index = content.index(
        "CI=true npm --prefix frontend test -- src/pages/Integrations.test.tsx src/pages/SalesIntelligence.test.tsx"
    )
    assert (
        parser_unit_index
        < http_contract_index
        < endpoint_smoke_index
        < telemetry_summary_index
        < frontend_validation_index
    )
