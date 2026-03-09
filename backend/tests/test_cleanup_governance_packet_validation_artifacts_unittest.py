import importlib.util
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
import tempfile


SCRIPT_PATH = (
    Path(__file__).resolve().parents[1]
    / "scripts"
    / "cleanup_governance_packet_validation_artifacts.py"
)


def _load_script_module():
    spec = importlib.util.spec_from_file_location(
        "cleanup_governance_packet_validation_artifacts",
        SCRIPT_PATH,
    )
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def _write_valid_artifact(path: Path, validated_at: datetime):
    payload = {
        "validatedAt": validated_at.isoformat(),
        "checks": {
            "handoff": {"statusPresent": True},
            "history": {"statusPresent": True},
            "crossArtifact": {"statusConsistency": True},
        },
        "errors": [],
        "valid": True,
    }
    path.write_text(json.dumps(payload), encoding="utf-8")


def test_cleanup_dry_run_marks_stale_and_invalid_candidates():
    module = _load_script_module()
    with tempfile.TemporaryDirectory() as tmp:
        artifact_dir = Path(tmp)
        now = datetime.now(timezone.utc)
        _write_valid_artifact(
            artifact_dir / "governance_packet_validation_fixture_recent.json",
            now,
        )
        _write_valid_artifact(
            artifact_dir / "governance_packet_validation_fixture_stale.json",
            now - timedelta(days=90),
        )
        (artifact_dir / "governance_packet_validation_fixture_invalid.json").write_text(
            json.dumps({"validatedAt": now.isoformat(), "checks": {}}),
            encoding="utf-8",
        )

        summary = module.run_cleanup(
            artifact_dir=artifact_dir,
            prefix="governance_packet_validation_fixture",
            keep_days=30,
            keep_min_count=1,
            apply=False,
        )
        assert summary["mode"] == "dry-run"
        assert summary["candidateCount"] == 2
        assert summary["deletedCount"] == 0


def test_cleanup_apply_deletes_candidates():
    module = _load_script_module()
    with tempfile.TemporaryDirectory() as tmp:
        artifact_dir = Path(tmp)
        now = datetime.now(timezone.utc)
        keep_path = artifact_dir / "governance_packet_validation_fixture_keep.json"
        stale_path = artifact_dir / "governance_packet_validation_fixture_stale.json"
        _write_valid_artifact(keep_path, now)
        _write_valid_artifact(stale_path, now - timedelta(days=90))

        summary = module.run_cleanup(
            artifact_dir=artifact_dir,
            prefix="governance_packet_validation_fixture",
            keep_days=30,
            keep_min_count=1,
            apply=True,
        )
        assert summary["mode"] == "apply"
        assert summary["candidateCount"] == 1
        assert summary["deletedCount"] == 1
        assert keep_path.exists()
        assert not stale_path.exists()
