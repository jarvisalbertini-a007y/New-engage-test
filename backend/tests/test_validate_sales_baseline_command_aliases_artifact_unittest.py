import json
import subprocess
import tempfile
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[2]
PYTHON_BIN = ROOT_DIR / ".venv311" / "bin" / "python"
VERIFY_SCRIPT = ROOT_DIR / "backend" / "scripts" / "verify_sales_baseline_command_aliases.py"
VALIDATE_SCRIPT = ROOT_DIR / "backend" / "scripts" / "validate_sales_baseline_command_aliases_artifact.py"


def test_baseline_command_aliases_artifact_validator_passes_for_generated_artifact():
    with tempfile.TemporaryDirectory() as tmp:
        artifact_path = Path(tmp) / "sales_baseline_command_aliases_fixture.json"
        generate = subprocess.run(
            [str(PYTHON_BIN), str(VERIFY_SCRIPT), "--output", str(artifact_path)],
            cwd=ROOT_DIR,
            capture_output=True,
            text=True,
            check=False,
        )
        assert generate.returncode == 0

        validate = subprocess.run(
            [str(PYTHON_BIN), str(VALIDATE_SCRIPT), "--artifact", str(artifact_path)],
            cwd=ROOT_DIR,
            capture_output=True,
            text=True,
            check=False,
        )
        assert validate.returncode == 0
        payload = json.loads(validate.stdout)
        assert payload["status"] == "pass"


def test_baseline_command_aliases_artifact_validator_fails_on_malformed_payload():
    with tempfile.TemporaryDirectory() as tmp:
        artifact_path = Path(tmp) / "invalid_baseline_command_aliases.json"
        artifact_path.write_text(
            json.dumps({"generatedAt": "2026-02-27T00:00:00+00:00", "command": "x"}),
            encoding="utf-8",
        )

        validate = subprocess.run(
            [str(PYTHON_BIN), str(VALIDATE_SCRIPT), "--artifact", str(artifact_path)],
            cwd=ROOT_DIR,
            capture_output=True,
            text=True,
            check=False,
        )
        assert validate.returncode == 1
        payload = json.loads(validate.stdout)
        assert payload["status"] == "fail"
        assert payload["errorCount"] >= 1
