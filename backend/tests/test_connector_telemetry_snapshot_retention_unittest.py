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


def _write_snapshot(
    path: Path,
    generated_at: str,
    *,
    connector_event_count: int = 1,
    connector_latest_event_at: str | None = None,
    sendgrid_event_count: int = 1,
    sendgrid_latest_event_at: str | None = None,
):
    if connector_latest_event_at is None and connector_event_count > 0:
        connector_latest_event_at = generated_at
    if sendgrid_latest_event_at is None and sendgrid_event_count > 0:
        sendgrid_latest_event_at = generated_at
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
                "connectorRateLimit": {
                    "eventCount": connector_event_count,
                    "latestEventAt": connector_latest_event_at,
                },
                "sendgridWebhookTimestamp": {
                    "eventCount": sendgrid_event_count,
                    "latestEventAt": sendgrid_latest_event_at,
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


def test_validate_retention_rejects_missing_connector_latest_event_at_when_events_exist():
    module = _load_script_module()
    with tempfile.TemporaryDirectory() as tmp:
        snapshot_dir = Path(tmp)
        snapshot = snapshot_dir / "connector-telemetry-summary-2026-02-22.json"
        _write_snapshot(
            snapshot,
            datetime.now(timezone.utc).isoformat(),
            connector_event_count=2,
            connector_latest_event_at=None,
        )

        payload = json.loads(snapshot.read_text(encoding="utf-8"))
        payload["connectorRateLimit"]["latestEventAt"] = None
        snapshot.write_text(json.dumps(payload), encoding="utf-8")

        errors = module.validate_retention(
            snapshot_dir=snapshot_dir,
            prefix="connector-telemetry-summary",
            min_count=1,
            max_age_days=30,
        )
        assert any(
            "connectorRateLimit.latestEventAt must be a valid timestamp" in error
            for error in errors
        )


def test_validate_retention_rejects_stale_connector_rollup_relative_to_snapshot():
    module = _load_script_module()
    with tempfile.TemporaryDirectory() as tmp:
        snapshot_dir = Path(tmp)
        snapshot = snapshot_dir / "connector-telemetry-summary-2026-02-22.json"
        generated_at = datetime.now(timezone.utc).isoformat()
        stale_connector_latest = (
            datetime.now(timezone.utc) - timedelta(days=31)
        ).isoformat()
        _write_snapshot(
            snapshot,
            generated_at,
            connector_event_count=3,
            connector_latest_event_at=stale_connector_latest,
        )

        errors = module.validate_retention(
            snapshot_dir=snapshot_dir,
            prefix="connector-telemetry-summary",
            min_count=1,
            max_age_days=30,
        )
        assert any(
            "connectorRateLimit.latestEventAt is older than 30 days" in error
            for error in errors
        )


def test_validate_retention_accepts_missing_connector_latest_event_at_when_no_events():
    module = _load_script_module()
    with tempfile.TemporaryDirectory() as tmp:
        snapshot_dir = Path(tmp)
        snapshot = snapshot_dir / "connector-telemetry-summary-2026-02-22.json"
        _write_snapshot(
            snapshot,
            datetime.now(timezone.utc).isoformat(),
            connector_event_count=0,
            connector_latest_event_at=None,
        )

        errors = module.validate_retention(
            snapshot_dir=snapshot_dir,
            prefix="connector-telemetry-summary",
            min_count=1,
            max_age_days=30,
        )
        assert errors == []


def test_validate_retention_rejects_missing_sendgrid_latest_event_at_when_events_exist():
    module = _load_script_module()
    with tempfile.TemporaryDirectory() as tmp:
        snapshot_dir = Path(tmp)
        snapshot = snapshot_dir / "connector-telemetry-summary-2026-02-22.json"
        _write_snapshot(
            snapshot,
            datetime.now(timezone.utc).isoformat(),
            sendgrid_event_count=2,
            sendgrid_latest_event_at=None,
        )

        payload = json.loads(snapshot.read_text(encoding="utf-8"))
        payload["sendgridWebhookTimestamp"]["latestEventAt"] = None
        snapshot.write_text(json.dumps(payload), encoding="utf-8")

        errors = module.validate_retention(
            snapshot_dir=snapshot_dir,
            prefix="connector-telemetry-summary",
            min_count=1,
            max_age_days=30,
        )
        assert any(
            "sendgridWebhookTimestamp.latestEventAt must be a valid timestamp"
            in error
            for error in errors
        )


def test_validate_retention_rejects_stale_sendgrid_rollup_relative_to_snapshot():
    module = _load_script_module()
    with tempfile.TemporaryDirectory() as tmp:
        snapshot_dir = Path(tmp)
        snapshot = snapshot_dir / "connector-telemetry-summary-2026-02-22.json"
        generated_at = datetime.now(timezone.utc).isoformat()
        stale_sendgrid_latest = (
            datetime.now(timezone.utc) - timedelta(days=31)
        ).isoformat()
        _write_snapshot(
            snapshot,
            generated_at,
            sendgrid_event_count=2,
            sendgrid_latest_event_at=stale_sendgrid_latest,
        )

        errors = module.validate_retention(
            snapshot_dir=snapshot_dir,
            prefix="connector-telemetry-summary",
            min_count=1,
            max_age_days=30,
        )
        assert any(
            "sendgridWebhookTimestamp.latestEventAt is older than 30 days" in error
            for error in errors
        )


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
