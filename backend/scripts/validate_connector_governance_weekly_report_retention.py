#!/usr/bin/env python3
"""Validate governance weekly report retention policy for rollout evidence."""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import List


def parse_args():
    parser = argparse.ArgumentParser(
        description="Validate governance weekly report retention policy."
    )
    parser.add_argument(
        "--artifact-dir",
        default="backend/test_reports",
        help="Directory containing governance weekly report artifacts.",
    )
    parser.add_argument(
        "--prefix",
        default="connector_governance_weekly_report",
        help="Governance report filename prefix.",
    )
    parser.add_argument(
        "--min-count",
        type=int,
        default=1,
        help="Minimum number of governance report files required.",
    )
    parser.add_argument(
        "--max-age-days",
        type=int,
        default=30,
        help="Maximum allowed age for newest governance report file.",
    )
    return parser.parse_args()


def _discover_report_files(artifact_dir: Path, prefix: str) -> List[Path]:
    return sorted(artifact_dir.glob(f"{prefix}*.json"))


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
    artifact_dir: Path,
    prefix: str,
    min_count: int,
    max_age_days: int,
) -> List[str]:
    errors: List[str] = []
    reports = _discover_report_files(artifact_dir, prefix)
    if len(reports) < min_count:
        errors.append(
            f"Expected at least {min_count} {prefix} report file(s), found {len(reports)}"
        )
        return errors

    newest_path = reports[-1]
    newest_ts = _extract_generated_at(newest_path)
    if newest_ts is None:
        errors.append(
            f"Newest governance report missing valid generatedAt timestamp: {newest_path}"
        )
        return errors

    max_age = timedelta(days=max_age_days)
    age = datetime.now(timezone.utc) - newest_ts
    if age > max_age:
        errors.append(
            f"Newest governance report {newest_path.name} is older than {max_age_days} days"
        )

    return errors


def main() -> int:
    args = parse_args()
    artifact_dir = Path(args.artifact_dir)
    if not artifact_dir.exists():
        print(f"Artifact directory does not exist: {artifact_dir}")
        return 1
    if args.min_count < 1:
        print("min-count must be >= 1")
        return 1
    if args.max_age_days < 1:
        print("max-age-days must be >= 1")
        return 1

    errors = validate_retention(
        artifact_dir=artifact_dir,
        prefix=args.prefix,
        min_count=args.min_count,
        max_age_days=args.max_age_days,
    )
    if errors:
        print("Governance weekly report retention validation failed:")
        for error in errors:
            print(f"- {error}")
        return 1

    print(
        f"Governance weekly report retention validation passed: {artifact_dir} "
        f"(prefix={args.prefix})"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
