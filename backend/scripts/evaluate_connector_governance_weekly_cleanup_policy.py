#!/usr/bin/env python3
"""Evaluate whether governance weekly report cleanup apply-mode is safe to run."""

from __future__ import annotations

import argparse
import importlib.util
import json
from pathlib import Path
from typing import Any, Dict


def parse_args():
    parser = argparse.ArgumentParser(
        description="Evaluate policy gates for governance weekly report cleanup apply-mode."
    )
    parser.add_argument(
        "--artifact-dir",
        default="backend/test_reports",
        help="Directory containing governance weekly report files.",
    )
    parser.add_argument(
        "--prefix",
        default="connector_governance_weekly_report",
        help="Filename prefix for governance weekly report files.",
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
        help="Always keep at least this many newest reports.",
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
        Path(__file__).resolve().parent / "cleanup_connector_governance_weekly_reports.py"
    )
    spec = importlib.util.spec_from_file_location(
        "cleanup_connector_governance_weekly_reports",
        script_path,
    )
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Failed to load cleanup script module: {script_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def evaluate_policy(
    artifact_dir: Path,
    prefix: str,
    keep_days: int,
    keep_min_count: int,
    max_apply_candidates: int,
) -> Dict[str, Any]:
    if max_apply_candidates < 1:
        raise ValueError("max-apply-candidates must be >= 1")

    cleanup_module = _load_cleanup_module()
    records = cleanup_module._discover_reports(artifact_dir, prefix)  # noqa: SLF001
    stale_records = cleanup_module.plan_cleanup(
        artifact_dir=artifact_dir,
        prefix=prefix,
        keep_days=keep_days,
        keep_min_count=keep_min_count,
    )

    total_count = len(records)
    candidate_count = len(stale_records)

    if candidate_count == 0:
        decision = "SKIP_APPLY"
        reason = "No stale governance weekly reports are eligible for cleanup."
    elif candidate_count > max_apply_candidates:
        decision = "ACTION_REQUIRED"
        reason = (
            "Stale governance report candidate count exceeds unattended apply-mode threshold."
        )
    else:
        decision = "ALLOW_APPLY"
        reason = (
            "Stale governance report candidate count is within unattended cleanup threshold."
        )

    return {
        "decision": decision,
        "reason": reason,
        "policy": {
            "keepDays": keep_days,
            "keepMinCount": keep_min_count,
            "maxApplyCandidates": max_apply_candidates,
        },
        "governanceReport": {
            "directory": str(artifact_dir),
            "prefix": prefix,
            "totalCount": total_count,
            "staleCandidateCount": candidate_count,
            "staleCandidates": [
                str(record.get("path")) for record in stale_records if record.get("path")
            ],
        },
        "recommendedCommand": (
            f".venv311/bin/python backend/scripts/cleanup_connector_governance_weekly_reports.py "
            f"--artifact-dir {artifact_dir} --prefix {prefix} --keep-days {keep_days} "
            f"--keep-min-count {keep_min_count} --apply"
            if candidate_count > 0
            else None
        ),
    }


def main() -> int:
    args = parse_args()
    artifact_dir = Path(args.artifact_dir)
    if not artifact_dir.exists():
        print(f"Artifact directory does not exist: {artifact_dir}")
        return 1
    try:
        result = evaluate_policy(
            artifact_dir=artifact_dir,
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
