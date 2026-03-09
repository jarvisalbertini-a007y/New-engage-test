from pathlib import Path


SCRIPT_PATH = (
    Path(__file__).resolve().parents[1]
    / "scripts"
    / "run_baseline_metrics_artifact_fixture_checks.sh"
)


def test_baseline_metrics_artifact_fixture_workflow_script_exists():
    assert SCRIPT_PATH.exists()


def test_baseline_metrics_artifact_fixture_workflow_runs_generator_then_validator_for_profiles():
    content = SCRIPT_PATH.read_text(encoding="utf-8")
    generator_index = content.index("generate_baseline_metrics_artifact_fixtures.py")
    validator_index = content.index("validate_baseline_metrics_artifact.py")
    healthy_index = content.index("healthy")
    step_failure_index = content.index("step-failure")
    orchestration_unavailable_index = content.index("orchestration-unavailable")
    assert generator_index < validator_index
    assert healthy_index < step_failure_index < orchestration_unavailable_index
