import importlib.util
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
import tempfile


SCRIPT_PATH = (
    Path(__file__).resolve().parents[1]
    / "scripts"
    / "run_connector_governance_weekly_cleanup_guarded_apply.py"
)


def _load_script_module():
    spec = importlib.util.spec_from_file_location(
        "run_connector_governance_weekly_cleanup_guarded_apply",
        SCRIPT_PATH,
    )
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def _write_report(path: Path, generated_at: datetime):
    path.write_text(
        json.dumps({"generatedAt": generated_at.isoformat()}),
        encoding="utf-8",
    )


def _build_args(artifact_dir: Path, max_apply_candidates: int = 20):
    class _Args:
        pass

    _Args.artifact_dir = str(artifact_dir)
    _Args.prefix = "connector_governance_weekly_report"
    _Args.keep_days = 30
    _Args.keep_min_count = 1
    _Args.max_apply_candidates = max_apply_candidates
    return _Args


def test_guarded_apply_skips_when_no_stale_candidates():
    module = _load_script_module()
    with tempfile.TemporaryDirectory() as tmp:
        artifact_dir = Path(tmp)
        _write_report(
            artifact_dir / "connector_governance_weekly_report_recent.json",
            datetime.now(timezone.utc),
        )

        original_parse = module.parse_args
        try:
            module.parse_args = lambda: _build_args(artifact_dir)
            exit_code = module.main()
        finally:
            module.parse_args = original_parse

        assert exit_code == 0
        assert (
            artifact_dir / "connector_governance_weekly_report_recent.json"
        ).exists()


def test_guarded_apply_blocks_when_policy_requires_action():
    module = _load_script_module()
    with tempfile.TemporaryDirectory() as tmp:
        artifact_dir = Path(tmp)
        _write_report(
            artifact_dir / "connector_governance_weekly_report_recent.json",
            datetime.now(timezone.utc),
        )
        for idx in range(3):
            _write_report(
                artifact_dir / f"connector_governance_weekly_report_stale_{idx}.json",
                datetime.now(timezone.utc) - timedelta(days=45 + idx),
            )

        original_parse = module.parse_args
        try:
            module.parse_args = lambda: _build_args(artifact_dir, max_apply_candidates=2)
            exit_code = module.main()
        finally:
            module.parse_args = original_parse

        assert exit_code == 1
        assert (
            artifact_dir / "connector_governance_weekly_report_stale_0.json"
        ).exists()


def test_guarded_apply_executes_when_policy_allows_apply():
    module = _load_script_module()
    with tempfile.TemporaryDirectory() as tmp:
        artifact_dir = Path(tmp)
        _write_report(
            artifact_dir / "connector_governance_weekly_report_recent.json",
            datetime.now(timezone.utc),
        )
        stale_path = artifact_dir / "connector_governance_weekly_report_stale.json"
        _write_report(
            stale_path,
            datetime.now(timezone.utc) - timedelta(days=60),
        )

        original_parse = module.parse_args
        try:
            module.parse_args = lambda: _build_args(artifact_dir, max_apply_candidates=5)
            exit_code = module.main()
        finally:
            module.parse_args = original_parse

        assert exit_code == 0
        assert not stale_path.exists()
