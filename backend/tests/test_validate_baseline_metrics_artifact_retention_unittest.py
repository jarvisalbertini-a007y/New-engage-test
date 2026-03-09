import importlib.util
import json
import subprocess
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[2]
PYTHON_BIN = ROOT_DIR / ".venv311" / "bin" / "python"
SCRIPT_PATH = ROOT_DIR / "backend" / "scripts" / "validate_baseline_metrics_artifact_retention.py"
FIXTURE_SCRIPT_PATH = (
    ROOT_DIR / "backend" / "scripts" / "generate_baseline_metrics_artifact_fixtures.py"
)


def _load_fixture_module():
    spec = importlib.util.spec_from_file_location(
        "generate_baseline_metrics_artifact_fixtures",
        FIXTURE_SCRIPT_PATH,
    )
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def _write_artifact(path: Path, generated_at: datetime):
    fixture_module = _load_fixture_module()
    payload = fixture_module.build_fixture_payload("healthy")
    payload["generatedAt"] = generated_at.isoformat()
    payload["runStartedAt"] = generated_at.isoformat()
    path.write_text(json.dumps(payload), encoding="utf-8")


def test_baseline_metrics_artifact_retention_passes_for_fresh_artifacts():
    with tempfile.TemporaryDirectory() as tmp:
        artifact_dir = Path(tmp)
        now = datetime.now(timezone.utc)
        _write_artifact(artifact_dir / "baseline_metrics_a.json", now)
        _write_artifact(artifact_dir / "baseline_metrics_b.json", now)
        _write_artifact(artifact_dir / "baseline_metrics_c.json", now)

        result = subprocess.run(
            [
                str(PYTHON_BIN),
                str(SCRIPT_PATH),
                "--artifact-dir",
                str(artifact_dir),
                "--prefix",
                "baseline_metrics",
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


def test_baseline_metrics_artifact_retention_fails_for_stale_newest_artifact():
    with tempfile.TemporaryDirectory() as tmp:
        artifact_dir = Path(tmp)
        stale = datetime.now(timezone.utc) - timedelta(days=90)
        _write_artifact(artifact_dir / "baseline_metrics_a.json", stale)

        result = subprocess.run(
            [
                str(PYTHON_BIN),
                str(SCRIPT_PATH),
                "--artifact-dir",
                str(artifact_dir),
                "--prefix",
                "baseline_metrics",
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
