from pathlib import Path


SCRIPT_PATH = (
    Path(__file__).resolve().parents[1]
    / "scripts"
    / "run_smoke_health_workflow.sh"
)


def test_health_smoke_workflow_exists():
    assert SCRIPT_PATH.exists()


def test_health_smoke_workflow_runs_expected_health_script():
    content = SCRIPT_PATH.read_text(encoding="utf-8")
    assert "backend/scripts/run_smoke_health.sh" in content
