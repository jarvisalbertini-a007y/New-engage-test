from pathlib import Path


SCRIPT_PATH = (
    Path(__file__).resolve().parents[1]
    / "scripts"
    / "run_smoke_connector_release_gate_workflow.sh"
)


def test_connector_release_gate_smoke_workflow_exists():
    assert SCRIPT_PATH.exists()


def test_connector_release_gate_smoke_workflow_runs_release_gate_suites_then_fixture_workflow():
    content = SCRIPT_PATH.read_text(encoding="utf-8")
    smoke_index = content.index("backend/tests/test_connector_release_gate_smoke.py")
    fixture_unit_index = content.index(
        "backend/tests/test_connector_release_gate_artifact_fixture_unittest.py"
    )
    artifact_contract_unit_index = content.index(
        "backend/tests/test_connector_release_gate_artifact_contract_unittest.py"
    )
    retention_unit_index = content.index(
        "backend/tests/test_validate_connector_release_gate_artifact_retention_unittest.py"
    )
    cleanup_unit_index = content.index(
        "backend/tests/test_cleanup_connector_release_gate_artifacts_unittest.py"
    )
    cleanup_policy_unit_index = content.index(
        "backend/tests/test_connector_release_gate_artifact_cleanup_policy_unittest.py"
    )
    guarded_apply_unit_index = content.index(
        "backend/tests/test_connector_release_gate_artifact_cleanup_guarded_apply_unittest.py"
    )
    fixture_workflow_contract_index = content.index(
        "backend/tests/test_connector_release_gate_artifact_fixture_workflow_contract.py"
    )
    smoke_workflow_contract_index = content.index(
        "backend/tests/test_connector_release_gate_workflow_contract.py"
    )
    fixture_workflow_index = content.index(
        "bash backend/scripts/run_release_gate_artifact_fixture_checks.sh"
    )
    assert (
        smoke_index
        < fixture_unit_index
        < artifact_contract_unit_index
        < retention_unit_index
        < cleanup_unit_index
        < cleanup_policy_unit_index
        < guarded_apply_unit_index
        < fixture_workflow_contract_index
        < smoke_workflow_contract_index
        < fixture_workflow_index
    )
