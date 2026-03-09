from pathlib import Path


SCRIPT_PATH = (
    Path(__file__).resolve().parents[1]
    / "scripts"
    / "run_sales_runtime_prereqs_artifact_fixture_checks.sh"
)


def test_runtime_prereqs_artifact_fixture_workflow_script_exists():
    assert SCRIPT_PATH.exists()


def test_runtime_prereqs_artifact_fixture_workflow_runs_generator_then_validator_for_profiles():
    content = SCRIPT_PATH.read_text(encoding="utf-8")
    generator_index = content.index("generate_sales_runtime_prereqs_artifact_fixtures.py")
    validator_index = content.index("validate_sales_runtime_prereqs_artifact.py")
    healthy_index = content.index("healthy")
    missing_command_index = content.index("missing-command")
    missing_workspace_index = content.index("missing-workspace")
    assert generator_index < validator_index
    assert healthy_index < missing_command_index < missing_workspace_index
