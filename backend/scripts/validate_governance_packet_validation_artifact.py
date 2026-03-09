#!/usr/bin/env python3
"""Validate governance packet validation artifact shape."""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List


REQUIRED_CHECK_SECTIONS = ("handoff", "history", "crossArtifact")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Validate governance packet validation artifact JSON shape."
    )
    parser.add_argument(
        "--artifact",
        required=True,
        help="Path to governance packet validation artifact JSON.",
    )
    return parser.parse_args()


def _is_non_empty_string(value: Any) -> bool:
    return isinstance(value, str) and bool(value.strip())


def _parse_iso_datetime(value: Any) -> datetime | None:
    if not _is_non_empty_string(value):
        return None
    normalized = str(value).strip().replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def validate_artifact(payload: Any) -> List[str]:
    errors: List[str] = []

    if not isinstance(payload, dict):
        return ["Artifact payload must be a JSON object."]

    validated_at = payload.get("validatedAt")
    if _parse_iso_datetime(validated_at) is None:
        errors.append("validatedAt must be a valid ISO-8601 timestamp.")

    checks = payload.get("checks")
    if not isinstance(checks, dict):
        errors.append("checks must be an object.")
    else:
        for key in REQUIRED_CHECK_SECTIONS:
            if not isinstance(checks.get(key), dict):
                errors.append(f"checks.{key} must be an object.")

    payload_errors = payload.get("errors")
    if not isinstance(payload_errors, list):
        errors.append("errors must be a list.")
    else:
        if any(not isinstance(error, str) for error in payload_errors):
            errors.append("errors must contain only strings.")

    valid = payload.get("valid")
    if not isinstance(valid, bool):
        errors.append("valid must be a boolean.")
    elif isinstance(payload_errors, list):
        expected_valid = len(payload_errors) == 0
        if valid != expected_valid:
            errors.append("valid must match whether errors is empty.")

    return errors


def main() -> int:
    args = parse_args()
    artifact_path = Path(args.artifact)

    try:
        payload = json.loads(artifact_path.read_text(encoding="utf-8"))
    except OSError:
        print(f"Artifact is missing or unreadable: {artifact_path}")
        return 1
    except json.JSONDecodeError:
        print(f"Artifact is not valid JSON: {artifact_path}")
        return 1

    errors = validate_artifact(payload)
    if errors:
        print(f"Governance packet validation artifact contract failed: {artifact_path}")
        for error in errors:
            print(f"- {error}")
        return 1

    print(f"Governance packet validation artifact contract passed: {artifact_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
