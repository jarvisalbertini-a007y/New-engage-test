import importlib.util
import json
from pathlib import Path
import tempfile


SCRIPT_PATH = (
    Path(__file__).resolve().parents[1]
    / "scripts"
    / "generate_connector_telemetry_snapshot_fixture.py"
)


def _load_script_module():
    spec = importlib.util.spec_from_file_location(
        "generate_connector_telemetry_snapshot_fixture", SCRIPT_PATH
    )
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def test_build_fixture_payload_contains_traceability_audit_contract_fields():
    module = _load_script_module()
    payload = module.build_fixture_payload()
    assert payload["eventCount"] == 4
    assert payload["traceabilityAudit"]["eventCount"] == 1
    assert payload["traceabilityAudit"]["decisionCounts"]["HOLD"] == 1
    assert payload["traceabilityAudit"]["readyCount"] == 0
    assert payload["traceabilityAudit"]["notReadyCount"] == 1
    assert len(payload["recentEvents"]) >= 1
    assert payload["recentEvents"][0]["eventType"] == "integrations_traceability_status_evaluated"
    assert payload["recentEvents"][0]["traceabilityDecision"] == "HOLD"
    assert payload["recentEvents"][0]["traceabilityReady"] is False


def test_main_writes_snapshot_fixture_file():
    module = _load_script_module()
    with tempfile.TemporaryDirectory() as tmp:
        output_path = Path(tmp) / "connector-telemetry-summary-snapshot.json"

        class _Args:
            output = str(output_path)

        original_parse = module.parse_args
        try:
            module.parse_args = lambda: _Args
            exit_code = module.main()
        finally:
            module.parse_args = original_parse

        assert exit_code == 0
        payload = json.loads(output_path.read_text(encoding="utf-8"))
        assert "traceabilityAudit" in payload
