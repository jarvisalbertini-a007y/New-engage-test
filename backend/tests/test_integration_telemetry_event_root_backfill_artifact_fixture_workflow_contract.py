from pathlib import Path


SCRIPT_PATH = (
    Path(__file__).resolve().parents[1]
    / "scripts"
    / "run_integration_telemetry_event_root_backfill_artifact_fixture_checks.sh"
)


def test_backfill_artifact_fixture_workflow_script_exists():
    assert SCRIPT_PATH.exists()


def test_backfill_artifact_fixture_workflow_runs_generator_then_validator_for_profiles():
    content = SCRIPT_PATH.read_text(encoding="utf-8")
    generator_index = content.index(
        "generate_integration_telemetry_event_root_backfill_artifact_fixtures.py"
    )
    validator_index = content.index(
        "validate_integration_telemetry_event_root_backfill_artifacts.py"
    )
    skip_profile_index = content.index("skip")
    allow_profile_index = content.index("allow")
    action_required_index = content.index("action-required")
    assert generator_index < validator_index
    assert skip_profile_index < allow_profile_index < action_required_index
