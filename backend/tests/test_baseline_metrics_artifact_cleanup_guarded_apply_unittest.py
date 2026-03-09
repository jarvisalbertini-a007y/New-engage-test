import importlib.util
import json
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
import tempfile


SCRIPT_PATH = (
    Path(__file__).resolve().parents[1]
    / "scripts"
    / "run_baseline_metrics_artifact_cleanup_guarded_apply.py"
)
FIXTURE_SCRIPT_PATH = (
    Path(__file__).resolve().parents[1]
    / "scripts"
    / "generate_baseline_metrics_artifact_fixtures.py"
)


def _load_script_module():
    spec = importlib.util.spec_from_file_location(
        "run_baseline_metrics_artifact_cleanup_guarded_apply",
        SCRIPT_PATH,
    )
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


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


def _build_args(artifact_dir: Path, max_apply_candidates: int = 20):
    class _Args:
        pass

    _Args.artifact_dir = str(artifact_dir)
    _Args.prefix = "baseline_metrics"
    _Args.keep_days = 30
    _Args.keep_min_count = 1
    _Args.max_apply_candidates = max_apply_candidates
    return _Args


def test_baseline_metrics_guarded_apply_result_returns_nonzero_for_action_required():
    module = _load_script_module()
    exit_code, output = module.resolve_guarded_apply_result(
        {"decision": "ACTION_REQUIRED", "reason": "manual review required"},
        apply_summary=None,
    )
    assert exit_code == 1
    assert output["policy"]["decision"] == "ACTION_REQUIRED"


def test_baseline_metrics_guarded_apply_skips_when_no_candidates():
    module = _load_script_module()
    with tempfile.TemporaryDirectory() as tmp:
        artifact_dir = Path(tmp)
        _write_artifact(artifact_dir / "baseline_metrics_recent.json", datetime.now(timezone.utc))

        original_parse = module.parse_args
        original_env = os.environ.get("BASELINE_METRICS_ARTIFACT_CLEANUP_ALLOW_APPLY")
        try:
            module.parse_args = lambda: _build_args(artifact_dir)
            os.environ.pop("BASELINE_METRICS_ARTIFACT_CLEANUP_ALLOW_APPLY", None)
            exit_code = module.main()
        finally:
            module.parse_args = original_parse
            if original_env is None:
                os.environ.pop("BASELINE_METRICS_ARTIFACT_CLEANUP_ALLOW_APPLY", None)
            else:
                os.environ["BASELINE_METRICS_ARTIFACT_CLEANUP_ALLOW_APPLY"] = original_env

        assert exit_code == 0


def test_baseline_metrics_guarded_apply_executes_when_policy_allows_apply():
    module = _load_script_module()
    with tempfile.TemporaryDirectory() as tmp:
        artifact_dir = Path(tmp)
        now = datetime.now(timezone.utc)
        recent_path = artifact_dir / "baseline_metrics_recent.json"
        stale_path = artifact_dir / "baseline_metrics_stale.json"
        _write_artifact(recent_path, now)
        _write_artifact(stale_path, now - timedelta(days=90))

        original_parse = module.parse_args
        original_env = os.environ.get("BASELINE_METRICS_ARTIFACT_CLEANUP_ALLOW_APPLY")
        try:
            module.parse_args = lambda: _build_args(artifact_dir, max_apply_candidates=5)
            os.environ["BASELINE_METRICS_ARTIFACT_CLEANUP_ALLOW_APPLY"] = "true"
            exit_code = module.main()
        finally:
            module.parse_args = original_parse
            if original_env is None:
                os.environ.pop("BASELINE_METRICS_ARTIFACT_CLEANUP_ALLOW_APPLY", None)
            else:
                os.environ["BASELINE_METRICS_ARTIFACT_CLEANUP_ALLOW_APPLY"] = original_env

        assert exit_code == 0
        assert recent_path.exists()
        assert not stale_path.exists()
