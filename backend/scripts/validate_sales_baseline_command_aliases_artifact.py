#!/usr/bin/env python3
"""Validate baseline command-alias artifact contracts for sales verification."""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List


EXPECTED_COMMAND = "verify_sales_baseline_command_aliases"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Validate sales baseline command-alias artifact contract."
    )
    parser.add_argument(
        "--artifact",
        required=True,
        help="Path to baseline command-alias artifact JSON file.",
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


def _is_string_list(value: Any) -> bool:
    return isinstance(value, list) and all(isinstance(item, str) for item in value)


def _is_alias_check_map(value: Any) -> bool:
    if not isinstance(value, dict):
        return False
    for key, entry in value.items():
        if not isinstance(key, str) or not isinstance(entry, dict):
            return False
        if "expected" not in entry or "valid" not in entry:
            return False
        if not isinstance(entry.get("expected"), str):
            return False
        actual = entry.get("actual")
        if actual is not None and not isinstance(actual, str):
            return False
        if not isinstance(entry.get("valid"), bool):
            return False
    return True


def _is_alias_requirements_map(value: Any) -> bool:
    return isinstance(value, dict) and all(
        isinstance(key, str) and isinstance(raw, str)
        for key, raw in value.items()
    )


def validate_artifact(path: Path) -> tuple[Dict[str, Any], List[str]]:
    errors: List[str] = []
    payload = _load_payload(path)
    if payload is None:
        return {}, ["Artifact payload must be valid JSON object."]

    checks: Dict[str, Any] = {
        "generatedAtIso": _parse_iso_datetime(payload.get("generatedAt")) is not None,
        "commandMatch": payload.get("command") == EXPECTED_COMMAND,
    }
    artifact = payload.get("artifact")
    checks["artifactObject"] = isinstance(artifact, dict)
    if not checks["artifactObject"]:
        errors.append("artifact must be an object.")
        return checks, errors

    assert isinstance(artifact, dict)
    checks["validatedAtIso"] = _parse_iso_datetime(artifact.get("validatedAt")) is not None
    checks["packageJsonPathString"] = isinstance(
        artifact.get("packageJsonPath"), str
    ) and bool(str(artifact.get("packageJsonPath") or "").strip())
    checks["packageJsonExistsBool"] = isinstance(artifact.get("packageJsonExists"), bool)
    checks["requiredAliasesMap"] = _is_alias_requirements_map(artifact.get("requiredAliases"))
    checks["aliasChecksMap"] = _is_alias_check_map(artifact.get("aliasChecks"))
    checks["missingAliasesList"] = _is_string_list(artifact.get("missingAliases"))
    checks["mismatchedAliasesList"] = _is_string_list(artifact.get("mismatchedAliases"))
    checks["errorsList"] = _is_string_list(artifact.get("errors"))
    checks["validBool"] = isinstance(artifact.get("valid"), bool)

    alias_checks = artifact.get("aliasChecks") if isinstance(artifact.get("aliasChecks"), dict) else {}
    missing_aliases = artifact.get("missingAliases") if isinstance(artifact.get("missingAliases"), list) else []
    mismatched_aliases = artifact.get("mismatchedAliases") if isinstance(artifact.get("mismatchedAliases"), list) else []
    errors_list = artifact.get("errors") if isinstance(artifact.get("errors"), list) else []

    if checks["aliasChecksMap"]:
        computed_missing = sorted(
            key
            for key, entry in alias_checks.items()
            if isinstance(entry, dict) and entry.get("actual") is None
        )
        computed_mismatched = sorted(
            key
            for key, entry in alias_checks.items()
            if isinstance(entry, dict) and entry.get("valid") is False
        )
        checks["missingAliasParity"] = checks["missingAliasesList"] and sorted(missing_aliases) == computed_missing
        checks["mismatchedAliasParity"] = checks["mismatchedAliasesList"] and sorted(mismatched_aliases) == computed_mismatched
    else:
        checks["missingAliasParity"] = False
        checks["mismatchedAliasParity"] = False

    valid = artifact.get("valid") if isinstance(artifact.get("valid"), bool) else None
    errors_count = len(errors_list) if isinstance(errors_list, list) else 0
    mismatch_count = len(mismatched_aliases) if isinstance(mismatched_aliases, list) else 0
    checks["validConsistency"] = (
        isinstance(valid, bool)
        and ((valid and errors_count == 0 and mismatch_count == 0) or (not valid and (errors_count >= 1 or mismatch_count >= 1)))
    )

    for key, ok in checks.items():
        if not ok:
            errors.append(f"check failed: {key}")

    return checks, errors


def main() -> int:
    args = parse_args()
    artifact_path = Path(args.artifact)
    if not artifact_path.exists():
        print(f"Artifact does not exist: {artifact_path}")
        return 1

    checks, errors = validate_artifact(artifact_path)
    result = {
        "status": "pass" if not errors else "fail",
        "artifact": str(artifact_path),
        "checks": checks,
        "errorCount": len(errors),
        "errors": errors,
    }
    print(json.dumps(result, indent=2))
    return 0 if not errors else 1


if __name__ == "__main__":
    raise SystemExit(main())
