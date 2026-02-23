import importlib.util
import json
from pathlib import Path
import tempfile


SCRIPT_PATH = (
    Path(__file__).resolve().parents[1]
    / "scripts"
    / "validate_baseline_metrics_artifact.py"
)


def _load_script_module():
    spec = importlib.util.spec_from_file_location("validate_baseline_metrics_artifact", SCRIPT_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def _valid_payload(step_labels):
    return {
        "generatedAt": "2026-02-22T00:00:00+00:00",
        "runStartedAt": "2026-02-22T00:00:00+00:00",
        "durationMs": 1000,
        "workspace": "/tmp/repo",
        "overallStatus": "pass",
        "schemaAdoption": {"available": False},
        "releaseGateFixtures": {
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
        },
        "releaseGateFixturePolicy": {
            "passed": True,
            "requiredProfiles": ["pass", "hold", "validation-fail"],
            "missingProfiles": [],
            "message": "All required release-gate fixture profiles are present.",
        },
        "steps": [
            {
                "label": label,
                "command": f"cmd {label}",
                "startedAt": "2026-02-22T00:00:00+00:00",
                "durationMs": 10,
                "status": "pass",
                "returnCode": 0,
                "logPath": "/tmp/log",
                "metrics": {},
            }
            for label in step_labels
        ],
    }


def test_validate_artifact_accepts_valid_payload():
    module = _load_script_module()
    labels = [step["label"] for step in module.DEFAULT_STEPS]
    payload = _valid_payload(labels)
    errors = module.validate_artifact(payload)
    assert errors == []


def test_validate_artifact_rejects_missing_top_level_fields():
    module = _load_script_module()
    payload = {"overallStatus": "pass", "steps": []}
    errors = module.validate_artifact(payload)
    assert any("Missing top-level key" in error for error in errors)


def test_validate_artifact_rejects_step_label_order_drift():
    module = _load_script_module()
    labels = [step["label"] for step in module.DEFAULT_STEPS]
    payload = _valid_payload(list(reversed(labels)))
    errors = module.validate_artifact(payload)
    assert any("step labels/order mismatch" in error for error in errors)


def test_main_returns_nonzero_for_invalid_artifact_file():
    module = _load_script_module()
    with tempfile.TemporaryDirectory() as tmp:
        artifact_path = Path(tmp) / "baseline_metrics.json"
        artifact_path.write_text(json.dumps({"overallStatus": "unknown"}), encoding="utf-8")

        class _Args:
            artifact = str(artifact_path)

        original_parse = module.parse_args
        try:
            module.parse_args = lambda: _Args
            exit_code = module.main()
        finally:
            module.parse_args = original_parse

        assert exit_code == 1
