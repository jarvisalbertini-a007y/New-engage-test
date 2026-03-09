import importlib.util
import json
from pathlib import Path
import tempfile


SCRIPT_PATH = (
    Path(__file__).resolve().parents[1]
    / "scripts"
    / "generate_integration_telemetry_event_root_backfill_artifact_fixtures.py"
)


def _load_module():
    spec = importlib.util.spec_from_file_location(
        "generate_integration_telemetry_event_root_backfill_artifact_fixtures",
        SCRIPT_PATH,
    )
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def test_build_fixture_payloads_skip_profile_has_no_apply_payload():
    module = _load_module()
    policy, guarded = module.build_fixture_payloads("skip")
    assert policy["decision"] == "SKIP_APPLY"
    assert policy["candidateCount"] == 0
    assert policy["recommendedCommand"] is None
    assert guarded["policy"]["decision"] == "SKIP_APPLY"
    assert "apply" not in guarded


def test_build_fixture_payloads_allow_profile_has_apply_payload():
    module = _load_module()
    policy, guarded = module.build_fixture_payloads("allow")
    assert policy["decision"] == "ALLOW_APPLY"
    assert policy["candidateCount"] == 3
    assert isinstance(policy["recommendedCommand"], str)
    assert guarded["policy"]["decision"] == "ALLOW_APPLY"
    assert guarded["apply"]["mode"] == "apply"
    assert guarded["apply"]["updatedCount"] == 3
    assert guarded["apply"]["updatedCount"] <= guarded["apply"]["candidateCount"]


def test_build_fixture_payloads_action_required_profile_has_no_apply_payload():
    module = _load_module()
    policy, guarded = module.build_fixture_payloads("action-required")
    assert policy["decision"] == "ACTION_REQUIRED"
    assert policy["candidateCount"] > policy["maxApplyCandidates"]
    assert isinstance(policy["recommendedCommand"], str)
    assert guarded["policy"]["decision"] == "ACTION_REQUIRED"
    assert "apply" not in guarded


def test_generate_fixtures_writes_policy_and_guarded_artifacts():
    module = _load_module()
    with tempfile.TemporaryDirectory() as tmp_dir:
        manifest = module.generate_fixtures(tmp_dir, "event_root_backfill")
        assert manifest["prefix"] == "event_root_backfill"
        assert len(manifest["profiles"]) == 3
        for entry in manifest["profiles"]:
            policy_path = Path(entry["policyArtifact"])
            guarded_path = Path(entry["guardedArtifact"])
            assert policy_path.exists()
            assert guarded_path.exists()
            policy_payload = json.loads(policy_path.read_text(encoding="utf-8"))
            guarded_payload = json.loads(guarded_path.read_text(encoding="utf-8"))
            assert policy_payload["command"] == (
                "evaluate_integration_telemetry_event_root_backfill_policy"
            )
            assert guarded_payload["command"] == (
                "run_integration_telemetry_event_root_backfill_guarded_apply"
            )
