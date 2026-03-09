import importlib.util
import json
from datetime import datetime, timezone, timedelta
from pathlib import Path
import tempfile


SCRIPT_PATH = (
    Path(__file__).resolve().parents[1]
    / "scripts"
    / "validate_connector_governance_weekly_report_retention.py"
)


def _load_script_module():
    spec = importlib.util.spec_from_file_location(
        "validate_connector_governance_weekly_report_retention", SCRIPT_PATH
    )
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def _write_report(path: Path, generated_at: datetime):
    path.write_text(
        json.dumps({"generatedAt": generated_at.isoformat(), "totals": {"governanceEventCount": 1}}),
        encoding="utf-8",
    )


def test_validate_retention_accepts_recent_governance_report():
    module = _load_script_module()
    with tempfile.TemporaryDirectory() as tmp:
        artifact_dir = Path(tmp)
        _write_report(
            artifact_dir / "connector_governance_weekly_report.json",
            datetime.now(timezone.utc),
        )
        errors = module.validate_retention(
            artifact_dir=artifact_dir,
            prefix="connector_governance_weekly_report",
            min_count=1,
            max_age_days=30,
        )
        assert errors == []


def test_validate_retention_rejects_stale_governance_report():
    module = _load_script_module()
    with tempfile.TemporaryDirectory() as tmp:
        artifact_dir = Path(tmp)
        _write_report(
            artifact_dir / "connector_governance_weekly_report-stale.json",
            datetime.now(timezone.utc) - timedelta(days=60),
        )
        errors = module.validate_retention(
            artifact_dir=artifact_dir,
            prefix="connector_governance_weekly_report",
            min_count=1,
            max_age_days=30,
        )
        assert any("older than 30 days" in error for error in errors)


def test_main_returns_nonzero_for_invalid_min_count():
    module = _load_script_module()
    with tempfile.TemporaryDirectory() as tmp:
        artifact_dir = Path(tmp)
        _write_report(
            artifact_dir / "connector_governance_weekly_report.json",
            datetime.now(timezone.utc),
        )

        args = type(
            "_Args",
            (),
            {
                "artifact_dir": str(artifact_dir),
                "prefix": "connector_governance_weekly_report",
                "min_count": 0,
                "max_age_days": 30,
            },
        )()

        original_parse = module.parse_args
        try:
            module.parse_args = lambda: args
            exit_code = module.main()
        finally:
            module.parse_args = original_parse

        assert exit_code == 1
