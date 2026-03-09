#!/usr/bin/env python3
"""Validate retention posture for baseline metrics artifacts."""

from __future__ import annotations

import argparse
import importlib.util
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Validate retention policy for baseline metrics artifacts."
    )
    parser.add_argument(
        "--artifact-dir",
        default="backend/test_reports",
        help="Directory containing baseline metrics artifacts.",
    )
    parser.add_argument(
        "--prefix",
        default="baseline_metrics",
        help="Baseline metrics artifact filename prefix.",
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


def _load_validator_module():
    script_path = Path(__file__).resolve().parent / "validate_baseline_metrics_artifact.py"
    spec = importlib.util.spec_from_file_location(
        "validate_baseline_metrics_artifact",
        script_path,
    )
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load validator module: {script_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def discover_artifacts(artifact_dir: Path, prefix: str) -> List[Dict[str, Any]]:
    validator = _load_validator_module()
    records: List[Dict[str, Any]] = []
    for path in sorted(artifact_dir.glob(f"{prefix}_*.json")):
        payload = _load_payload(path)
        generated_at = _parse_iso_datetime(payload.get("generatedAt")) if payload else None
        contract_errors: List[str] = []
        if isinstance(payload, dict):
            contract_errors = list(validator.validate_artifact(payload))
        records.append(
            {
                "path": path,
                "payload": payload,
                "generatedAt": generated_at,
                "contractErrors": contract_errors,
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

    invalid_contract_count = len(
        [
            record
            for record in records
            if isinstance(record.get("payload"), dict)
            and len(record.get("contractErrors") or []) > 0
        ]
    )
    if invalid_contract_count > 0:
        errors.append(
            f"Found {invalid_contract_count} artifact(s) that failed baseline metrics contract validation."
        )

    newest = records[0]
    newest_generated_at = newest.get("generatedAt")
    newest_path = newest.get("path")
    if not isinstance(newest_path, Path):
        errors.append("Unable to resolve newest baseline metrics artifact path.")
        return errors
    if newest_generated_at is None:
        errors.append(f"Newest baseline metrics artifact missing valid generatedAt: {newest_path}")
        return errors

    age = datetime.now(timezone.utc) - newest_generated_at
    if age > timedelta(days=max_age_days):
        errors.append(
            f"Newest baseline metrics artifact {newest_path.name} is older than {max_age_days} days."
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
        print("Baseline metrics artifact retention validation failed:")
        for error in errors:
            print(f"- {error}")
        return 1

    print(
        f"Baseline metrics artifact retention validation passed: {artifact_dir} "
        f"(prefix={args.prefix})"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
