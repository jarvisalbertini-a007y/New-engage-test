from pathlib import Path


SCRIPT_PATH = (
    Path(__file__).resolve().parents[1]
    / "scripts"
    / "run_smoke_connector_canary_dry_run_workflow.sh"
)


def test_connector_canary_dry_run_smoke_workflow_exists():
    assert SCRIPT_PATH.exists()


def test_connector_canary_dry_run_smoke_workflow_runs_expected_smoke_suite():
    content = SCRIPT_PATH.read_text(encoding="utf-8")
    assert "backend/tests/test_connector_canary_dry_run_smoke.py" in content
