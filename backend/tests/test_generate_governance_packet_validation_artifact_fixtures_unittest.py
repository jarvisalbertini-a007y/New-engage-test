import importlib.util
import json
from pathlib import Path
import tempfile


SCRIPT_PATH = (
    Path(__file__).resolve().parents[1]
    / "scripts"
    / "generate_governance_packet_validation_artifact_fixtures.py"
)


def _load_script_module():
    spec = importlib.util.spec_from_file_location(
        "generate_governance_packet_validation_artifact_fixtures",
        SCRIPT_PATH,
    )
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def test_profile_payload_returns_ready_and_action_required_statuses():
    module = _load_script_module()
    ready = module._profile_payload("ready")
    action_required = module._profile_payload("action-required")

    assert ready["status"] == "READY"
    assert action_required["status"] == "ACTION_REQUIRED"
    assert ready["governanceExport"]["rolloutBlocked"] is False
    assert action_required["governanceExport"]["rolloutBlocked"] is True
    assert isinstance(ready["summary"]["sendgridWebhookTimestamp"], dict)
    assert isinstance(action_required["summary"]["sendgridWebhookTimestamp"], dict)
    assert (
        ready["summary"]["sendgridWebhookTimestamp"]["eventCount"]
        == ready["governanceExport"]["sendgridWebhookTimestamp"]["eventCount"]
    )
    assert (
        action_required["summary"]["sendgridWebhookTimestamp"]["timestampAnomalyCountTotal"]
        == action_required["governanceExport"]["sendgridWebhookTimestamp"][
            "timestampAnomalyCountTotal"
        ]
    )


def test_generate_fixtures_writes_three_validation_artifacts_with_expected_validity():
    module = _load_script_module()
    with tempfile.TemporaryDirectory() as tmp:
        manifest = module.generate_fixtures(
            output_dir=tmp,
            prefix="governance_packet_validation_fixture",
            requested_by="u-smoke",
        )
        assert len(manifest["profiles"]) == 3

        profile_map = {entry["profile"]: entry for entry in manifest["profiles"]}
        assert profile_map["ready"]["valid"] is True
        assert profile_map["action-required"]["valid"] is True
        assert profile_map["validation-fail"]["valid"] is False

        for entry in manifest["profiles"]:
            validation_path = Path(entry["validationArtifact"])
            assert validation_path.exists()
            payload = json.loads(validation_path.read_text(encoding="utf-8"))
            assert isinstance(payload.get("validatedAt"), str)
            assert isinstance(payload.get("checks"), dict)
            assert isinstance(payload.get("errors"), list)
            assert isinstance(payload.get("valid"), bool)


def test_main_writes_manifest_to_stdout_and_returns_zero():
    module = _load_script_module()
    with tempfile.TemporaryDirectory() as tmp:

        class _Args:
            output_dir = tmp
            prefix = "governance_packet_validation_fixture"
            requested_by = "u-test"

        original_parse = module.parse_args
        try:
            module.parse_args = lambda: _Args
            exit_code = module.main()
        finally:
            module.parse_args = original_parse

        assert exit_code == 0
