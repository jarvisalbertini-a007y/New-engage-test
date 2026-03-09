import importlib.util
import json
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
import tempfile


SCRIPT_PATH = (
    Path(__file__).resolve().parents[1]
    / "scripts"
    / "run_integration_telemetry_event_root_backfill_artifact_cleanup_guarded_apply.py"
)


def _load_script_module():
    spec = importlib.util.spec_from_file_location(
        "run_integration_telemetry_event_root_backfill_artifact_cleanup_guarded_apply",
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


def _build_args(artifact_dir: Path, max_apply_candidates: int = 20):
    class _Args:
        pass

    _Args.artifact_dir = str(artifact_dir)
    _Args.prefix = "integration_telemetry_event_root_backfill"
    _Args.keep_days = 30
    _Args.keep_min_count = 1
    _Args.max_apply_candidates = max_apply_candidates
    return _Args


def test_resolve_guarded_apply_result_returns_nonzero_for_action_required():
    module = _load_script_module()
    exit_code, output = module.resolve_guarded_apply_result(
        {"decision": "ACTION_REQUIRED", "reason": "manual review required"},
        apply_summary=None,
    )
    assert exit_code == 1
    assert output["policy"]["decision"] == "ACTION_REQUIRED"
    assert "apply" not in output


def test_guarded_apply_skips_when_no_stale_candidates():
    module = _load_script_module()
    with tempfile.TemporaryDirectory() as tmp:
        artifact_dir = Path(tmp)
        _write_artifact(
            artifact_dir / "integration_telemetry_event_root_backfill_recent_policy.json",
            datetime.now(timezone.utc),
        )

        original_parse = module.parse_args
        original_env = os.environ.get("BACKFILL_ARTIFACT_CLEANUP_ALLOW_APPLY")
        try:
            module.parse_args = lambda: _build_args(artifact_dir)
            os.environ.pop("BACKFILL_ARTIFACT_CLEANUP_ALLOW_APPLY", None)
            exit_code = module.main()
        finally:
            module.parse_args = original_parse
            if original_env is None:
                os.environ.pop("BACKFILL_ARTIFACT_CLEANUP_ALLOW_APPLY", None)
            else:
                os.environ["BACKFILL_ARTIFACT_CLEANUP_ALLOW_APPLY"] = original_env

        assert exit_code == 0


def test_guarded_apply_blocks_when_policy_requires_action():
    module = _load_script_module()
    with tempfile.TemporaryDirectory() as tmp:
        artifact_dir = Path(tmp)
        now = datetime.now(timezone.utc)
        _write_artifact(
            artifact_dir / "integration_telemetry_event_root_backfill_recent_policy.json",
            now,
        )
        for idx in range(3):
            _write_artifact(
                artifact_dir
                / f"integration_telemetry_event_root_backfill_stale_{idx}_policy.json",
                now - timedelta(days=50 + idx),
            )

        original_parse = module.parse_args
        original_env = os.environ.get("BACKFILL_ARTIFACT_CLEANUP_ALLOW_APPLY")
        try:
            module.parse_args = lambda: _build_args(artifact_dir, max_apply_candidates=2)
            os.environ["BACKFILL_ARTIFACT_CLEANUP_ALLOW_APPLY"] = "true"
            exit_code = module.main()
        finally:
            module.parse_args = original_parse
            if original_env is None:
                os.environ.pop("BACKFILL_ARTIFACT_CLEANUP_ALLOW_APPLY", None)
            else:
                os.environ["BACKFILL_ARTIFACT_CLEANUP_ALLOW_APPLY"] = original_env

        assert exit_code == 1


def test_guarded_apply_executes_when_policy_allows_apply():
    module = _load_script_module()
    with tempfile.TemporaryDirectory() as tmp:
        artifact_dir = Path(tmp)
        now = datetime.now(timezone.utc)
        recent_path = (
            artifact_dir / "integration_telemetry_event_root_backfill_recent_policy.json"
        )
        stale_path = (
            artifact_dir / "integration_telemetry_event_root_backfill_stale_policy.json"
        )
        _write_artifact(recent_path, now)
        _write_artifact(stale_path, now - timedelta(days=60))

        original_parse = module.parse_args
        original_env = os.environ.get("BACKFILL_ARTIFACT_CLEANUP_ALLOW_APPLY")
        try:
            module.parse_args = lambda: _build_args(artifact_dir, max_apply_candidates=5)
            os.environ["BACKFILL_ARTIFACT_CLEANUP_ALLOW_APPLY"] = "true"
            exit_code = module.main()
        finally:
            module.parse_args = original_parse
            if original_env is None:
                os.environ.pop("BACKFILL_ARTIFACT_CLEANUP_ALLOW_APPLY", None)
            else:
                os.environ["BACKFILL_ARTIFACT_CLEANUP_ALLOW_APPLY"] = original_env

        assert exit_code == 0
        assert recent_path.exists()
        assert not stale_path.exists()
