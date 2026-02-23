import importlib.util
import json
from pathlib import Path
import tempfile


SCRIPT_PATH = (
    Path(__file__).resolve().parents[1]
    / "scripts"
    / "generate_connector_release_gate_artifact_fixture.py"
)


def _load_script_module():
    spec = importlib.util.spec_from_file_location(
        "generate_connector_release_gate_artifact_fixture", SCRIPT_PATH
    )
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def test_build_fixture_payload_produces_release_gate_contract_shape_for_pass_profile():
    module = _load_script_module()
    payload = module.build_fixture_payload(profile="pass")
    assert payload["approved"] is True
    assert payload["decision"] == "PROCEED"
    assert payload["checks"]["schemaCoveragePassed"] is True
    assert payload["checks"]["schemaSampleSizePassed"] is True
    assert payload["schemaCoverage"]["sampleCount"] == 30
    assert payload["schemaCoverage"]["minSampleCount"] == 25


def test_build_fixture_payload_produces_blocked_release_gate_for_hold_profile():
    module = _load_script_module()
    payload = module.build_fixture_payload(profile="hold")
    assert payload["approved"] is False
    assert payload["decision"] == "HOLD"
    assert payload["checks"]["schemaCoveragePassed"] is False
    assert payload["checks"]["schemaSampleSizePassed"] is False
    assert "decisionIsProceed" in payload["failedChecks"]
    assert "schemaSampleSizePassed" in payload["failedChecks"]
    assert payload["schemaCoverage"]["sampleCount"] == 8
    assert payload["schemaCoverage"]["minSampleCount"] == 25


def test_build_fixture_payload_produces_validation_failed_profile():
    module = _load_script_module()
    payload = module.build_fixture_payload(profile="validation-fail")
    assert payload["approved"] is False
    assert payload["decision"] == "PROCEED"
    assert payload["checks"]["validationPassed"] is False
    assert payload["checks"]["schemaCoveragePassed"] is True
    assert payload["checks"]["schemaSampleSizePassed"] is True
    assert "validationPassed" in payload["failedChecks"]


def test_main_writes_artifact_file():
    module = _load_script_module()
    with tempfile.TemporaryDirectory() as tmp:
        artifact_path = Path(tmp) / "connector_release_gate_result.json"

        class _Args:
            output = str(artifact_path)
            profile = "pass"

        original_parse = module.parse_args
        try:
            module.parse_args = lambda: _Args
            exit_code = module.main()
        finally:
            module.parse_args = original_parse

        assert exit_code == 0
        payload = json.loads(artifact_path.read_text(encoding="utf-8"))
        assert payload["approved"] is True
