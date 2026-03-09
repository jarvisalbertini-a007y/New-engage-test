import importlib.util
import json
import subprocess
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[2]
PYTHON_BIN = ROOT_DIR / ".venv311" / "bin" / "python"
RETENTION_SCRIPT_PATH = (
    ROOT_DIR
    / "backend"
    / "scripts"
    / "validate_governance_packet_validation_artifact_retention.py"
)
VALIDATOR_SCRIPT_PATH = (
    ROOT_DIR
    / "backend"
    / "scripts"
    / "validate_governance_packet_validation_artifact.py"
)


def _load_validator_module():
    spec = importlib.util.spec_from_file_location(
        "validate_governance_packet_validation_artifact",
        VALIDATOR_SCRIPT_PATH,
    )
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def _write_artifact(path: Path, validated_at: datetime):
    validator_module = _load_validator_module()
    payload = {
        "validatedAt": validated_at.isoformat(),
        "checks": {
            "handoff": {"statusPresent": True},
            "history": {"statusPresent": True},
            "crossArtifact": {"statusConsistency": True},
        },
        "errors": [],
        "valid": True,
    }
    assert validator_module.validate_artifact(payload) == []
    path.write_text(json.dumps(payload), encoding="utf-8")


def test_governance_packet_validation_artifact_retention_passes_for_fresh_artifacts():
    with tempfile.TemporaryDirectory() as tmp:
        artifact_dir = Path(tmp)
        now = datetime.now(timezone.utc)
        _write_artifact(artifact_dir / "governance_packet_validation_fixture_ready.json", now)
        _write_artifact(artifact_dir / "governance_packet_validation_fixture_action_required.json", now)
        _write_artifact(artifact_dir / "governance_packet_validation_fixture_validation_fail.json", now)

        result = subprocess.run(
            [
                str(PYTHON_BIN),
                str(RETENTION_SCRIPT_PATH),
                "--artifact-dir",
                str(artifact_dir),
                "--prefix",
                "governance_packet_validation_fixture",
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


def test_governance_packet_validation_artifact_retention_fails_for_stale_newest_artifact():
    with tempfile.TemporaryDirectory() as tmp:
        artifact_dir = Path(tmp)
        stale = datetime.now(timezone.utc) - timedelta(days=90)
        _write_artifact(
            artifact_dir / "governance_packet_validation_fixture_ready.json",
            stale,
        )

        result = subprocess.run(
            [
                str(PYTHON_BIN),
                str(RETENTION_SCRIPT_PATH),
                "--artifact-dir",
                str(artifact_dir),
                "--prefix",
                "governance_packet_validation_fixture",
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
