import importlib.util
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
import tempfile


SCRIPT_PATH = (
    Path(__file__).resolve().parents[1]
    / "scripts"
    / "validate_integration_telemetry_event_root_backfill_artifact_retention.py"
)


def _load_script_module():
    spec = importlib.util.spec_from_file_location(
        "validate_integration_telemetry_event_root_backfill_artifact_retention",
        SCRIPT_PATH,
    )
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def _write_artifact(path: Path, generated_at: datetime):
    path.write_text(
        json.dumps({"generatedAt": generated_at.isoformat()}),
        encoding="utf-8",
    )


def test_validate_retention_passes_for_recent_policy_and_guarded_artifacts():
    module = _load_script_module()
    with tempfile.TemporaryDirectory() as tmp:
        artifact_dir = Path(tmp)
        now = datetime.now(timezone.utc)
        _write_artifact(
            artifact_dir / "integration_telemetry_event_root_backfill_skip_policy.json",
            now,
        )
        _write_artifact(
            artifact_dir / "integration_telemetry_event_root_backfill_skip_guarded.json",
            now,
        )
        _write_artifact(
            artifact_dir / "integration_telemetry_event_root_backfill_skip_validation.json",
            now,
        )
        errors = module.validate_retention(
            artifact_dir=artifact_dir,
            prefix="integration_telemetry_event_root_backfill",
            min_count=3,
            max_age_days=30,
        )
        assert errors == []


def test_validate_retention_fails_when_newest_artifact_is_stale():
    module = _load_script_module()
    with tempfile.TemporaryDirectory() as tmp:
        artifact_dir = Path(tmp)
        old = datetime.now(timezone.utc) - timedelta(days=40)
        _write_artifact(
            artifact_dir / "integration_telemetry_event_root_backfill_skip_policy.json",
            old,
        )
        _write_artifact(
            artifact_dir / "integration_telemetry_event_root_backfill_skip_guarded.json",
            old,
        )
        _write_artifact(
            artifact_dir / "integration_telemetry_event_root_backfill_skip_validation.json",
            old,
        )
        errors = module.validate_retention(
            artifact_dir=artifact_dir,
            prefix="integration_telemetry_event_root_backfill",
            min_count=3,
            max_age_days=30,
        )
        assert errors
        assert "older than 30 days" in errors[0]


def test_validate_retention_fails_when_policy_or_guarded_artifacts_missing():
    module = _load_script_module()
    with tempfile.TemporaryDirectory() as tmp:
        artifact_dir = Path(tmp)
        now = datetime.now(timezone.utc)
        _write_artifact(
            artifact_dir / "integration_telemetry_event_root_backfill_only_validation.json",
            now,
        )
        _write_artifact(
            artifact_dir / "integration_telemetry_event_root_backfill_other_validation.json",
            now,
        )
        _write_artifact(
            artifact_dir / "integration_telemetry_event_root_backfill_more_validation.json",
            now,
        )
        errors = module.validate_retention(
            artifact_dir=artifact_dir,
            prefix="integration_telemetry_event_root_backfill",
            min_count=3,
            max_age_days=30,
        )
        assert errors
        assert "policy artifact fixtures" in " ".join(errors).lower()
        assert "guarded artifact fixtures" in " ".join(errors).lower()
