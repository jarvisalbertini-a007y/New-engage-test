import importlib.util
import json
from pathlib import Path
import tempfile


SCRIPT_PATH = (
    Path(__file__).resolve().parents[1]
    / "scripts"
    / "validate_governance_packet_validation_artifact.py"
)


def _load_script_module():
    spec = importlib.util.spec_from_file_location(
        "validate_governance_packet_validation_artifact",
        SCRIPT_PATH,
    )
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def _valid_payload():
    return {
        "validatedAt": "2026-03-02T02:00:00+00:00",
        "checks": {
            "handoff": {"statusPresent": True},
            "history": {"statusPresent": True},
            "crossArtifact": {"statusConsistency": True},
        },
        "errors": [],
        "valid": True,
    }


def test_validate_artifact_accepts_valid_payload_shape():
    module = _load_script_module()
    errors = module.validate_artifact(_valid_payload())
    assert errors == []


def test_validate_artifact_rejects_missing_check_sections_and_valid_parity_mismatch():
    module = _load_script_module()
    payload = _valid_payload()
    payload["checks"].pop("history")
    payload["valid"] = True
    payload["errors"] = ["contract mismatch"]

    errors = module.validate_artifact(payload)
    assert any("checks.history" in error for error in errors)
    assert any("valid must match" in error for error in errors)


def test_main_returns_nonzero_for_invalid_artifact_file():
    module = _load_script_module()
    with tempfile.TemporaryDirectory() as tmp:
        artifact_path = Path(tmp) / "governance_packet_validation_fixture_invalid.json"
        artifact_path.write_text(json.dumps({"valid": "yes"}), encoding="utf-8")

        class _Args:
            artifact = str(artifact_path)

        original_parse = module.parse_args
        try:
            module.parse_args = lambda: _Args
            exit_code = module.main()
        finally:
            module.parse_args = original_parse

        assert exit_code == 1
