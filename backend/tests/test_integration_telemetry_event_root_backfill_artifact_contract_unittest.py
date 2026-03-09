import importlib.util
import json
from pathlib import Path


SCRIPT_PATH = (
    Path(__file__).resolve().parents[1]
    / "scripts"
    / "validate_integration_telemetry_event_root_backfill_artifacts.py"
)


def _load_module():
    spec = importlib.util.spec_from_file_location(
        "validate_integration_telemetry_event_root_backfill_artifacts",
        SCRIPT_PATH,
    )
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def _write_json(path: Path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def test_validate_artifacts_passes_for_matching_policy_and_guarded_payloads(tmp_path):
    module = _load_module()
    policy_path = tmp_path / "policy.json"
    guarded_path = tmp_path / "guarded.json"
    policy_payload = {
        "generatedAt": "2026-02-27T00:00:00+00:00",
        "command": "evaluate_integration_telemetry_event_root_backfill_policy",
        "decision": "ALLOW_APPLY",
        "reason": "ok",
        "candidateCount": 2,
        "maxApplyCandidates": 100,
        "allowApplyFlag": True,
        "allowApplyEnvVar": "BACKFILL_ALLOW_APPLY",
        "recommendedCommand": "npm run verify:telemetry:event-root:backfill:apply:guarded",
        "dryRunSummary": {"mode": "dry-run", "candidateCount": 2},
    }
    guarded_payload = {
        "generatedAt": "2026-02-27T00:00:01+00:00",
        "command": "run_integration_telemetry_event_root_backfill_guarded_apply",
        "policy": {
            "decision": "ALLOW_APPLY",
            "candidateCount": 2,
            "maxApplyCandidates": 100,
            "allowApplyEnvVar": "BACKFILL_ALLOW_APPLY",
        },
        "apply": {"mode": "apply", "updatedCount": 2},
    }
    _write_json(policy_path, policy_payload)
    _write_json(guarded_path, guarded_payload)

    result = module.validate_artifacts(str(policy_path), str(guarded_path))
    assert result["status"] == "pass"
    assert result["errorCount"] == 0


def test_validate_artifacts_fails_on_decision_parity_mismatch(tmp_path):
    module = _load_module()
    policy_path = tmp_path / "policy.json"
    guarded_path = tmp_path / "guarded.json"
    policy_payload = {
        "generatedAt": "2026-02-27T00:00:00+00:00",
        "command": "evaluate_integration_telemetry_event_root_backfill_policy",
        "decision": "SKIP_APPLY",
        "reason": "none",
        "candidateCount": 0,
        "maxApplyCandidates": 100,
        "allowApplyFlag": False,
        "allowApplyEnvVar": "BACKFILL_ALLOW_APPLY",
        "recommendedCommand": None,
        "dryRunSummary": {"mode": "dry-run", "candidateCount": 0},
    }
    guarded_payload = {
        "generatedAt": "2026-02-27T00:00:01+00:00",
        "command": "run_integration_telemetry_event_root_backfill_guarded_apply",
        "policy": {
            "decision": "ACTION_REQUIRED",
            "candidateCount": 0,
            "maxApplyCandidates": 100,
            "allowApplyEnvVar": "BACKFILL_ALLOW_APPLY",
        },
    }
    _write_json(policy_path, policy_payload)
    _write_json(guarded_path, guarded_payload)

    result = module.validate_artifacts(str(policy_path), str(guarded_path))
    assert result["status"] == "fail"
    assert result["checks"]["cross"]["decisionParity"] is False
    assert result["errorCount"] >= 1


def test_validate_artifacts_fails_when_skip_apply_contains_recommended_command(tmp_path):
    module = _load_module()
    policy_path = tmp_path / "policy.json"
    guarded_path = tmp_path / "guarded.json"
    policy_payload = {
        "generatedAt": "2026-02-27T00:00:00+00:00",
        "command": "evaluate_integration_telemetry_event_root_backfill_policy",
        "decision": "SKIP_APPLY",
        "reason": "none",
        "candidateCount": 0,
        "maxApplyCandidates": 100,
        "allowApplyFlag": False,
        "allowApplyEnvVar": "BACKFILL_ALLOW_APPLY",
        "recommendedCommand": "should-not-exist",
        "dryRunSummary": {"mode": "dry-run", "candidateCount": 0},
    }
    guarded_payload = {
        "generatedAt": "2026-02-27T00:00:01+00:00",
        "command": "run_integration_telemetry_event_root_backfill_guarded_apply",
        "policy": {
            "decision": "SKIP_APPLY",
            "candidateCount": 0,
            "maxApplyCandidates": 100,
            "allowApplyEnvVar": "BACKFILL_ALLOW_APPLY",
        },
    }
    _write_json(policy_path, policy_payload)
    _write_json(guarded_path, guarded_payload)

    result = module.validate_artifacts(str(policy_path), str(guarded_path))
    assert result["status"] == "fail"
    assert result["checks"]["policy"]["recommendedCommandExpectation"] is False
