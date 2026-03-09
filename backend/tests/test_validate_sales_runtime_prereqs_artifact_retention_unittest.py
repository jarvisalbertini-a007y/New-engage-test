import json
import subprocess
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[2]
PYTHON_BIN = ROOT_DIR / ".venv311" / "bin" / "python"
SCRIPT_PATH = ROOT_DIR / "backend" / "scripts" / "validate_sales_runtime_prereqs_artifact_retention.py"


def _write_artifact(path: Path, generated_at: datetime, command: str = "verify_sales_runtime_prereqs"):
    payload = {
        "generatedAt": generated_at.isoformat(),
        "command": command,
        "artifact": {
            "validatedAt": generated_at.isoformat(),
            "workspaceRoot": str(ROOT_DIR),
            "requiredCommands": ["bash", "git", "node", "npm"],
            "commandChecks": {"bash": True, "git": True, "node": True, "npm": True},
            "workspaceChecks": {
                "root_exists": True,
                "backend_dir_exists": True,
                "frontend_dir_exists": True,
                "venv_python_exists": True,
            },
            "missingChecks": {"commands": [], "workspace": []},
            "recommendedCommands": [],
            "valid": True,
        },
    }
    path.write_text(json.dumps(payload), encoding="utf-8")


def test_runtime_prereqs_artifact_retention_passes_for_fresh_artifacts():
    with tempfile.TemporaryDirectory() as tmp:
        artifact_dir = Path(tmp)
        now = datetime.now(timezone.utc)
        _write_artifact(artifact_dir / "sales_runtime_prereqs_a.json", now)
        _write_artifact(artifact_dir / "sales_runtime_prereqs_b.json", now)
        _write_artifact(artifact_dir / "sales_runtime_prereqs_c.json", now)

        result = subprocess.run(
            [
                str(PYTHON_BIN),
                str(SCRIPT_PATH),
                "--artifact-dir",
                str(artifact_dir),
                "--prefix",
                "sales_runtime_prereqs",
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


def test_runtime_prereqs_artifact_retention_fails_for_stale_newest_artifact():
    with tempfile.TemporaryDirectory() as tmp:
        artifact_dir = Path(tmp)
        stale = datetime.now(timezone.utc) - timedelta(days=90)
        _write_artifact(artifact_dir / "sales_runtime_prereqs_a.json", stale)

        result = subprocess.run(
            [
                str(PYTHON_BIN),
                str(SCRIPT_PATH),
                "--artifact-dir",
                str(artifact_dir),
                "--prefix",
                "sales_runtime_prereqs",
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
