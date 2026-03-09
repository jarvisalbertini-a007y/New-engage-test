from pathlib import Path


SCRIPTS_DIR = Path(__file__).resolve().parents[1] / "scripts"
TESTS_DIR = Path(__file__).resolve().parent


def _workflow_scripts():
    return sorted(SCRIPTS_DIR.glob("run_smoke_*_workflow.sh"))


def _contract_for_script(script_path: Path) -> Path:
    key = script_path.name.removeprefix("run_smoke_").removesuffix("_workflow.sh")
    return TESTS_DIR / f"test_{key}_workflow_contract.py"


def test_all_smoke_workflow_scripts_have_matching_workflow_contract_tests():
    missing = []
    for script_path in _workflow_scripts():
        contract_path = _contract_for_script(script_path)
        if not contract_path.exists():
            missing.append(
                {
                    "script": script_path.relative_to(SCRIPTS_DIR.parent).as_posix(),
                    "expectedContract": contract_path.relative_to(TESTS_DIR.parent).as_posix(),
                }
            )
    assert not missing, f"Missing smoke workflow contract tests: {missing}"

