import importlib.util
import json
from pathlib import Path
import tempfile


SCRIPT_PATH = (
    Path(__file__).resolve().parents[1]
    / "scripts"
    / "collect_baseline_metrics.py"
)


def _load_script_module():
    spec = importlib.util.spec_from_file_location("collect_baseline_metrics", SCRIPT_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def test_parse_test_metrics_extracts_frontend_and_pytest_counts():
    module = _load_script_module()
    sample_output = """
Test Suites: 4 passed, 4 total
Tests:       23 passed, 23 total
77 passed, 2 warnings in 0.77s
"""
    metrics = module._parse_test_metrics(sample_output)
    assert metrics["frontendSuitesPassed"] == 4
    assert metrics["frontendSuitesTotal"] == 4
    assert metrics["frontendTestsPassed"] == 23
    assert metrics["frontendTestsTotal"] == 23
    assert metrics["pytestPassedCounts"] == [77]


def test_default_steps_include_required_baseline_commands():
    module = _load_script_module()
    labels = [step["label"] for step in module.DEFAULT_STEPS]
    assert labels == [
        "lint",
        "build",
        "verify_frontend",
        "verify_backend_sales",
        "verify_smoke_campaign",
        "verify_smoke_schema_gate",
        "verify_smoke_release_gate",
        "verify_release_gate_artifact_fixtures",
        "verify_release_gate_artifact_contract",
        "verify_smoke_health",
    ]


def test_extract_schema_adoption_metrics_from_evidence_payload():
    module = _load_script_module()
    evidence = {
        "telemetrySummary": {
            "bySchemaVersion": {"1": 8, "2": 14},
            "salesIntelligence": {"bySchemaVersion": {"2": 14}},
        },
        "sloSummary": {
            "gates": {"schemaCoveragePassed": True, "schemaSampleSizePassed": True},
            "schemaCoverage": {"thresholdPct": 95, "sampleCount": 30, "minSampleCount": 25},
        },
    }
    metrics = module._extract_schema_adoption(evidence)
    assert metrics["available"] is True
    assert metrics["overallBySchemaVersion"]["2"] == 14
    assert metrics["salesBySchemaVersion"]["2"] == 14
    assert metrics["salesSchemaV2Pct"] == 100.0
    assert metrics["schemaGatePassed"] is True
    assert metrics["schemaSampleGatePassed"] is True
    assert metrics["schemaThresholdPct"] == 95
    assert metrics["schemaObservedSampleCount"] == 30
    assert metrics["schemaMinSampleCount"] == 25


def test_load_schema_adoption_metrics_handles_missing_and_valid_files():
    module = _load_script_module()
    with tempfile.TemporaryDirectory() as tmp:
        missing_path = Path(tmp) / "missing.json"
        missing_metrics = module._load_schema_adoption_metrics(missing_path)
        assert missing_metrics["available"] is False
        assert missing_metrics["reason"] == "connector_canary_evidence_missing"

        evidence_path = Path(tmp) / "connector_canary_evidence.json"
        evidence_payload = {
            "telemetrySummary": {
                "bySchemaVersion": {"1": 2, "2": 3},
                "salesIntelligence": {"bySchemaVersion": {"1": 1, "2": 3}},
            },
            "sloSummary": {
                "gates": {"schemaCoveragePassed": False, "schemaSampleSizePassed": False},
                "schemaCoverage": {"thresholdPct": 95, "sampleCount": 4, "minSampleCount": 25},
            },
        }
        evidence_path.write_text(json.dumps(evidence_payload), encoding="utf-8")
        loaded_metrics = module._load_schema_adoption_metrics(evidence_path)
        assert loaded_metrics["available"] is True
        assert loaded_metrics["source"] == str(evidence_path)
        assert loaded_metrics["salesSchemaSampleCount"] == 4
        assert loaded_metrics["salesSchemaV2Count"] == 3
        assert loaded_metrics["salesSchemaV2Pct"] == 75.0
        assert loaded_metrics["schemaSampleGatePassed"] is False
        assert loaded_metrics["schemaObservedSampleCount"] == 4
        assert loaded_metrics["schemaMinSampleCount"] == 25


def test_load_release_gate_fixture_profiles_handles_missing_and_valid_files():
    module = _load_script_module()
    with tempfile.TemporaryDirectory() as tmp:
        base = Path(tmp)
        pass_path = base / "connector_release_gate_result.json"
        hold_path = base / "connector_release_gate_result_hold.json"
        validation_path = base / "connector_release_gate_result_validation_fail.json"

        pass_payload = {
            "approved": True,
            "decision": "PROCEED",
            "checks": {"validationPassed": True},
            "failedChecks": [],
        }
        hold_payload = {
            "approved": False,
            "decision": "HOLD",
            "checks": {"validationPassed": True},
            "failedChecks": ["decisionIsProceed"],
        }
        pass_path.write_text(json.dumps(pass_payload), encoding="utf-8")
        hold_path.write_text(json.dumps(hold_payload), encoding="utf-8")

        summary = module._load_release_gate_fixture_profiles(
            {
                "pass": pass_path,
                "hold": hold_path,
                "validation-fail": validation_path,
            }
        )

        assert summary["profileCount"] == 3
        assert summary["availableProfileCount"] == 2
        assert summary["allProfilesAvailable"] is False
        assert summary["profiles"]["pass"]["available"] is True
        assert summary["profiles"]["pass"]["decision"] == "PROCEED"
        assert summary["profiles"]["hold"]["available"] is True
        assert summary["profiles"]["hold"]["failedChecks"] == ["decisionIsProceed"]
        assert summary["profiles"]["validation-fail"]["available"] is False
        assert summary["profiles"]["validation-fail"]["reason"] == "artifact_missing"


def test_main_writes_artifact_with_required_contract_fields():
    module = _load_script_module()
    with tempfile.TemporaryDirectory() as tmp:
        output_path = Path(tmp) / "baseline_metrics.json"

        class _Args:
            output = str(output_path)

        def _fake_run_step(label, command):
            return {
                "label": label,
                "command": " ".join(command),
                "startedAt": "2026-02-22T00:00:00+00:00",
                "durationMs": 1,
                "status": "pass",
                "returnCode": 0,
                "logPath": "/tmp/fake.log",
                "metrics": {},
            }

        original_parse = module.argparse.ArgumentParser.parse_args
        original_run_step = module._run_step
        original_schema = module._load_schema_adoption_metrics
        original_release_fixtures = module._load_release_gate_fixture_profiles
        try:
            module.argparse.ArgumentParser.parse_args = lambda _self: _Args
            module._run_step = _fake_run_step
            module._load_schema_adoption_metrics = lambda: {
                "available": True,
                "source": "/tmp/fake-evidence.json",
                "salesSchemaV2Pct": 100.0,
            }
            module._load_release_gate_fixture_profiles = lambda: {
                "sourceDir": "/tmp",
                "requiredProfiles": ["pass", "hold", "validation-fail"],
                "profileCount": 3,
                "availableProfileCount": 3,
                "allProfilesAvailable": True,
                "profiles": {
                    "pass": {"available": True, "source": "/tmp/pass.json"},
                    "hold": {"available": True, "source": "/tmp/hold.json"},
                    "validation-fail": {"available": True, "source": "/tmp/validation-fail.json"},
                },
            }
            exit_code = module.main()
        finally:
            module.argparse.ArgumentParser.parse_args = original_parse
            module._run_step = original_run_step
            module._load_schema_adoption_metrics = original_schema
            module._load_release_gate_fixture_profiles = original_release_fixtures

        assert exit_code == 0
        assert output_path.exists()
        artifact = json.loads(output_path.read_text(encoding="utf-8"))

        required_top_level = [
            "generatedAt",
            "runStartedAt",
            "durationMs",
            "workspace",
            "overallStatus",
            "schemaAdoption",
            "releaseGateFixtures",
            "releaseGateFixturePolicy",
            "steps",
        ]
        for key in required_top_level:
            assert key in artifact

        assert artifact["overallStatus"] == "pass"
        assert len(artifact["steps"]) == len(module.DEFAULT_STEPS)
        assert any(step["label"] == "verify_smoke_release_gate" for step in artifact["steps"])
        assert any(
            step["label"] == "verify_release_gate_artifact_fixtures"
            for step in artifact["steps"]
        )
        assert any(
            step["label"] == "verify_release_gate_artifact_contract"
            for step in artifact["steps"]
        )
        step_required_keys = [
            "label",
            "command",
            "startedAt",
            "durationMs",
            "status",
            "returnCode",
            "logPath",
            "metrics",
        ]
        for key in step_required_keys:
            assert key in artifact["steps"][0]
