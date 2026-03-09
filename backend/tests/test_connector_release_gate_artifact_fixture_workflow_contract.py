from pathlib import Path


SCRIPT_PATH = (
    Path(__file__).resolve().parents[1]
    / "scripts"
    / "run_release_gate_artifact_fixture_checks.sh"
)


def test_connector_release_gate_artifact_fixture_workflow_exists():
    assert SCRIPT_PATH.exists()


def test_connector_release_gate_artifact_fixture_workflow_runs_expected_steps_in_order():
    content = SCRIPT_PATH.read_text(encoding="utf-8")
    generate_pass_index = content.index("--profile pass")
    validate_pass_index = content.index('validate_connector_release_gate_artifact.py --artifact "$PASS_ARTIFACT"')
    generate_hold_index = content.index("--profile hold")
    validate_hold_index = content.index('validate_connector_release_gate_artifact.py --artifact "$HOLD_ARTIFACT"')
    generate_validation_fail_index = content.index("--profile validation-fail")
    validate_validation_fail_index = content.index(
        'validate_connector_release_gate_artifact.py --artifact "$VALIDATION_FAIL_ARTIFACT"'
    )
    retention_index = content.index("validate_connector_release_gate_artifact_retention.py")
    cleanup_index = content.index("cleanup_connector_release_gate_artifacts.py")
    policy_index = content.index(
        "evaluate_connector_release_gate_artifact_cleanup_policy.py"
    )
    guarded_index = content.index(
        "run_connector_release_gate_artifact_cleanup_guarded_apply.py"
    )

    assert (
        generate_pass_index
        < validate_pass_index
        < generate_hold_index
        < validate_hold_index
        < generate_validation_fail_index
        < validate_validation_fail_index
        < retention_index
        < cleanup_index
        < policy_index
        < guarded_index
    )
