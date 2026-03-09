from pathlib import Path


SCRIPT_PATH = (
    Path(__file__).resolve().parents[1]
    / "scripts"
    / "run_smoke_sales_runtime_prereqs_artifact_workflow.sh"
)


def test_runtime_prereqs_artifact_workflow_exists():
    assert SCRIPT_PATH.exists()


def test_runtime_prereqs_artifact_workflow_runs_expected_steps_in_order():
    content = SCRIPT_PATH.read_text(encoding="utf-8")
    unit_suite_index = content.index("test_validate_sales_runtime_prereqs_artifact_unittest.py")
    fixture_unit_suite_index = content.index(
        "test_generate_sales_runtime_prereqs_artifact_fixtures_unittest.py"
    )
    fixture_contract_suite_index = content.index(
        "test_sales_runtime_prereqs_artifact_fixture_workflow_contract.py"
    )
    fixture_workflow_index = content.index(
        "run_sales_runtime_prereqs_artifact_fixture_checks.sh"
    )
    verify_artifact_index = content.index("verify_sales_runtime_prereqs.py")
    validate_artifact_index = content.index("validate_sales_runtime_prereqs_artifact.py")
    retention_index = content.index("validate_sales_runtime_prereqs_artifact_retention.py")
    cleanup_index = content.index("cleanup_sales_runtime_prereqs_artifacts.py")
    policy_index = content.index("evaluate_sales_runtime_prereqs_artifact_cleanup_policy.py")
    guarded_index = content.index("run_sales_runtime_prereqs_artifact_cleanup_guarded_apply.py")
    assert (
        unit_suite_index
        < fixture_unit_suite_index
        < fixture_contract_suite_index
        < fixture_workflow_index
        < verify_artifact_index
        < validate_artifact_index
        < retention_index
        < cleanup_index
        < policy_index
        < guarded_index
    )
