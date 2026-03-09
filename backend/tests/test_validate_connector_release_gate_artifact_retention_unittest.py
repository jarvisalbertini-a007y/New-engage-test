import importlib.util
import json
import subprocess
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[2]
PYTHON_BIN = ROOT_DIR / ".venv311" / "bin" / "python"
SCRIPT_PATH = (
    ROOT_DIR
    / "backend"
    / "scripts"
    / "validate_connector_release_gate_artifact_retention.py"
)
FIXTURE_SCRIPT_PATH = (
    ROOT_DIR
    / "backend"
    / "scripts"
    / "generate_connector_release_gate_artifact_fixture.py"
)


def _load_fixture_module():
    spec = importlib.util.spec_from_file_location(
        "generate_connector_release_gate_artifact_fixture",
        FIXTURE_SCRIPT_PATH,
    )
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def _write_artifact(path: Path, evaluated_at: datetime):
    fixture_module = _load_fixture_module()
    payload = fixture_module.build_fixture_payload("pass")
    payload["evaluatedAt"] = evaluated_at.isoformat()
    path.write_text(json.dumps(payload), encoding="utf-8")


def test_connector_release_gate_artifact_retention_passes_for_fresh_artifacts():
    with tempfile.TemporaryDirectory() as tmp:
        artifact_dir = Path(tmp)
        now = datetime.now(timezone.utc)
        _write_artifact(artifact_dir / "connector_release_gate_result_a.json", now)
        _write_artifact(artifact_dir / "connector_release_gate_result_b.json", now)
        _write_artifact(artifact_dir / "connector_release_gate_result_c.json", now)

        result = subprocess.run(
            [
                str(PYTHON_BIN),
                str(SCRIPT_PATH),
                "--artifact-dir",
                str(artifact_dir),
                "--prefix",
                "connector_release_gate_result",
                "--min-count",
                "3",
                "--max-age-days",
                "30",
            ],
            cwd=ROOT_DIR,
            capture_output=True,
            text=True,
            check=False,
        )
        assert result.returncode == 0


def test_connector_release_gate_artifact_retention_fails_for_stale_newest_artifact():
    with tempfile.TemporaryDirectory() as tmp:
        artifact_dir = Path(tmp)
        stale = datetime.now(timezone.utc) - timedelta(days=90)
        _write_artifact(artifact_dir / "connector_release_gate_result_a.json", stale)

        result = subprocess.run(
            [
                str(PYTHON_BIN),
                str(SCRIPT_PATH),
                "--artifact-dir",
                str(artifact_dir),
                "--prefix",
                "connector_release_gate_result",
                "--min-count",
                "1",
                "--max-age-days",
                "30",
            ],
            cwd=ROOT_DIR,
            capture_output=True,
            text=True,
            check=False,
        )
        assert result.returncode == 1
        assert "older than" in (result.stdout + result.stderr)
