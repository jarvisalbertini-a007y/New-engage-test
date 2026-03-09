from pathlib import Path


SCRIPT_PATH = (
    Path(__file__).resolve().parents[1]
    / "scripts"
    / "run_smoke_telemetry_export_distribution_workflow.sh"
)


def test_telemetry_export_distribution_smoke_workflow_exists():
    assert SCRIPT_PATH.exists()


def test_telemetry_export_distribution_smoke_workflow_runs_distribution_smoke_suite():
    content = SCRIPT_PATH.read_text(encoding="utf-8")
    assert "backend/tests/test_telemetry_export_distribution_smoke.py" in content
