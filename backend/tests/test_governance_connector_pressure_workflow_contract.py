from pathlib import Path


SCRIPT_PATH = (
    Path(__file__).resolve().parents[1]
    / "scripts"
    / "run_smoke_governance_connector_pressure_workflow.sh"
)


def test_governance_connector_pressure_smoke_workflow_exists():
    assert SCRIPT_PATH.exists()


def test_governance_connector_pressure_smoke_workflow_runs_expected_smoke_suite():
    content = SCRIPT_PATH.read_text(encoding="utf-8")
    assert "backend/tests/test_governance_connector_pressure_smoke.py" in content
