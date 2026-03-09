import importlib.util
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
import tempfile


SCRIPT_PATH = (
    Path(__file__).resolve().parents[1]
    / "scripts"
    / "cleanup_integration_telemetry_event_root_backfill_artifacts.py"
)


def _load_script_module():
    spec = importlib.util.spec_from_file_location(
        "cleanup_integration_telemetry_event_root_backfill_artifacts",
        SCRIPT_PATH,
    )
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def _write_artifact(path: Path, generated_at: datetime):
    path.write_text(
        json.dumps({"generatedAt": generated_at.isoformat()}),
        encoding="utf-8",
    )


def test_plan_cleanup_returns_stale_candidates_while_preserving_keep_min_count():
    module = _load_script_module()
    with tempfile.TemporaryDirectory() as tmp:
        artifact_dir = Path(tmp)
        now = datetime.now(timezone.utc)
        _write_artifact(
            artifact_dir / "integration_telemetry_event_root_backfill_a_policy.json", now
        )
        _write_artifact(
            artifact_dir / "integration_telemetry_event_root_backfill_a_guarded.json", now
        )
        _write_artifact(
            artifact_dir / "integration_telemetry_event_root_backfill_b_policy.json",
            now - timedelta(days=45),
        )
        _write_artifact(
            artifact_dir / "integration_telemetry_event_root_backfill_b_guarded.json",
            now - timedelta(days=50),
        )
        stale = module.plan_cleanup(
            artifact_dir=artifact_dir,
            prefix="integration_telemetry_event_root_backfill",
            keep_days=30,
            keep_min_count=2,
        )
        assert len(stale) == 2


def test_execute_cleanup_dry_run_does_not_delete_files():
    module = _load_script_module()
    with tempfile.TemporaryDirectory() as tmp:
        artifact_dir = Path(tmp)
        stale_path = (
            artifact_dir / "integration_telemetry_event_root_backfill_stale_policy.json"
        )
        _write_artifact(stale_path, datetime.now(timezone.utc) - timedelta(days=60))
        stale = module.plan_cleanup(
            artifact_dir=artifact_dir,
            prefix="integration_telemetry_event_root_backfill",
            keep_days=30,
            keep_min_count=1,
        )
        summary = module.execute_cleanup(stale_records=stale, apply=False)
        assert summary["deletedCount"] == 0
        assert stale_path.exists()


def test_execute_cleanup_apply_deletes_stale_files():
    module = _load_script_module()
    with tempfile.TemporaryDirectory() as tmp:
        artifact_dir = Path(tmp)
        recent_path = (
            artifact_dir / "integration_telemetry_event_root_backfill_recent_policy.json"
        )
        stale_path = (
            artifact_dir / "integration_telemetry_event_root_backfill_stale_policy.json"
        )
        _write_artifact(recent_path, datetime.now(timezone.utc))
        _write_artifact(stale_path, datetime.now(timezone.utc) - timedelta(days=60))
        stale = module.plan_cleanup(
            artifact_dir=artifact_dir,
            prefix="integration_telemetry_event_root_backfill",
            keep_days=30,
            keep_min_count=1,
        )
        summary = module.execute_cleanup(stale_records=stale, apply=True)
        assert summary["deletedCount"] == 1
        assert recent_path.exists()
        assert not stale_path.exists()
