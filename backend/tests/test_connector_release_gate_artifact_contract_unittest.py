import importlib.util
import json
from pathlib import Path
import tempfile


SCRIPT_PATH = (
    Path(__file__).resolve().parents[1]
    / "scripts"
    / "validate_connector_release_gate_artifact.py"
)


def _load_script_module():
    spec = importlib.util.spec_from_file_location(
        "validate_connector_release_gate_artifact", SCRIPT_PATH
    )
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def _valid_payload():
    return {
        "evaluatedAt": "2026-02-22T00:00:00+00:00",
        "approved": True,
        "decision": "PROCEED",
        "signoffStatus": "READY_FOR_APPROVAL",
        "schemaCoverage": {
            "passed": True,
            "observedPct": 100.0,
            "thresholdPct": 95.0,
            "sampleSizePassed": True,
            "sampleCount": 30,
            "minSampleCount": 25,
        },
        "orchestrationAudit": {
            "attemptErrorPassed": True,
            "observedAttemptErrorCount": 0,
            "maxAttemptErrorCountThreshold": 5,
            "attemptSkippedPassed": True,
            "observedAttemptSkippedCount": 1,
            "maxAttemptSkippedCountThreshold": 25,
        },
        "checks": {
            "validationPassed": True,
            "decisionIsProceed": True,
            "signoffReady": True,
            "noActiveAlerts": True,
            "schemaCoveragePassed": True,
            "schemaSampleSizePassed": True,
            "orchestrationAttemptErrorPassed": True,
            "orchestrationAttemptSkippedPassed": True,
        },
        "failedChecks": [],
        "reasons": [],
    }


def test_validate_artifact_accepts_valid_payload():
    module = _load_script_module()
    errors = module.validate_artifact(_valid_payload())
    assert errors == []


def test_validate_artifact_rejects_missing_schema_keys():
    module = _load_script_module()
    payload = _valid_payload()
    payload["schemaCoverage"].pop("sampleSizePassed")
    errors = module.validate_artifact(payload)
    assert any("schemaCoverage missing key: sampleSizePassed" in error for error in errors)


def test_validate_artifact_rejects_missing_orchestration_keys():
    module = _load_script_module()
    payload = _valid_payload()
    payload["orchestrationAudit"].pop("maxAttemptSkippedCountThreshold")
    errors = module.validate_artifact(payload)
    assert any(
        "orchestrationAudit missing key: maxAttemptSkippedCountThreshold" in error
        for error in errors
    )


def test_validate_artifact_rejects_non_boolean_check_values():
    module = _load_script_module()
    payload = _valid_payload()
    payload["checks"]["schemaCoveragePassed"] = "true"
    errors = module.validate_artifact(payload)
    assert any("checks.schemaCoveragePassed must be boolean" in error for error in errors)


def test_main_returns_nonzero_for_invalid_artifact_file():
    module = _load_script_module()
    with tempfile.TemporaryDirectory() as tmp:
        artifact_path = Path(tmp) / "connector_release_gate_result.json"
        artifact_path.write_text(json.dumps({"approved": "yes"}), encoding="utf-8")

        class _Args:
            artifact = str(artifact_path)

        original_parse = module.parse_args
        try:
            module.parse_args = lambda: _Args
            exit_code = module.main()
        finally:
            module.parse_args = original_parse

        assert exit_code == 1
