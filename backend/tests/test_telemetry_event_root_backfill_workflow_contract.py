from pathlib import Path


SCRIPT_PATH = (
    Path(__file__).resolve().parents[1]
    / "scripts"
    / "run_smoke_telemetry_event_root_backfill_workflow.sh"
)


def test_telemetry_event_root_backfill_smoke_workflow_exists():
    assert SCRIPT_PATH.exists()


def test_telemetry_event_root_backfill_smoke_workflow_runs_unit_and_contract_checks():
    content = SCRIPT_PATH.read_text(encoding="utf-8")
    backfill_unit_index = content.index(
        "backend/tests/test_backfill_integration_telemetry_event_root_contract_unittest.py"
    )
    policy_unit_index = content.index(
        "backend/tests/test_integration_telemetry_event_root_backfill_policy_unittest.py"
    )
    guarded_apply_unit_index = content.index(
        "backend/tests/test_integration_telemetry_event_root_backfill_guarded_apply_unittest.py"
    )
    artifact_contract_unit_index = content.index(
        "backend/tests/test_integration_telemetry_event_root_backfill_artifact_contract_unittest.py"
    )
    fixture_generator_unit_index = content.index(
        "backend/tests/test_generate_integration_telemetry_event_root_backfill_artifact_fixtures_unittest.py"
    )
    fixture_workflow_contract_index = content.index(
        "backend/tests/test_integration_telemetry_event_root_backfill_artifact_fixture_workflow_contract.py"
    )
    fixture_script_index = content.index(
        "bash backend/scripts/run_integration_telemetry_event_root_backfill_artifact_fixture_checks.sh"
    )
    summary_contract_index = content.index("top_level_normalized_contract_fields")
    http_contract_index = content.index("uses_top_level_telemetry_contract_fields")
    assert (
        backfill_unit_index
        < policy_unit_index
        < guarded_apply_unit_index
        < artifact_contract_unit_index
        < fixture_generator_unit_index
        < fixture_workflow_contract_index
        < fixture_script_index
    )
    assert fixture_script_index < summary_contract_index < http_contract_index
