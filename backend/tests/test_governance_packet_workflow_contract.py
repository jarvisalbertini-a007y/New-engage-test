from pathlib import Path


SCRIPT_PATH = (
    Path(__file__).resolve().parents[1]
    / "scripts"
    / "run_smoke_governance_packet_workflow.sh"
)


def test_governance_packet_smoke_workflow_exists():
    assert SCRIPT_PATH.exists()


def test_governance_packet_smoke_workflow_runs_expected_smokes_in_order():
    content = SCRIPT_PATH.read_text(encoding="utf-8")
    schema_version_smoke_index = content.index(
        "backend/tests/test_governance_export_schema_version_smoke.py"
    )
    weekly_report_smoke_index = content.index(
        "backend/tests/test_governance_weekly_report_smoke.py"
    )
    connector_pressure_smoke_index = content.index(
        "backend/tests/test_governance_connector_pressure_smoke.py"
    )
    status_normalization_smoke_index = content.index(
        "backend/tests/test_governance_packet_status_normalization_smoke.py"
    )
    runtime_prereqs_smoke_index = content.index(
        "backend/tests/test_governance_packet_runtime_prereqs_smoke.py"
    )
    fixture_generator_unittest_index = content.index(
        "backend/tests/test_generate_governance_packet_validation_artifact_fixtures_unittest.py"
    )
    artifact_validator_unittest_index = content.index(
        "backend/tests/test_validate_governance_packet_validation_artifact_unittest.py"
    )
    artifact_retention_unittest_index = content.index(
        "backend/tests/test_validate_governance_packet_validation_artifact_retention_unittest.py"
    )
    artifact_cleanup_unittest_index = content.index(
        "backend/tests/test_cleanup_governance_packet_validation_artifacts_unittest.py"
    )
    artifact_cleanup_policy_unittest_index = content.index(
        "backend/tests/test_governance_packet_validation_artifact_cleanup_policy_unittest.py"
    )
    artifact_cleanup_guarded_unittest_index = content.index(
        "backend/tests/test_governance_packet_validation_artifact_cleanup_guarded_apply_unittest.py"
    )
    artifact_fixture_workflow_contract_index = content.index(
        "backend/tests/test_governance_packet_artifact_fixture_workflow_contract.py"
    )
    export_guard_smoke_index = content.index(
        "backend/tests/test_governance_export_failure_smoke.py"
    )
    history_retention_smoke_index = content.index(
        "backend/tests/test_governance_history_retention_smoke.py"
    )
    governance_packet_workflow_contract_index = content.index(
        "backend/tests/test_governance_packet_workflow_contract.py"
    )
    fixture_checks_script_index = content.index(
        "bash backend/scripts/run_governance_packet_artifact_fixture_checks.sh"
    )
    assert (
        schema_version_smoke_index
        < weekly_report_smoke_index
        < connector_pressure_smoke_index
        < status_normalization_smoke_index
        < runtime_prereqs_smoke_index
        < fixture_generator_unittest_index
        < artifact_validator_unittest_index
        < artifact_retention_unittest_index
        < artifact_cleanup_unittest_index
        < artifact_cleanup_policy_unittest_index
        < artifact_cleanup_guarded_unittest_index
        < artifact_fixture_workflow_contract_index
        < export_guard_smoke_index
        < history_retention_smoke_index
        < governance_packet_workflow_contract_index
        < fixture_checks_script_index
    )
