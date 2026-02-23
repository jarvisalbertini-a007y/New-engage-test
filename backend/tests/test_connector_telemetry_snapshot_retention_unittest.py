import importlib.util
import json
from pathlib import Path
import tempfile
from datetime import datetime, timezone, timedelta


SCRIPT_PATH = (
    Path(__file__).resolve().parents[1]
    / "scripts"
    / "validate_connector_telemetry_snapshot_retention.py"
)


def _load_script_module():
    spec = importlib.util.spec_from_file_location(
        "validate_connector_telemetry_snapshot_retention", SCRIPT_PATH
    )
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def _write_snapshot(path: Path, generated_at: str):
    path.write_text(
        json.dumps(
            {
                "generatedAt": generated_at,
                "traceabilityAudit": {
                    "eventCount": 1,
                    "decisionCounts": {"HOLD": 1},
                    "readyCount": 0,
                    "notReadyCount": 1,
                },
            }
        ),
        encoding="utf-8",
    )


def test_validate_retention_accepts_recent_snapshot():
    module = _load_script_module()
    with tempfile.TemporaryDirectory() as tmp:
        snapshot_dir = Path(tmp)
        snapshot = snapshot_dir / "connector-telemetry-summary-2026-02-22.json"
        _write_snapshot(snapshot, datetime.now(timezone.utc).isoformat())

        errors = module.validate_retention(
            snapshot_dir=snapshot_dir,
            prefix="connector-telemetry-summary",
            min_count=1,
            max_age_days=30,
        )
        assert errors == []


def test_validate_retention_rejects_missing_snapshots():
    module = _load_script_module()
    with tempfile.TemporaryDirectory() as tmp:
        snapshot_dir = Path(tmp)
        errors = module.validate_retention(
            snapshot_dir=snapshot_dir,
            prefix="connector-telemetry-summary",
            min_count=1,
            max_age_days=30,
        )
        assert any("Expected at least" in error for error in errors)


def test_validate_retention_rejects_stale_newest_snapshot():
    module = _load_script_module()
    with tempfile.TemporaryDirectory() as tmp:
        snapshot_dir = Path(tmp)
        snapshot = snapshot_dir / "connector-telemetry-summary-2026-01-01.json"
        stale_ts = (datetime.now(timezone.utc) - timedelta(days=45)).isoformat()
        _write_snapshot(snapshot, stale_ts)

        errors = module.validate_retention(
            snapshot_dir=snapshot_dir,
            prefix="connector-telemetry-summary",
            min_count=1,
            max_age_days=30,
        )
        assert any("older than 30 days" in error for error in errors)


def test_main_returns_nonzero_when_snapshot_dir_missing():
    module = _load_script_module()
    with tempfile.TemporaryDirectory() as tmp:
        missing_dir = Path(tmp) / "missing"

        class _Args:
            snapshot_dir = str(missing_dir)
            prefix = "connector-telemetry-summary"
            min_count = 1
            max_age_days = 30

        original_parse = module.parse_args
        try:
            module.parse_args = lambda: _Args
            exit_code = module.main()
        finally:
            module.parse_args = original_parse

        assert exit_code == 1
