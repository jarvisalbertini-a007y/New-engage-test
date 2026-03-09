from pathlib import Path


SCRIPT_PATH = (
    Path(__file__).resolve().parents[1]
    / "scripts"
    / "run_smoke_baseline_command_aliases_workflow.sh"
)


def test_baseline_command_aliases_workflow_exists():
    assert SCRIPT_PATH.exists()


def test_baseline_command_aliases_workflow_runs_expected_steps_in_order():
    content = SCRIPT_PATH.read_text(encoding="utf-8")
    validator_unit_index = content.index(
        "test_verify_sales_baseline_command_aliases_unittest.py"
    )
    workflow_contract_index = content.index(
        "test_baseline_command_aliases_workflow_contract.py"
    )
    package_contract_index = content.index(
        "test_baseline_command_chain_contract.py"
    )
    validator_command_index = content.index("verify_sales_baseline_command_aliases.py")
    artifact_output_index = content.index("sales_baseline_command_aliases.json")
    assert (
        validator_unit_index
        < workflow_contract_index
        < package_contract_index
        < validator_command_index
        < artifact_output_index
    )
