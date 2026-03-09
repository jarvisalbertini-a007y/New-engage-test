import importlib.util
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
import tempfile


SCRIPT_PATH = (
    Path(__file__).resolve().parents[1]
    / "scripts"
    / "run_connector_telemetry_cleanup_guarded_apply.py"
)


def _load_script_module():
    spec = importlib.util.spec_from_file_location(
        "run_connector_telemetry_cleanup_guarded_apply",
        SCRIPT_PATH,
    )
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def _write_snapshot(path: Path, generated_at: datetime):
    path.write_text(
        json.dumps({"generatedAt": generated_at.isoformat()}),
        encoding="utf-8",
    )


def _build_args(snapshot_dir: Path, max_apply_candidates: int = 20):
    class _Args:
        pass

    _Args.snapshot_dir = str(snapshot_dir)
    _Args.prefix = "connector-telemetry-summary"
    _Args.keep_days = 30
    _Args.keep_min_count = 1
    _Args.max_apply_candidates = max_apply_candidates
    return _Args


def test_guarded_apply_skips_when_no_stale_candidates():
    module = _load_script_module()
    with tempfile.TemporaryDirectory() as tmp:
        snapshot_dir = Path(tmp)
        _write_snapshot(
            snapshot_dir / "connector-telemetry-summary-recent.json",
            datetime.now(timezone.utc),
        )

        original_parse = module.parse_args
        try:
            module.parse_args = lambda: _build_args(snapshot_dir)
            exit_code = module.main()
        finally:
            module.parse_args = original_parse

        assert exit_code == 0
        assert (snapshot_dir / "connector-telemetry-summary-recent.json").exists()


def test_guarded_apply_blocks_when_policy_requires_action():
    module = _load_script_module()
    with tempfile.TemporaryDirectory() as tmp:
        snapshot_dir = Path(tmp)
        _write_snapshot(
            snapshot_dir / "connector-telemetry-summary-recent.json",
            datetime.now(timezone.utc),
        )
        for idx in range(3):
            _write_snapshot(
                snapshot_dir / f"connector-telemetry-summary-stale-{idx}.json",
                datetime.now(timezone.utc) - timedelta(days=45 + idx),
            )

        original_parse = module.parse_args
        try:
            module.parse_args = lambda: _build_args(snapshot_dir, max_apply_candidates=2)
            exit_code = module.main()
        finally:
            module.parse_args = original_parse

        assert exit_code == 1
        assert (snapshot_dir / "connector-telemetry-summary-stale-0.json").exists()


def test_guarded_apply_executes_when_policy_allows_apply():
    module = _load_script_module()
    with tempfile.TemporaryDirectory() as tmp:
        snapshot_dir = Path(tmp)
        _write_snapshot(
            snapshot_dir / "connector-telemetry-summary-recent.json",
            datetime.now(timezone.utc),
        )
        stale_path = snapshot_dir / "connector-telemetry-summary-stale.json"
        _write_snapshot(
            stale_path,
            datetime.now(timezone.utc) - timedelta(days=60),
        )

        original_parse = module.parse_args
        try:
            module.parse_args = lambda: _build_args(snapshot_dir, max_apply_candidates=5)
            exit_code = module.main()
        finally:
            module.parse_args = original_parse

        assert exit_code == 0
        assert not stale_path.exists()
