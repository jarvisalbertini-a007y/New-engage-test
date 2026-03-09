from pathlib import Path


SCRIPT_PATH = (
    Path(__file__).resolve().parents[1]
    / "scripts"
    / "run_smoke_baseline_metrics_artifact_workflow.sh"
)


def test_baseline_metrics_artifact_workflow_exists():
    assert SCRIPT_PATH.exists()


def test_baseline_metrics_artifact_workflow_runs_expected_steps_in_order():
    content = SCRIPT_PATH.read_text(encoding="utf-8")
    tooling_suite_index = content.index("test_baseline_metrics_tooling_unittest.py")
    artifact_contract_suite_index = content.index("test_baseline_metrics_artifact_contract_unittest.py")
    fixture_unit_suite_index = content.index("test_generate_baseline_metrics_artifact_fixtures_unittest.py")
    retention_unit_suite_index = content.index("test_validate_baseline_metrics_artifact_retention_unittest.py")
    cleanup_unit_suite_index = content.index("test_cleanup_baseline_metrics_artifacts_unittest.py")
    cleanup_policy_suite_index = content.index("test_baseline_metrics_artifact_cleanup_policy_unittest.py")
    cleanup_guarded_suite_index = content.index(
        "test_baseline_metrics_artifact_cleanup_guarded_apply_unittest.py"
    )
    fixture_contract_suite_index = content.index(
        "test_baseline_metrics_artifact_fixture_workflow_contract.py"
    )
    workflow_contract_suite_index = content.index(
        "test_baseline_metrics_artifact_workflow_contract.py"
    )
    fixture_workflow_index = content.index("run_baseline_metrics_artifact_fixture_checks.sh")
    generator_index = content.index("generate_baseline_metrics_artifact_fixtures.py")
    validate_artifact_index = content.index("validate_baseline_metrics_artifact.py")
    retention_index = content.index("validate_baseline_metrics_artifact_retention.py")
    cleanup_index = content.index("cleanup_baseline_metrics_artifacts.py")
    policy_index = content.index("evaluate_baseline_metrics_artifact_cleanup_policy.py")
    guarded_index = content.index("run_baseline_metrics_artifact_cleanup_guarded_apply.py")

    assert (
        tooling_suite_index
        < artifact_contract_suite_index
        < fixture_unit_suite_index
        < retention_unit_suite_index
        < cleanup_unit_suite_index
        < cleanup_policy_suite_index
        < cleanup_guarded_suite_index
        < fixture_contract_suite_index
        < workflow_contract_suite_index
        < fixture_workflow_index
        < generator_index
        < validate_artifact_index
        < retention_index
        < cleanup_index
        < policy_index
        < guarded_index
    )
