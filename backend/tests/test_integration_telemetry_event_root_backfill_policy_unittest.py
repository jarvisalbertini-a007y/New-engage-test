import importlib.util
import json
from pathlib import Path


SCRIPT_PATH = (
    Path(__file__).resolve().parents[1]
    / "scripts"
    / "evaluate_integration_telemetry_event_root_backfill_policy.py"
)


def _load_module():
    spec = importlib.util.spec_from_file_location(
        "evaluate_integration_telemetry_event_root_backfill_policy",
        SCRIPT_PATH,
    )
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def test_policy_returns_skip_apply_when_no_candidates():
    module = _load_module()
    result = module.evaluate_policy_from_summary(
        {"candidateCount": 0, "mode": "dry-run"},
        max_apply_candidates=100,
        allow_apply_flag=False,
    )
    assert result["decision"] == "SKIP_APPLY"
    assert result["recommendedCommand"] is None


def test_policy_requires_manual_action_when_candidate_count_exceeds_threshold():
    module = _load_module()
    result = module.evaluate_policy_from_summary(
        {"candidateCount": 101, "mode": "dry-run"},
        max_apply_candidates=100,
        allow_apply_flag=True,
    )
    assert result["decision"] == "ACTION_REQUIRED"
    assert "max-docs 5000" in result["recommendedCommand"]


def test_policy_requires_allow_apply_flag_for_unattended_execution():
    module = _load_module()
    result = module.evaluate_policy_from_summary(
        {"candidateCount": 7, "mode": "dry-run"},
        max_apply_candidates=100,
        allow_apply_flag=False,
    )
    assert result["decision"] == "ACTION_REQUIRED"
    assert module.ALLOW_APPLY_ENV_VAR in result["reason"]
    assert module.ALLOW_APPLY_ENV_VAR in result["recommendedCommand"]


def test_policy_allows_apply_when_threshold_and_flag_pass():
    module = _load_module()
    result = module.evaluate_policy_from_summary(
        {"candidateCount": 7, "mode": "dry-run"},
        max_apply_candidates=100,
        allow_apply_flag=True,
    )
    assert result["decision"] == "ALLOW_APPLY"
    assert result["recommendedCommand"] == "npm run verify:telemetry:event-root:backfill:apply:guarded"


def test_policy_output_includes_command_and_generated_at():
    module = _load_module()
    payload = module.build_policy_output({"decision": "SKIP_APPLY", "candidateCount": 0})
    assert payload["command"] == "evaluate_integration_telemetry_event_root_backfill_policy"
    assert isinstance(payload["generatedAt"], str)
    assert payload["decision"] == "SKIP_APPLY"


def test_policy_write_output_writes_json_payload(tmp_path):
    module = _load_module()
    output_path = tmp_path / "policy.json"
    payload = module.build_policy_output({"decision": "ALLOW_APPLY", "candidateCount": 2})
    module.write_output(str(output_path), payload)
    written = json.loads(output_path.read_text(encoding="utf-8"))
    assert written["decision"] == "ALLOW_APPLY"
    assert written["candidateCount"] == 2
