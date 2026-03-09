import importlib.util
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
import tempfile


SCRIPT_PATH = (
    Path(__file__).resolve().parents[1]
    / "scripts"
    / "cleanup_sales_baseline_command_aliases_artifacts.py"
)


def _load_script_module():
    spec = importlib.util.spec_from_file_location(
        "cleanup_sales_baseline_command_aliases_artifacts",
        SCRIPT_PATH,
    )
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def _write_artifact(path: Path, generated_at: datetime, command: str = "verify_sales_baseline_command_aliases"):
    path.write_text(
        json.dumps(
            {
                "generatedAt": generated_at.isoformat(),
                "command": command,
                "artifact": {
                    "validatedAt": generated_at.isoformat(),
                    "workspaceRoot": str(path.parent),
                    "requiredCommands": ["bash"],
                    "commandChecks": {"bash": True},
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
        ),
        encoding="utf-8",
    )


def test_baseline_command_aliases_cleanup_dry_run_marks_stale_and_invalid_command_candidates():
    module = _load_script_module()
    with tempfile.TemporaryDirectory() as tmp:
        artifact_dir = Path(tmp)
        now = datetime.now(timezone.utc)
        _write_artifact(artifact_dir / "sales_baseline_command_aliases_recent.json", now)
        _write_artifact(
            artifact_dir / "sales_baseline_command_aliases_stale.json",
            now - timedelta(days=90),
        )
        _write_artifact(
            artifact_dir / "sales_baseline_command_aliases_bad_command.json",
            now,
            command="unexpected_runtime_check",
        )

        summary = module.run_cleanup(
            artifact_dir=artifact_dir,
            prefix="sales_baseline_command_aliases",
            keep_days=30,
            keep_min_count=1,
            apply=False,
        )
        assert summary["mode"] == "dry-run"
        assert summary["candidateCount"] == 2
        assert summary["deletedCount"] == 0


def test_baseline_command_aliases_cleanup_apply_deletes_candidates():
    module = _load_script_module()
    with tempfile.TemporaryDirectory() as tmp:
        artifact_dir = Path(tmp)
        now = datetime.now(timezone.utc)
        keep_path = artifact_dir / "sales_baseline_command_aliases_keep.json"
        stale_path = artifact_dir / "sales_baseline_command_aliases_stale.json"
        _write_artifact(keep_path, now)
        _write_artifact(stale_path, now - timedelta(days=90))

        summary = module.run_cleanup(
            artifact_dir=artifact_dir,
            prefix="sales_baseline_command_aliases",
            keep_days=30,
            keep_min_count=1,
            apply=True,
        )
        assert summary["mode"] == "apply"
        assert summary["candidateCount"] == 1
        assert summary["deletedCount"] == 1
        assert keep_path.exists()
        assert not stale_path.exists()
