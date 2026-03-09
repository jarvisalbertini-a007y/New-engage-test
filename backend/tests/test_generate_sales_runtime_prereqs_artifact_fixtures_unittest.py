import importlib.util
import json
from pathlib import Path
import tempfile


SCRIPT_PATH = (
    Path(__file__).resolve().parents[1]
    / "scripts"
    / "generate_sales_runtime_prereqs_artifact_fixtures.py"
)


def _load_module():
    spec = importlib.util.spec_from_file_location(
        "generate_sales_runtime_prereqs_artifact_fixtures",
        SCRIPT_PATH,
    )
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def test_build_fixture_payload_healthy_profile_is_valid():
    module = _load_module()
    payload = module.build_fixture_payload("healthy")
    assert payload["command"] == "verify_sales_runtime_prereqs"
    assert payload["artifact"]["valid"] is True
    assert payload["artifact"]["missingChecks"]["commands"] == []
    assert payload["artifact"]["missingChecks"]["workspace"] == []


def test_build_fixture_payload_missing_command_profile_is_invalid_with_command_missing():
    module = _load_module()
    payload = module.build_fixture_payload("missing-command")
    assert payload["artifact"]["valid"] is False
    assert "node" in payload["artifact"]["missingChecks"]["commands"]
    assert len(payload["artifact"]["recommendedCommands"]) >= 1


def test_build_fixture_payload_missing_workspace_profile_is_invalid_with_workspace_missing():
    module = _load_module()
    payload = module.build_fixture_payload("missing-workspace")
    assert payload["artifact"]["valid"] is False
    assert "frontend_dir_exists" in payload["artifact"]["missingChecks"]["workspace"]


def test_generate_fixtures_writes_expected_profiles():
    module = _load_module()
    with tempfile.TemporaryDirectory() as tmp_dir:
        manifest = module.generate_fixtures(tmp_dir, "sales_runtime_prereqs_fixture")
        assert manifest["prefix"] == "sales_runtime_prereqs_fixture"
        assert len(manifest["profiles"]) == 3
        for entry in manifest["profiles"]:
            artifact_path = Path(entry["artifact"])
            assert artifact_path.exists()
            payload = json.loads(artifact_path.read_text(encoding="utf-8"))
            assert payload["command"] == "verify_sales_runtime_prereqs"
