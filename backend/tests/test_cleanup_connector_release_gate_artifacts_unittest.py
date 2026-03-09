import importlib.util
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
import tempfile


SCRIPT_PATH = (
    Path(__file__).resolve().parents[1]
    / "scripts"
    / "cleanup_connector_release_gate_artifacts.py"
)
FIXTURE_SCRIPT_PATH = (
    Path(__file__).resolve().parents[1]
    / "scripts"
    / "generate_connector_release_gate_artifact_fixture.py"
)


def _load_script_module():
    spec = importlib.util.spec_from_file_location(
        "cleanup_connector_release_gate_artifacts",
        SCRIPT_PATH,
    )
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def _load_fixture_module():
    spec = importlib.util.spec_from_file_location(
        "generate_connector_release_gate_artifact_fixture",
        FIXTURE_SCRIPT_PATH,
    )
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def _write_artifact(path: Path, evaluated_at: datetime):
    fixture_module = _load_fixture_module()
    payload = fixture_module.build_fixture_payload("pass")
    payload["evaluatedAt"] = evaluated_at.isoformat()
    path.write_text(json.dumps(payload), encoding="utf-8")


def test_connector_release_gate_cleanup_dry_run_marks_stale_and_invalid_candidates():
    module = _load_script_module()
    with tempfile.TemporaryDirectory() as tmp:
        artifact_dir = Path(tmp)
        now = datetime.now(timezone.utc)
        _write_artifact(artifact_dir / "connector_release_gate_result_recent.json", now)
        _write_artifact(
            artifact_dir / "connector_release_gate_result_stale.json",
            now - timedelta(days=90),
        )
        (artifact_dir / "connector_release_gate_result_invalid.json").write_text(
            json.dumps({"evaluatedAt": now.isoformat(), "approved": "yes"}),
            encoding="utf-8",
        )

        summary = module.run_cleanup(
            artifact_dir=artifact_dir,
            prefix="connector_release_gate_result",
            keep_days=30,
            keep_min_count=1,
            apply=False,
        )
        assert summary["mode"] == "dry-run"
        assert summary["candidateCount"] == 2
        assert summary["deletedCount"] == 0


def test_connector_release_gate_cleanup_apply_deletes_candidates():
    module = _load_script_module()
    with tempfile.TemporaryDirectory() as tmp:
        artifact_dir = Path(tmp)
        now = datetime.now(timezone.utc)
        keep_path = artifact_dir / "connector_release_gate_result_keep.json"
        stale_path = artifact_dir / "connector_release_gate_result_stale.json"
        _write_artifact(keep_path, now)
        _write_artifact(stale_path, now - timedelta(days=90))

        summary = module.run_cleanup(
            artifact_dir=artifact_dir,
            prefix="connector_release_gate_result",
            keep_days=30,
            keep_min_count=1,
            apply=True,
        )
        assert summary["mode"] == "apply"
        assert summary["candidateCount"] == 1
        assert summary["deletedCount"] == 1
        assert keep_path.exists()
        assert not stale_path.exists()
