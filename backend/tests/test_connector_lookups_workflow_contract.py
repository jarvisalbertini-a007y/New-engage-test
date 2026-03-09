from pathlib import Path


SCRIPT_PATH = (
    Path(__file__).resolve().parents[1]
    / "scripts"
    / "run_smoke_connector_lookups_workflow.sh"
)


def test_connector_lookups_smoke_workflow_exists():
    assert SCRIPT_PATH.exists()


def test_connector_lookups_smoke_workflow_runs_ui_before_export_workflows():
    content = SCRIPT_PATH.read_text(encoding="utf-8")
    ui_workflow_index = content.index(
        "bash backend/scripts/run_smoke_connector_lookups_ui_workflow.sh"
    )
    export_workflow_index = content.index(
        "bash backend/scripts/run_smoke_connector_lookups_export_workflow.sh"
    )
    assert ui_workflow_index < export_workflow_index
