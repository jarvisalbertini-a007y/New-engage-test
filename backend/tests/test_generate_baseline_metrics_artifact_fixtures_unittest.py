import importlib.util
import json
from pathlib import Path
import tempfile


SCRIPT_PATH = (
    Path(__file__).resolve().parents[1]
    / "scripts"
    / "generate_baseline_metrics_artifact_fixtures.py"
)


def _load_module():
    spec = importlib.util.spec_from_file_location(
        "generate_baseline_metrics_artifact_fixtures",
        SCRIPT_PATH,
    )
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def test_build_fixture_payload_healthy_profile_is_contract_valid():
    module = _load_module()
    payload = module.build_fixture_payload("healthy")
    assert payload["command"] == "collect_baseline_metrics"
    assert payload["overallStatus"] == "pass"
    assert payload["runtimePrereqs"]["passed"] is True
    assert payload["runtimePrereqs"]["missingCheckCount"] == 0


def test_build_fixture_payload_step_failure_profile_marks_overall_failure():
    module = _load_module()
    payload = module.build_fixture_payload("step-failure")
    assert payload["overallStatus"] == "fail"
    assert any(step.get("status") == "fail" for step in payload["steps"])


def test_build_fixture_payload_orchestration_unavailable_profile_sets_available_false():
    module = _load_module()
    payload = module.build_fixture_payload("orchestration-unavailable")
    assert payload["orchestrationGate"]["available"] is False
    assert payload["orchestrationGate"]["reason"] == "connector_canary_evidence_missing"


def test_generate_fixtures_writes_expected_profiles():
    module = _load_module()
    with tempfile.TemporaryDirectory() as tmp_dir:
        manifest = module.generate_fixtures(tmp_dir, "baseline_metrics_fixture")
        assert manifest["prefix"] == "baseline_metrics_fixture"
        assert len(manifest["profiles"]) == 3
        for entry in manifest["profiles"]:
            artifact_path = Path(entry["artifact"])
            assert artifact_path.exists()
            payload = json.loads(artifact_path.read_text(encoding="utf-8"))
            assert payload["command"] == "collect_baseline_metrics"
