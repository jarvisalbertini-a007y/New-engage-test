#!/usr/bin/env python3
"""Evaluate whether telemetry snapshot cleanup apply-mode is safe to run."""

from __future__ import annotations

import argparse
import importlib.util
import json
from pathlib import Path
from typing import Any, Dict


def parse_args():
    parser = argparse.ArgumentParser(
        description="Evaluate policy gates for telemetry snapshot cleanup apply-mode."
    )
    parser.add_argument(
        "--snapshot-dir",
        default="backend/test_reports",
        help="Directory containing telemetry snapshot files.",
    )
    parser.add_argument(
        "--prefix",
        default="connector-telemetry-summary",
        help="Filename prefix for telemetry snapshots.",
    )
    parser.add_argument(
        "--keep-days",
        type=int,
        default=30,
        help="Retention threshold in days.",
    )
    parser.add_argument(
        "--keep-min-count",
        type=int,
        default=1,
        help="Always keep at least this many newest snapshots.",
    )
    parser.add_argument(
        "--max-apply-candidates",
        type=int,
        default=20,
        help="Maximum stale candidates allowed for unattended apply-mode cleanup.",
    )
    return parser.parse_args()


def _load_cleanup_module():
    script_path = (
        Path(__file__).resolve().parent / "cleanup_connector_telemetry_snapshots.py"
    )
    spec = importlib.util.spec_from_file_location(
        "cleanup_connector_telemetry_snapshots",
        script_path,
    )
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Failed to load cleanup script module: {script_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def evaluate_policy(
    snapshot_dir: Path,
    prefix: str,
    keep_days: int,
    keep_min_count: int,
    max_apply_candidates: int,
) -> Dict[str, Any]:
    if max_apply_candidates < 1:
        raise ValueError("max-apply-candidates must be >= 1")

    cleanup_module = _load_cleanup_module()
    records = cleanup_module._discover_snapshots(snapshot_dir, prefix)  # noqa: SLF001
    stale_records = cleanup_module.plan_cleanup(
        snapshot_dir=snapshot_dir,
        prefix=prefix,
        keep_days=keep_days,
        keep_min_count=keep_min_count,
    )

    total_count = len(records)
    candidate_count = len(stale_records)

    if candidate_count == 0:
        decision = "SKIP_APPLY"
        reason = "No stale telemetry snapshots are eligible for cleanup."
    elif candidate_count > max_apply_candidates:
        decision = "ACTION_REQUIRED"
        reason = (
            "Stale snapshot candidate count exceeds unattended apply-mode threshold."
        )
    else:
        decision = "ALLOW_APPLY"
        reason = "Stale snapshot candidate count is within unattended cleanup threshold."

    return {
        "decision": decision,
        "reason": reason,
        "policy": {
            "keepDays": keep_days,
            "keepMinCount": keep_min_count,
            "maxApplyCandidates": max_apply_candidates,
        },
        "snapshot": {
            "directory": str(snapshot_dir),
            "prefix": prefix,
            "totalCount": total_count,
            "staleCandidateCount": candidate_count,
            "staleCandidates": [
                str(record.get("path")) for record in stale_records if record.get("path")
            ],
        },
        "recommendedCommand": (
            f".venv311/bin/python backend/scripts/cleanup_connector_telemetry_snapshots.py "
            f"--snapshot-dir {snapshot_dir} --prefix {prefix} --keep-days {keep_days} "
            f"--keep-min-count {keep_min_count} --apply"
            if candidate_count > 0
            else None
        ),
    }


def main() -> int:
    args = parse_args()
    snapshot_dir = Path(args.snapshot_dir)
    if not snapshot_dir.exists():
        print(f"Snapshot directory does not exist: {snapshot_dir}")
        return 1

    try:
        result = evaluate_policy(
            snapshot_dir=snapshot_dir,
            prefix=args.prefix,
            keep_days=args.keep_days,
            keep_min_count=args.keep_min_count,
            max_apply_candidates=args.max_apply_candidates,
        )
    except ValueError as exc:
        print(str(exc))
        return 1

    print(json.dumps(result, indent=2))
    return 1 if result["decision"] == "ACTION_REQUIRED" else 0


if __name__ == "__main__":
    raise SystemExit(main())
