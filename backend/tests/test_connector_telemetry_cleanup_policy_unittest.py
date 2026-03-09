import importlib.util
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
import tempfile


SCRIPT_PATH = (
    Path(__file__).resolve().parents[1]
    / "scripts"
    / "evaluate_connector_telemetry_cleanup_policy.py"
)


def _load_script_module():
    spec = importlib.util.spec_from_file_location(
        "evaluate_connector_telemetry_cleanup_policy",
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


def test_evaluate_policy_skips_apply_when_no_stale_candidates():
    module = _load_script_module()
    with tempfile.TemporaryDirectory() as tmp:
        snapshot_dir = Path(tmp)
        _write_snapshot(
            snapshot_dir / "connector-telemetry-summary-recent.json",
            datetime.now(timezone.utc),
        )

        result = module.evaluate_policy(
            snapshot_dir=snapshot_dir,
            prefix="connector-telemetry-summary",
            keep_days=30,
            keep_min_count=1,
            max_apply_candidates=20,
        )
        assert result["decision"] == "SKIP_APPLY"
        assert result["snapshot"]["staleCandidateCount"] == 0


def test_evaluate_policy_allows_apply_within_candidate_threshold():
    module = _load_script_module()
    with tempfile.TemporaryDirectory() as tmp:
        snapshot_dir = Path(tmp)
        _write_snapshot(
            snapshot_dir / "connector-telemetry-summary-recent.json",
            datetime.now(timezone.utc),
        )
        _write_snapshot(
            snapshot_dir / "connector-telemetry-summary-stale-a.json",
            datetime.now(timezone.utc) - timedelta(days=45),
        )

        result = module.evaluate_policy(
            snapshot_dir=snapshot_dir,
            prefix="connector-telemetry-summary",
            keep_days=30,
            keep_min_count=1,
            max_apply_candidates=5,
        )
        assert result["decision"] == "ALLOW_APPLY"
        assert result["snapshot"]["staleCandidateCount"] == 1
        assert result["recommendedCommand"] is not None


def test_evaluate_policy_requires_action_when_candidate_count_exceeds_threshold():
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
                datetime.now(timezone.utc) - timedelta(days=60 + idx),
            )

        result = module.evaluate_policy(
            snapshot_dir=snapshot_dir,
            prefix="connector-telemetry-summary",
            keep_days=30,
            keep_min_count=1,
            max_apply_candidates=2,
        )
        assert result["decision"] == "ACTION_REQUIRED"
        assert result["snapshot"]["staleCandidateCount"] == 3


def test_main_returns_nonzero_for_invalid_max_apply_candidates():
    module = _load_script_module()
    with tempfile.TemporaryDirectory() as tmp:
        snapshot_dir = Path(tmp)
        _write_snapshot(
            snapshot_dir / "connector-telemetry-summary-recent.json",
            datetime.now(timezone.utc),
        )

        class _Args:
            pass

        _Args.snapshot_dir = str(snapshot_dir)
        _Args.prefix = "connector-telemetry-summary"
        _Args.keep_days = 30
        _Args.keep_min_count = 1
        _Args.max_apply_candidates = 0

        original_parse = module.parse_args
        try:
            module.parse_args = lambda: _Args
            exit_code = module.main()
        finally:
            module.parse_args = original_parse

        assert exit_code == 1
