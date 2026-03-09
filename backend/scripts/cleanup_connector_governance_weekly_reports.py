#!/usr/bin/env python3
"""Cleanup stale governance weekly report artifacts with dry-run safety."""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import List


def parse_args():
    parser = argparse.ArgumentParser(
        description="Cleanup stale governance weekly report files."
    )
    parser.add_argument(
        "--artifact-dir",
        default="backend/test_reports",
        help="Directory containing governance weekly report files.",
    )
    parser.add_argument(
        "--prefix",
        default="connector_governance_weekly_report",
        help="Filename prefix for governance reports.",
    )
    parser.add_argument(
        "--keep-days",
        type=int,
        default=30,
        help="Retain reports newer than this many days.",
    )
    parser.add_argument(
        "--keep-min-count",
        type=int,
        default=1,
        help="Always keep at least this many newest reports.",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Delete stale files. Without this flag, cleanup runs in dry-run mode.",
    )
    return parser.parse_args()


def _parse_generated_at(artifact_path: Path) -> datetime | None:
    try:
        payload = json.loads(artifact_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None
    value = payload.get("generatedAt")
    if not isinstance(value, str) or not value.strip():
        return None
    normalized = value.replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _discover_reports(artifact_dir: Path, prefix: str) -> List[dict]:
    records: List[dict] = []
    for path in sorted(artifact_dir.glob(f"{prefix}*.json")):
        records.append({"path": path, "generated_at": _parse_generated_at(path)})
    records.sort(
        key=lambda record: (
            record.get("generated_at") or datetime.min.replace(tzinfo=timezone.utc),
            str((record.get("path") or Path("")).name),
        ),
        reverse=True,
    )
    return records


def plan_cleanup(
    artifact_dir: Path,
    prefix: str,
    keep_days: int,
    keep_min_count: int,
) -> List[dict]:
    records = _discover_reports(artifact_dir, prefix)
    if keep_days < 1:
        raise ValueError("keep-days must be >= 1")
    if keep_min_count < 1:
        raise ValueError("keep-min-count must be >= 1")

    threshold = datetime.now(timezone.utc) - timedelta(days=keep_days)
    stale_candidates: List[dict] = []
    for idx, record in enumerate(records):
        if idx < keep_min_count:
            continue
        generated_at = record.get("generated_at")
        if generated_at is None or generated_at < threshold:
            stale_candidates.append(record)
    return stale_candidates


def execute_cleanup(stale_records: List[dict], apply: bool) -> dict:
    deleted_paths: List[str] = []
    for record in stale_records:
        path = record.get("path")
        if not isinstance(path, Path):
            continue
        if apply:
            path.unlink(missing_ok=True)
            deleted_paths.append(str(path))
    return {
        "mode": "apply" if apply else "dry-run",
        "candidateCount": len(stale_records),
        "deletedCount": len(deleted_paths),
        "candidates": [str(record.get("path")) for record in stale_records],
        "deleted": deleted_paths,
    }


def main() -> int:
    args = parse_args()
    artifact_dir = Path(args.artifact_dir)
    if not artifact_dir.exists():
        print(f"Artifact directory does not exist: {artifact_dir}")
        return 1
    try:
        stale_records = plan_cleanup(
            artifact_dir=artifact_dir,
            prefix=args.prefix,
            keep_days=args.keep_days,
            keep_min_count=args.keep_min_count,
        )
    except ValueError as exc:
        print(str(exc))
        return 1

    summary = execute_cleanup(stale_records=stale_records, apply=args.apply)
    print(
        f"Governance weekly report cleanup {summary['mode']} completed: "
        f"{summary['candidateCount']} candidate(s), {summary['deletedCount']} deleted."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
