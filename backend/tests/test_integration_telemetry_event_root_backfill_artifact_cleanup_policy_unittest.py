import importlib.util
import json
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
import tempfile


SCRIPT_PATH = (
    Path(__file__).resolve().parents[1]
    / "scripts"
    / "evaluate_integration_telemetry_event_root_backfill_artifact_cleanup_policy.py"
)


def _load_script_module():
    spec = importlib.util.spec_from_file_location(
        "evaluate_integration_telemetry_event_root_backfill_artifact_cleanup_policy",
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


def test_policy_skips_apply_when_no_stale_candidates():
    module = _load_script_module()
    result = module.evaluate_policy_from_summary(
        {"candidateCount": 0, "mode": "dry-run"},
        max_apply_candidates=20,
        allow_apply_flag=False,
    )
    assert result["decision"] == "SKIP_APPLY"
    assert result["recommendedCommand"] is None


def test_policy_requires_manual_action_when_candidate_count_exceeds_threshold():
    module = _load_script_module()
    result = module.evaluate_policy_from_summary(
        {"candidateCount": 21, "mode": "dry-run"},
        max_apply_candidates=20,
        allow_apply_flag=True,
    )
    assert result["decision"] == "ACTION_REQUIRED"
    assert "keep-days 7" in result["recommendedCommand"]


def test_policy_requires_allow_apply_env_flag_for_unattended_cleanup():
    module = _load_script_module()
    result = module.evaluate_policy_from_summary(
        {"candidateCount": 3, "mode": "dry-run"},
        max_apply_candidates=20,
        allow_apply_flag=False,
    )
    assert result["decision"] == "ACTION_REQUIRED"
    assert module.ALLOW_APPLY_ENV_VAR in result["reason"]
    assert module.ALLOW_APPLY_ENV_VAR in result["recommendedCommand"]


def test_policy_allows_apply_when_threshold_and_flag_pass():
    module = _load_script_module()
    result = module.evaluate_policy_from_summary(
        {"candidateCount": 3, "mode": "dry-run"},
        max_apply_candidates=20,
        allow_apply_flag=True,
    )
    assert result["decision"] == "ALLOW_APPLY"
    assert "cleanup:apply:guarded" in result["recommendedCommand"]


def test_main_returns_success_for_skip_apply_path():
    module = _load_script_module()
    with tempfile.TemporaryDirectory() as tmp:
        artifact_dir = Path(tmp)
        _write_artifact(
            artifact_dir / "integration_telemetry_event_root_backfill_recent_policy.json",
            datetime.now(timezone.utc),
        )

        class _Args:
            pass

        _Args.artifact_dir = str(artifact_dir)
        _Args.prefix = "integration_telemetry_event_root_backfill"
        _Args.keep_days = 30
        _Args.keep_min_count = 1
        _Args.max_apply_candidates = 20

        original_parse = module.parse_args
        original_env = os.environ.get(module.ALLOW_APPLY_ENV_VAR)
        try:
            module.parse_args = lambda: _Args
            os.environ.pop(module.ALLOW_APPLY_ENV_VAR, None)
            exit_code = module.main()
        finally:
            module.parse_args = original_parse
            if original_env is None:
                os.environ.pop(module.ALLOW_APPLY_ENV_VAR, None)
            else:
                os.environ[module.ALLOW_APPLY_ENV_VAR] = original_env

        assert exit_code == 0


def test_main_returns_success_for_allow_apply_path_with_env_gate():
    module = _load_script_module()
    with tempfile.TemporaryDirectory() as tmp:
        artifact_dir = Path(tmp)
        now = datetime.now(timezone.utc)
        _write_artifact(
            artifact_dir / "integration_telemetry_event_root_backfill_recent_policy.json",
            now,
        )
        _write_artifact(
            artifact_dir / "integration_telemetry_event_root_backfill_stale_policy.json",
            now - timedelta(days=60),
        )

        class _Args:
            pass

        _Args.artifact_dir = str(artifact_dir)
        _Args.prefix = "integration_telemetry_event_root_backfill"
        _Args.keep_days = 30
        _Args.keep_min_count = 1
        _Args.max_apply_candidates = 20

        original_parse = module.parse_args
        original_env = os.environ.get(module.ALLOW_APPLY_ENV_VAR)
        try:
            module.parse_args = lambda: _Args
            os.environ[module.ALLOW_APPLY_ENV_VAR] = "true"
            exit_code = module.main()
        finally:
            module.parse_args = original_parse
            if original_env is None:
                os.environ.pop(module.ALLOW_APPLY_ENV_VAR, None)
            else:
                os.environ[module.ALLOW_APPLY_ENV_VAR] = original_env

        assert exit_code == 0
