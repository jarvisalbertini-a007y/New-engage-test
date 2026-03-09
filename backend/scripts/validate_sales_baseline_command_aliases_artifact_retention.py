#!/usr/bin/env python3
"""Validate retention posture for baseline command-alias artifacts."""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List


EXPECTED_COMMAND = "verify_sales_baseline_command_aliases"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Validate retention policy for baseline command-alias artifacts."
    )
    parser.add_argument(
        "--artifact-dir",
        default="backend/test_reports",
        help="Directory containing baseline command-alias artifacts.",
    )
    parser.add_argument(
        "--prefix",
        default="sales_baseline_command_aliases",
        help="Baseline command-alias artifact filename prefix.",
    )
    parser.add_argument(
        "--min-count",
        type=int,
        default=3,
        help="Minimum number of artifacts required.",
    )
    parser.add_argument(
        "--max-age-days",
        type=int,
        default=30,
        help="Maximum age in days for newest artifact.",
    )
    return parser.parse_args()


def _parse_iso_datetime(value: Any) -> datetime | None:
    if not isinstance(value, str) or not value.strip():
        return None
    normalized = value.strip().replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _load_payload(path: Path) -> Dict[str, Any] | None:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None
    if not isinstance(payload, dict):
        return None
    return payload


def discover_artifacts(artifact_dir: Path, prefix: str) -> List[Dict[str, Any]]:
    records: List[Dict[str, Any]] = []
    for path in sorted(artifact_dir.glob(f"{prefix}_*.json")):
        payload = _load_payload(path)
        generated_at = _parse_iso_datetime(payload.get("generatedAt")) if payload else None
        command = payload.get("command") if isinstance(payload, dict) else None
        records.append(
            {
                "path": path,
                "payload": payload,
                "generatedAt": generated_at,
                "command": command,
            }
        )
    records.sort(
        key=lambda record: (
            record.get("generatedAt") or datetime.min.replace(tzinfo=timezone.utc),
            str((record.get("path") or Path("")).name),
        ),
        reverse=True,
    )
    return records


def validate_retention(
    artifact_dir: Path,
    prefix: str,
    min_count: int,
    max_age_days: int,
) -> List[str]:
    errors: List[str] = []
    records = discover_artifacts(artifact_dir, prefix)
    if len(records) < min_count:
        errors.append(
            f"Expected at least {min_count} {prefix} artifact file(s), found {len(records)}."
        )
        return errors

    invalid_payload_count = len([record for record in records if record.get("payload") is None])
    if invalid_payload_count > 0:
        errors.append(f"Found {invalid_payload_count} artifact(s) with invalid JSON payloads.")

    invalid_command_count = len(
        [
            record
            for record in records
            if record.get("command") != EXPECTED_COMMAND
        ]
    )
    if invalid_command_count > 0:
        errors.append(
            f"Found {invalid_command_count} artifact(s) with unexpected command values."
        )

    newest = records[0]
    newest_generated_at = newest.get("generatedAt")
    newest_path = newest.get("path")
    if not isinstance(newest_path, Path):
        errors.append("Unable to resolve newest baseline command-alias artifact path.")
        return errors
    if newest_generated_at is None:
        errors.append(f"Newest baseline command-alias artifact missing valid generatedAt: {newest_path}")
        return errors

    age = datetime.now(timezone.utc) - newest_generated_at
    if age > timedelta(days=max_age_days):
        errors.append(
            f"Newest baseline command-alias artifact {newest_path.name} is older than {max_age_days} days."
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
        print("Baseline command-alias artifact retention validation failed:")
        for error in errors:
            print(f"- {error}")
        return 1

    print(
        f"Baseline command-alias artifact retention validation passed: {artifact_dir} "
        f"(prefix={args.prefix})"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
