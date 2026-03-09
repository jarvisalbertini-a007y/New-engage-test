import json
import subprocess
import tempfile
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[2]
SCRIPT_PATH = (
    ROOT_DIR / "backend" / "scripts" / "verify_sales_baseline_command_aliases.py"
)
PYTHON_BIN = ROOT_DIR / ".venv311" / "bin" / "python"


def test_baseline_command_alias_validator_passes_for_repo_defaults():
    result = subprocess.run(
        [str(PYTHON_BIN), str(SCRIPT_PATH)],
        cwd=ROOT_DIR,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0
    payload = json.loads(result.stdout)
    assert payload["valid"] is True
    assert payload["packageJsonExists"] is True
    assert payload["aliasChecks"]["test"]["valid"] is True
    assert payload["aliasChecks"]["typecheck"]["valid"] is True
    assert payload["aliasChecks"]["verify:baseline:quick"]["valid"] is True
    assert payload["aliasChecks"]["verify:smoke:sales"]["valid"] is True


def test_baseline_command_alias_validator_fails_when_required_alias_mismatches():
    result = subprocess.run(
        [
            str(PYTHON_BIN),
            str(SCRIPT_PATH),
            "--require-alias",
            "verify:smoke:sales=bash backend/scripts/nonexistent_workflow.sh",
        ],
        cwd=ROOT_DIR,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 1
    payload = json.loads(result.stdout)
    assert payload["valid"] is False
    assert "verify:smoke:sales" in payload["mismatchedAliases"]


def test_baseline_command_alias_validator_writes_output_artifact():
    with tempfile.TemporaryDirectory() as tmp:
        artifact_path = Path(tmp) / "sales_baseline_command_aliases.json"
        result = subprocess.run(
            [
                str(PYTHON_BIN),
                str(SCRIPT_PATH),
                "--output",
                str(artifact_path),
            ],
            cwd=ROOT_DIR,
            capture_output=True,
            text=True,
            check=False,
        )
        assert result.returncode == 0
        assert artifact_path.exists()

        artifact_payload = json.loads(artifact_path.read_text(encoding="utf-8"))
        assert artifact_payload["command"] == "verify_sales_baseline_command_aliases"
        assert isinstance(artifact_payload["generatedAt"], str)
        assert artifact_payload["artifact"]["valid"] is True
