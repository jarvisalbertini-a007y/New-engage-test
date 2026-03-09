from pathlib import Path


SCRIPT_PATH = (
    Path(__file__).resolve().parents[1]
    / "scripts"
    / "run_smoke_connector_credential_lifecycle_workflow.sh"
)


def test_connector_credential_lifecycle_smoke_workflow_exists():
    assert SCRIPT_PATH.exists()


def test_connector_credential_lifecycle_smoke_workflow_runs_expected_smoke_suite():
    content = SCRIPT_PATH.read_text(encoding="utf-8")
    assert "backend/tests/test_connector_credential_lifecycle_smoke.py" in content
