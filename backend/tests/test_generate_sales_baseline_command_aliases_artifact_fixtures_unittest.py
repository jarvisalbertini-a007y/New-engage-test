import importlib.util
import json
from pathlib import Path
import tempfile


SCRIPT_PATH = (
    Path(__file__).resolve().parents[1]
    / "scripts"
    / "generate_sales_baseline_command_aliases_artifact_fixtures.py"
)


def _load_module():
    spec = importlib.util.spec_from_file_location(
        "generate_sales_baseline_command_aliases_artifact_fixtures",
        SCRIPT_PATH,
    )
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def test_build_fixture_payload_healthy_profile_is_valid():
    module = _load_module()
    payload = module.build_fixture_payload("healthy")
    assert payload["command"] == "verify_sales_baseline_command_aliases"
    assert payload["artifact"]["valid"] is True
    assert payload["artifact"]["missingAliases"] == []
    assert payload["artifact"]["mismatchedAliases"] == []
    assert payload["artifact"]["errors"] == []


def test_build_fixture_payload_missing_alias_profile_is_invalid_with_alias_missing():
    module = _load_module()
    payload = module.build_fixture_payload("missing-alias")
    assert payload["artifact"]["valid"] is False
    assert "verify:smoke:sales" in payload["artifact"]["missingAliases"]
    assert "verify:smoke:sales" in payload["artifact"]["mismatchedAliases"]
    assert len(payload["artifact"]["errors"]) >= 1


def test_build_fixture_payload_mismatched_alias_profile_is_invalid_with_mismatch():
    module = _load_module()
    payload = module.build_fixture_payload("mismatched-alias")
    assert payload["artifact"]["valid"] is False
    assert payload["artifact"]["missingAliases"] == []
    assert "typecheck" in payload["artifact"]["mismatchedAliases"]


def test_generate_fixtures_writes_expected_profiles():
    module = _load_module()
    with tempfile.TemporaryDirectory() as tmp_dir:
        manifest = module.generate_fixtures(tmp_dir, "sales_baseline_command_aliases_fixture")
        assert manifest["prefix"] == "sales_baseline_command_aliases_fixture"
        assert len(manifest["profiles"]) == 3
        for entry in manifest["profiles"]:
            artifact_path = Path(entry["artifact"])
            assert artifact_path.exists()
            payload = json.loads(artifact_path.read_text(encoding="utf-8"))
            assert payload["command"] == "verify_sales_baseline_command_aliases"
