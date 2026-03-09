from pathlib import Path


SCRIPT_PATH = (
    Path(__file__).resolve().parents[1]
    / "scripts"
    / "run_smoke_telemetry_status_count_workflow.sh"
)


def test_telemetry_status_count_smoke_workflow_exists():
    assert SCRIPT_PATH.exists()


def test_telemetry_status_count_smoke_workflow_runs_backend_and_frontend_checks():
    content = SCRIPT_PATH.read_text(encoding="utf-8")
    telemetry_summary_provenance_index = content.index(
        "backend/tests/test_integration_telemetry_summary.py -k \"status_count_provenance\""
    )
    telemetry_http_provenance_index = content.index(
        "backend/tests/test_integration_http_contract.py -k \"status_count_provenance\""
    )
    posture_classification_index = content.index(
        "backend/tests/test_telemetry_status_count_posture_unittest.py"
    )
    packet_smoke_index = content.index("backend/tests/test_telemetry_packet_filter_smoke.py")
    distribution_smoke_index = content.index(
        "backend/tests/test_telemetry_export_distribution_smoke.py"
    )
    frontend_helper_index = content.index("src/lib/telemetryStatus.test.ts")
    frontend_api_index = content.index("src/lib/api.test.js")
    helper_pattern_index = content.index(
        "--testNamePattern=\"status-count provenance|classifyTelemetryStatusCountProvenance|resolveTelemetryStatusCountPosture|telemetry status-count provenance and posture payload fields unchanged\""
    )
    frontend_integrations_index = content.index("src/pages/Integrations.test.tsx")
    frontend_sales_index = content.index("src/pages/SalesIntelligence.test.tsx")
    page_pattern_index = content.index(
        "--testNamePattern=\"status-count|invalid posture metadata\""
    )
    assert (
        telemetry_summary_provenance_index
        < telemetry_http_provenance_index
        < posture_classification_index
        < packet_smoke_index
    )
    assert packet_smoke_index < distribution_smoke_index < frontend_helper_index
    assert frontend_helper_index < frontend_api_index < helper_pattern_index
    assert helper_pattern_index < frontend_integrations_index
    assert frontend_integrations_index < frontend_sales_index < page_pattern_index
