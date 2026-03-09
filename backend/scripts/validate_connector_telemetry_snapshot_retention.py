#!/usr/bin/env python3
"""Validate connector telemetry snapshot retention policy for rollout audits."""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any, Dict, List


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


def _parse_iso_datetime(value: Any) -> datetime | None:
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


def _extract_generated_at(payload: Dict[str, Any]) -> datetime | None:
    return _parse_iso_datetime(payload.get("generatedAt"))


def _validate_connector_rollup_freshness(
    payload: Dict[str, Any],
    *,
    snapshot_path: Path,
    snapshot_generated_at: datetime,
    max_age_days: int,
) -> List[str]:
    errors: List[str] = []
    connector_rate_limit = payload.get("connectorRateLimit")
    if connector_rate_limit is None:
        return errors
    if not isinstance(connector_rate_limit, dict):
        errors.append(
            f"connectorRateLimit must be an object in newest snapshot: {snapshot_path}"
        )
        return errors

    event_count = connector_rate_limit.get("eventCount")
    if event_count is not None and not isinstance(event_count, int):
        errors.append(
            f"connectorRateLimit.eventCount must be an integer in newest snapshot: {snapshot_path}"
        )
        return errors

    latest_event_raw = connector_rate_limit.get("latestEventAt")
    latest_event_at = _parse_iso_datetime(latest_event_raw)
    normalized_event_count = int(event_count or 0)

    if normalized_event_count > 0 and latest_event_at is None:
        errors.append(
            "connectorRateLimit.latestEventAt must be a valid timestamp when "
            f"connectorRateLimit.eventCount > 0 in newest snapshot: {snapshot_path}"
        )
        return errors

    if latest_event_raw is not None and latest_event_at is None:
        errors.append(
            f"connectorRateLimit.latestEventAt must be a valid timestamp in newest snapshot: {snapshot_path}"
        )
        return errors

    if latest_event_at is None:
        return errors

    if latest_event_at > snapshot_generated_at:
        errors.append(
            f"connectorRateLimit.latestEventAt is newer than generatedAt in newest snapshot: {snapshot_path}"
        )
        return errors

    lag = snapshot_generated_at - latest_event_at
    if lag > timedelta(days=max_age_days):
        errors.append(
            "connectorRateLimit.latestEventAt is older than "
            f"{max_age_days} days relative to generatedAt in newest snapshot: {snapshot_path}"
        )
    return errors


def _validate_sendgrid_timestamp_rollup_freshness(
    payload: Dict[str, Any],
    *,
    snapshot_path: Path,
    snapshot_generated_at: datetime,
    max_age_days: int,
) -> List[str]:
    errors: List[str] = []
    sendgrid_rollup = payload.get("sendgridWebhookTimestamp")
    if sendgrid_rollup is None:
        return errors
    if not isinstance(sendgrid_rollup, dict):
        errors.append(
            f"sendgridWebhookTimestamp must be an object in newest snapshot: {snapshot_path}"
        )
        return errors

    event_count = sendgrid_rollup.get("eventCount")
    if event_count is not None and not isinstance(event_count, int):
        errors.append(
            f"sendgridWebhookTimestamp.eventCount must be an integer in newest snapshot: {snapshot_path}"
        )
        return errors

    latest_event_raw = sendgrid_rollup.get("latestEventAt")
    latest_event_at = _parse_iso_datetime(latest_event_raw)
    normalized_event_count = int(event_count or 0)

    if normalized_event_count > 0 and latest_event_at is None:
        errors.append(
            "sendgridWebhookTimestamp.latestEventAt must be a valid timestamp when "
            "sendgridWebhookTimestamp.eventCount > 0 in newest snapshot: "
            f"{snapshot_path}"
        )
        return errors

    if latest_event_raw is not None and latest_event_at is None:
        errors.append(
            f"sendgridWebhookTimestamp.latestEventAt must be a valid timestamp in newest snapshot: {snapshot_path}"
        )
        return errors

    if latest_event_at is None:
        return errors

    if latest_event_at > snapshot_generated_at:
        errors.append(
            f"sendgridWebhookTimestamp.latestEventAt is newer than generatedAt in newest snapshot: {snapshot_path}"
        )
        return errors

    lag = snapshot_generated_at - latest_event_at
    if lag > timedelta(days=max_age_days):
        errors.append(
            "sendgridWebhookTimestamp.latestEventAt is older than "
            f"{max_age_days} days relative to generatedAt in newest snapshot: {snapshot_path}"
        )
    return errors


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
    try:
        newest_payload = json.loads(newest_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        errors.append(f"Newest snapshot is not valid JSON: {newest_path}")
        return errors

    if not isinstance(newest_payload, dict):
        errors.append(f"Newest snapshot root must be an object: {newest_path}")
        return errors

    newest_ts = _extract_generated_at(newest_payload)
    if newest_ts is None:
        errors.append(
            f"Newest snapshot missing valid generatedAt timestamp: {newest_path}"
        )
        return errors

    errors.extend(
        _validate_connector_rollup_freshness(
            newest_payload,
            snapshot_path=newest_path,
            snapshot_generated_at=newest_ts,
            max_age_days=max_age_days,
        )
    )
    errors.extend(
        _validate_sendgrid_timestamp_rollup_freshness(
            newest_payload,
            snapshot_path=newest_path,
            snapshot_generated_at=newest_ts,
            max_age_days=max_age_days,
        )
    )

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
