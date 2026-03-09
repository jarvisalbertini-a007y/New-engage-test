from pathlib import Path


SCRIPT_PATH = (
    Path(__file__).resolve().parents[1]
    / "scripts"
    / "run_governance_packet_artifact_fixture_checks.sh"
)


def test_governance_packet_artifact_fixture_workflow_script_exists():
    assert SCRIPT_PATH.exists()


def test_governance_packet_artifact_fixture_workflow_runs_generator_then_contract_and_cleanup_steps():
    content = SCRIPT_PATH.read_text(encoding="utf-8")
    generator_index = content.index("generate_governance_packet_validation_artifact_fixtures.py")
    validator_index = content.index("validate_governance_packet_validation_artifact.py")
    ready_index = content.index("ready")
    action_required_index = content.index("action-required")
    validation_fail_index = content.index("validation-fail")
    retention_index = content.index("validate_governance_packet_validation_artifact_retention.py")
    cleanup_index = content.index("cleanup_governance_packet_validation_artifacts.py")
    policy_index = content.index(
        "evaluate_governance_packet_validation_artifact_cleanup_policy.py"
    )
    guarded_index = content.index(
        "run_governance_packet_validation_artifact_cleanup_guarded_apply.py"
    )

    assert generator_index < validator_index < retention_index < cleanup_index < policy_index < guarded_index
    assert ready_index < action_required_index < validation_fail_index
