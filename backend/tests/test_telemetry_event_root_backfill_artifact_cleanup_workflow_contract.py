from pathlib import Path


SCRIPT_PATH = (
    Path(__file__).resolve().parents[1]
    / "scripts"
    / "run_smoke_telemetry_event_root_backfill_artifact_cleanup_workflow.sh"
)


def test_telemetry_event_root_backfill_artifact_cleanup_workflow_exists():
    assert SCRIPT_PATH.exists()


def test_telemetry_event_root_backfill_artifact_cleanup_workflow_runs_expected_steps():
    content = SCRIPT_PATH.read_text(encoding="utf-8")
    retention_unit_index = content.index(
        "test_integration_telemetry_event_root_backfill_artifact_retention_unittest.py"
    )
    cleanup_unit_index = content.index(
        "test_cleanup_integration_telemetry_event_root_backfill_artifacts_unittest.py"
    )
    policy_unit_index = content.index(
        "test_integration_telemetry_event_root_backfill_artifact_cleanup_policy_unittest.py"
    )
    guarded_unit_index = content.index(
        "test_integration_telemetry_event_root_backfill_artifact_cleanup_guarded_apply_unittest.py"
    )
    fixture_checks_index = content.index(
        "run_integration_telemetry_event_root_backfill_artifact_fixture_checks.sh"
    )
    retention_command_index = content.index(
        "validate_integration_telemetry_event_root_backfill_artifact_retention.py"
    )
    cleanup_command_index = content.index(
        "cleanup_integration_telemetry_event_root_backfill_artifacts.py"
    )
    policy_command_index = content.index(
        "evaluate_integration_telemetry_event_root_backfill_artifact_cleanup_policy.py"
    )
    guarded_command_index = content.index(
        "run_integration_telemetry_event_root_backfill_artifact_cleanup_guarded_apply.py"
    )
    assert (
        retention_unit_index
        < cleanup_unit_index
        < policy_unit_index
        < guarded_unit_index
        < fixture_checks_index
        < retention_command_index
        < cleanup_command_index
        < policy_command_index
        < guarded_command_index
    )
