import importlib.util
import json
from pathlib import Path


SCRIPT_PATH = (
    Path(__file__).resolve().parents[1]
    / "scripts"
    / "run_integration_telemetry_event_root_backfill_guarded_apply.py"
)


def _load_module():
    spec = importlib.util.spec_from_file_location(
        "run_integration_telemetry_event_root_backfill_guarded_apply",
        SCRIPT_PATH,
    )
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def test_guarded_apply_result_returns_nonzero_for_action_required():
    module = _load_module()
    exit_code, output = module.resolve_guarded_apply_result(
        {"decision": "ACTION_REQUIRED", "reason": "manual approval required"},
        apply_summary=None,
    )
    assert exit_code == 1
    assert output["policy"]["decision"] == "ACTION_REQUIRED"
    assert "apply" not in output


def test_guarded_apply_result_returns_success_for_skip_apply():
    module = _load_module()
    exit_code, output = module.resolve_guarded_apply_result(
        {"decision": "SKIP_APPLY", "reason": "no candidates"},
        apply_summary=None,
    )
    assert exit_code == 0
    assert output["policy"]["decision"] == "SKIP_APPLY"
    assert "apply" not in output


def test_guarded_apply_result_includes_apply_summary_for_allow_apply():
    module = _load_module()
    exit_code, output = module.resolve_guarded_apply_result(
        {"decision": "ALLOW_APPLY", "reason": "ok"},
        apply_summary={"mode": "apply", "candidateCount": 3, "updatedCount": 3},
    )
    assert exit_code == 0
    assert output["policy"]["decision"] == "ALLOW_APPLY"
    assert output["apply"]["updatedCount"] == 3


def test_guarded_apply_output_includes_command_and_generated_at():
    module = _load_module()
    payload = module.build_guarded_apply_output(
        {"policy": {"decision": "SKIP_APPLY", "candidateCount": 0}}
    )
    assert payload["command"] == "run_integration_telemetry_event_root_backfill_guarded_apply"
    assert isinstance(payload["generatedAt"], str)
    assert payload["policy"]["decision"] == "SKIP_APPLY"


def test_guarded_apply_write_output_writes_json_payload(tmp_path):
    module = _load_module()
    output_path = tmp_path / "guarded.json"
    payload = module.build_guarded_apply_output(
        {
            "policy": {"decision": "ALLOW_APPLY", "candidateCount": 3},
            "apply": {"mode": "apply", "updatedCount": 3},
        }
    )
    module.write_output(str(output_path), payload)
    written = json.loads(output_path.read_text(encoding="utf-8"))
    assert written["policy"]["decision"] == "ALLOW_APPLY"
    assert written["apply"]["updatedCount"] == 3
