import json
import subprocess
import tempfile
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[2]
SCRIPT_PATH = ROOT_DIR / "backend" / "scripts" / "verify_sales_runtime_prereqs.py"
PYTHON_BIN = ROOT_DIR / ".venv311" / "bin" / "python"


def test_runtime_prereqs_script_passes_for_default_requirements():
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
    assert isinstance(payload["workspaceRoot"], str)
    assert payload["commandChecks"]["bash"] is True
    assert payload["commandChecks"]["git"] is True
    assert payload["commandChecks"]["node"] is True
    assert payload["commandChecks"]["npm"] is True
    assert payload["missingChecks"]["commands"] == []
    assert payload["missingChecks"]["workspace"] == []


def test_runtime_prereqs_script_fails_when_required_command_is_missing():
    result = subprocess.run(
        [
            str(PYTHON_BIN),
            str(SCRIPT_PATH),
            "--require",
            "definitely_missing_runtime_command_xyz",
        ],
        cwd=ROOT_DIR,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 1
    payload = json.loads(result.stdout)
    assert payload["valid"] is False
    assert payload["commandChecks"]["definitely_missing_runtime_command_xyz"] is False
    assert "definitely_missing_runtime_command_xyz" in payload["missingChecks"]["commands"]
    assert len(payload["recommendedCommands"]) >= 1


def test_runtime_prereqs_script_writes_output_artifact():
    with tempfile.TemporaryDirectory() as tmp:
        artifact_path = Path(tmp) / "sales_runtime_prereqs_artifact.json"
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
        assert artifact_payload["command"] == "verify_sales_runtime_prereqs"
        assert isinstance(artifact_payload["generatedAt"], str)
        assert artifact_payload["artifact"]["valid"] is True
