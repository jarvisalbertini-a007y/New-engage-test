import importlib.util
import json
from pathlib import Path
import tempfile


SCRIPT_PATH = (
    Path(__file__).resolve().parents[1]
    / "scripts"
    / "validate_connector_telemetry_snapshot.py"
)


def _load_script_module():
    spec = importlib.util.spec_from_file_location(
        "validate_connector_telemetry_snapshot", SCRIPT_PATH
    )
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def _valid_payload():
    return {
        "generatedAt": "2026-02-22T00:00:00+00:00",
        "eventCount": 4,
        "byProvider": {"integrations": 1},
        "byEventType": {"integrations_traceability_status_evaluated": 1},
        "traceabilityAudit": {
            "eventCount": 1,
            "decisionCounts": {"HOLD": 1},
            "readyCount": 0,
            "notReadyCount": 1,
        },
        "recentEvents": [
            {
                "eventType": "integrations_traceability_status_evaluated",
                "requestId": "req-1",
                "traceabilityDecision": "HOLD",
                "traceabilityReady": False,
            }
        ],
    }


def test_validate_snapshot_accepts_valid_payload():
    module = _load_script_module()
    errors = module.validate_snapshot(_valid_payload())
    assert errors == []


def test_validate_snapshot_rejects_missing_traceability_fields():
    module = _load_script_module()
    payload = _valid_payload()
    payload["traceabilityAudit"] = {"eventCount": 1}
    errors = module.validate_snapshot(payload)
    assert any("traceabilityAudit missing key" in error for error in errors)


def test_validate_snapshot_rejects_bad_traceability_recent_event():
    module = _load_script_module()
    payload = _valid_payload()
    payload["recentEvents"][0]["traceabilityReady"] = "false"
    errors = module.validate_snapshot(payload)
    assert any("traceabilityReady must be boolean" in error for error in errors)


def test_main_returns_nonzero_for_invalid_snapshot_file():
    module = _load_script_module()
    with tempfile.TemporaryDirectory() as tmp:
        snapshot_path = Path(tmp) / "snapshot.json"
        snapshot_path.write_text(json.dumps({"eventCount": 1}), encoding="utf-8")

        class _Args:
            snapshot = str(snapshot_path)

        original_parse = module.parse_args
        try:
            module.parse_args = lambda: _Args
            exit_code = module.main()
        finally:
            module.parse_args = original_parse

        assert exit_code == 1
