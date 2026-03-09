import importlib.util

from pathlib import Path


SCRIPT_PATH = (
    Path(__file__).resolve().parents[1]
    / "scripts"
    / "evaluate_sales_runtime_prereqs_artifact_cleanup_policy.py"
)


def _load_script_module():
    spec = importlib.util.spec_from_file_location(
        "evaluate_sales_runtime_prereqs_artifact_cleanup_policy",
        SCRIPT_PATH,
    )
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def test_runtime_prereqs_policy_skips_when_no_candidates():
    module = _load_script_module()
    result = module.evaluate_policy_from_summary(
        {"candidateCount": 0, "mode": "dry-run"},
        max_apply_candidates=20,
        allow_apply_flag=False,
    )
    assert result["decision"] == "SKIP_APPLY"
    assert result["recommendedCommand"] is None


def test_runtime_prereqs_policy_requires_manual_action_when_over_threshold():
    module = _load_script_module()
    result = module.evaluate_policy_from_summary(
        {"candidateCount": 25, "mode": "dry-run"},
        max_apply_candidates=20,
        allow_apply_flag=True,
    )
    assert result["decision"] == "ACTION_REQUIRED"
    assert "keep-days 7" in (result.get("recommendedCommand") or "")


def test_runtime_prereqs_policy_requires_env_gate_when_flag_missing():
    module = _load_script_module()
    result = module.evaluate_policy_from_summary(
        {"candidateCount": 5, "mode": "dry-run"},
        max_apply_candidates=20,
        allow_apply_flag=False,
    )
    assert result["decision"] == "ACTION_REQUIRED"
    assert module.ALLOW_APPLY_ENV_VAR in (result.get("recommendedCommand") or "")


def test_runtime_prereqs_policy_allows_apply_when_within_threshold_and_flag_set():
    module = _load_script_module()
    result = module.evaluate_policy_from_summary(
        {"candidateCount": 2, "mode": "dry-run"},
        max_apply_candidates=20,
        allow_apply_flag=True,
    )
    assert result["decision"] == "ALLOW_APPLY"
