from pathlib import Path


SCRIPT_PATH = (
    Path(__file__).resolve().parents[1]
    / "scripts"
    / "run_smoke_telemetry_quality_workflow.sh"
)


def test_telemetry_quality_smoke_workflow_exists():
    assert SCRIPT_PATH.exists()


def test_telemetry_quality_smoke_workflow_runs_stages_in_expected_order():
    content = SCRIPT_PATH.read_text(encoding="utf-8")
    status_filter_workflow_index = content.index(
        "bash backend/scripts/run_smoke_telemetry_status_filter_workflow.sh"
    )
    status_count_workflow_index = content.index(
        "bash backend/scripts/run_smoke_telemetry_status_count_workflow.sh"
    )
    export_distribution_workflow_index = content.index(
        "bash backend/scripts/run_smoke_telemetry_export_distribution_workflow.sh"
    )
    assert (
        status_filter_workflow_index
        < status_count_workflow_index
        < export_distribution_workflow_index
    )
