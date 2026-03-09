from pathlib import Path


SCRIPT_PATH = (
    Path(__file__).resolve().parents[1]
    / "scripts"
    / "run_smoke_telemetry_status_filter_workflow.sh"
)


def test_telemetry_status_filter_smoke_workflow_exists():
    assert SCRIPT_PATH.exists()


def test_telemetry_status_filter_smoke_workflow_runs_backend_and_frontend_checks():
    content = SCRIPT_PATH.read_text(encoding="utf-8")
    backend_smoke_index = content.index("backend/tests/test_telemetry_packet_filter_smoke.py")
    frontend_integrations_index = content.index("src/pages/Integrations.test.tsx")
    frontend_sales_index = content.index("src/pages/SalesIntelligence.test.tsx")
    pattern_index = content.index("--testNamePattern=\"status-filter\"")
    assert backend_smoke_index < frontend_integrations_index < frontend_sales_index
    assert frontend_sales_index < pattern_index
