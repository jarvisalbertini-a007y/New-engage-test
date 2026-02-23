import json
from pathlib import Path
import subprocess
import tempfile


ROOT_DIR = Path(__file__).resolve().parents[2]
PACKAGE_JSON_PATH = ROOT_DIR / "package.json"
VALIDATOR_PATH = ROOT_DIR / "backend" / "scripts" / "validate_connector_telemetry_snapshot.py"
PYTHON_BIN = ROOT_DIR / ".venv311" / "bin" / "python"


def _scripts():
    payload = json.loads(PACKAGE_JSON_PATH.read_text(encoding="utf-8"))
    return payload.get("scripts", {})


def test_extended_ci_chain_includes_traceability_verification_gate():
    scripts = _scripts()
    extended = scripts.get("verify:ci:sales:extended", "")
    assert "npm run verify:telemetry:traceability" in extended
    assert "npm run verify:telemetry:traceability:cleanup:policy" in extended
    assert "npm run verify:smoke:traceability-governance-handoff" in extended


def test_traceability_contract_command_fails_on_invalid_snapshot():
    with tempfile.TemporaryDirectory() as tmp:
        snapshot_path = Path(tmp) / "invalid-snapshot.json"
        snapshot_path.write_text(json.dumps({"eventCount": 1}), encoding="utf-8")
        result = subprocess.run(
            [
                str(PYTHON_BIN),
                str(VALIDATOR_PATH),
                "--snapshot",
                str(snapshot_path),
            ],
            cwd=ROOT_DIR,
            capture_output=True,
            text=True,
            check=False,
        )
        assert result.returncode == 1
        assert "validation failed" in (result.stdout + result.stderr).lower()
