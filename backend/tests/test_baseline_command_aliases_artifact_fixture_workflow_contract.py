from pathlib import Path


SCRIPT_PATH = (
    Path(__file__).resolve().parents[1]
    / "scripts"
    / "run_sales_baseline_command_aliases_artifact_fixture_checks.sh"
)


def test_baseline_command_aliases_artifact_fixture_workflow_script_exists():
    assert SCRIPT_PATH.exists()


def test_baseline_command_aliases_artifact_fixture_workflow_runs_generator_then_validator_for_profiles():
    content = SCRIPT_PATH.read_text(encoding="utf-8")
    generator_index = content.index("generate_sales_baseline_command_aliases_artifact_fixtures.py")
    validator_index = content.index("validate_sales_baseline_command_aliases_artifact.py")
    healthy_index = content.index("healthy")
    missing_alias_index = content.index("missing-alias")
    mismatched_alias_index = content.index("mismatched-alias")
    assert generator_index < validator_index
    assert healthy_index < missing_alias_index < mismatched_alias_index
