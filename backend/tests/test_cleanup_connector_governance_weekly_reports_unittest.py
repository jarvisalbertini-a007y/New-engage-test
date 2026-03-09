import importlib.util
import json
from datetime import datetime, timezone, timedelta
from pathlib import Path
import tempfile


SCRIPT_PATH = (
    Path(__file__).resolve().parents[1]
    / "scripts"
    / "cleanup_connector_governance_weekly_reports.py"
)


def _load_script_module():
    spec = importlib.util.spec_from_file_location(
        "cleanup_connector_governance_weekly_reports", SCRIPT_PATH
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


def test_plan_cleanup_returns_stale_candidates_but_keeps_min_count():
    module = _load_script_module()
    with tempfile.TemporaryDirectory() as tmp:
        artifact_dir = Path(tmp)
        _write_report(
            artifact_dir / "connector_governance_weekly_report-recent.json",
            datetime.now(timezone.utc),
        )
        _write_report(
            artifact_dir / "connector_governance_weekly_report-stale-a.json",
            datetime.now(timezone.utc) - timedelta(days=40),
        )
        _write_report(
            artifact_dir / "connector_governance_weekly_report-stale-b.json",
            datetime.now(timezone.utc) - timedelta(days=50),
        )

        stale = module.plan_cleanup(
            artifact_dir=artifact_dir,
            prefix="connector_governance_weekly_report",
            keep_days=30,
            keep_min_count=1,
        )
        assert len(stale) == 2


def test_execute_cleanup_dry_run_does_not_delete_files():
    module = _load_script_module()
    with tempfile.TemporaryDirectory() as tmp:
        artifact_dir = Path(tmp)
        stale_path = artifact_dir / "connector_governance_weekly_report-stale.json"
        _write_report(stale_path, datetime.now(timezone.utc) - timedelta(days=60))
        stale_records = module.plan_cleanup(
            artifact_dir=artifact_dir,
            prefix="connector_governance_weekly_report",
            keep_days=30,
            keep_min_count=1,
        )
        summary = module.execute_cleanup(stale_records=stale_records, apply=False)
        assert summary["deletedCount"] == 0
        assert stale_path.exists()


def test_execute_cleanup_apply_deletes_stale_files():
    module = _load_script_module()
    with tempfile.TemporaryDirectory() as tmp:
        artifact_dir = Path(tmp)
        recent_path = artifact_dir / "connector_governance_weekly_report-recent.json"
        stale_path = artifact_dir / "connector_governance_weekly_report-stale.json"
        _write_report(recent_path, datetime.now(timezone.utc))
        _write_report(stale_path, datetime.now(timezone.utc) - timedelta(days=60))
        stale_records = module.plan_cleanup(
            artifact_dir=artifact_dir,
            prefix="connector_governance_weekly_report",
            keep_days=30,
            keep_min_count=1,
        )
        summary = module.execute_cleanup(stale_records=stale_records, apply=True)
        assert summary["deletedCount"] == 1
        assert recent_path.exists()
        assert not stale_path.exists()


def test_main_returns_nonzero_for_invalid_keep_days():
    module = _load_script_module()
    with tempfile.TemporaryDirectory() as tmp:
        artifact_dir = Path(tmp)
        _write_report(
            artifact_dir / "connector_governance_weekly_report-recent.json",
            datetime.now(timezone.utc),
        )

        args = type(
            "_Args",
            (),
            {
                "artifact_dir": str(artifact_dir),
                "prefix": "connector_governance_weekly_report",
                "keep_days": 0,
                "keep_min_count": 1,
                "apply": False,
            },
        )()

        original_parse = module.parse_args
        try:
            module.parse_args = lambda: args
            exit_code = module.main()
        finally:
            module.parse_args = original_parse

        assert exit_code == 1
