#!/usr/bin/env python3
"""Validate connector telemetry snapshot retention policy for rollout audits."""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import List


def parse_args():
    parser = argparse.ArgumentParser(
        description="Validate telemetry snapshot retention policy."
    )
    parser.add_argument(
        "--snapshot-dir",
        default="backend/test_reports",
        help="Directory containing telemetry snapshot artifacts.",
    )
    parser.add_argument(
        "--prefix",
        default="connector-telemetry-summary",
        help="Snapshot filename prefix.",
    )
    parser.add_argument(
        "--min-count",
        type=int,
        default=1,
        help="Minimum number of snapshot files required.",
    )
    parser.add_argument(
        "--max-age-days",
        type=int,
        default=30,
        help="Maximum allowed age of the newest snapshot.",
    )
    return parser.parse_args()


def _discover_snapshot_files(snapshot_dir: Path, prefix: str) -> List[Path]:
    return sorted(snapshot_dir.glob(f"{prefix}*.json"))


def _extract_generated_at(path: Path) -> datetime | None:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None
    generated_at = payload.get("generatedAt")
    if not isinstance(generated_at, str) or not generated_at.strip():
        return None
    normalized = generated_at.replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def validate_retention(
    snapshot_dir: Path,
    prefix: str,
    min_count: int,
    max_age_days: int,
) -> List[str]:
    errors: List[str] = []
    snapshots = _discover_snapshot_files(snapshot_dir, prefix)
    if len(snapshots) < min_count:
        errors.append(
            f"Expected at least {min_count} {prefix} snapshot file(s), found {len(snapshots)}"
        )
        return errors

    newest_path = snapshots[-1]
    newest_ts = _extract_generated_at(newest_path)
    if newest_ts is None:
        errors.append(
            f"Newest snapshot missing valid generatedAt timestamp: {newest_path}"
        )
        return errors

    max_age = timedelta(days=max_age_days)
    age = datetime.now(timezone.utc) - newest_ts
    if age > max_age:
        errors.append(
            f"Newest snapshot {newest_path.name} is older than {max_age_days} days"
        )

    return errors


def main() -> int:
    args = parse_args()
    snapshot_dir = Path(args.snapshot_dir)
    if not snapshot_dir.exists():
        print(f"Snapshot directory does not exist: {snapshot_dir}")
        return 1
    if args.min_count < 1:
        print("min-count must be >= 1")
        return 1
    if args.max_age_days < 1:
        print("max-age-days must be >= 1")
        return 1

    errors = validate_retention(
        snapshot_dir=snapshot_dir,
        prefix=args.prefix,
        min_count=args.min_count,
        max_age_days=args.max_age_days,
    )
    if errors:
        print("Telemetry snapshot retention validation failed:")
        for error in errors:
            print(f"- {error}")
        return 1

    print(
        f"Telemetry snapshot retention validation passed: {snapshot_dir} "
        f"(prefix={args.prefix})"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
