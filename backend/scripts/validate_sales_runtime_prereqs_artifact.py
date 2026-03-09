#!/usr/bin/env python3
"""Validate runtime prerequisite artifact contracts for sales verification."""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List


EXPECTED_COMMAND = "verify_sales_runtime_prereqs"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Validate sales runtime prerequisite artifact contract."
    )
    parser.add_argument(
        "--artifact",
        required=True,
        help="Path to runtime prerequisite artifact JSON file.",
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


def _is_bool_map(value: Any) -> bool:
    if not isinstance(value, dict):
        return False
    for key, raw in value.items():
        if not isinstance(key, str):
            return False
        if not isinstance(raw, bool):
            return False
    return True


def _is_string_list(value: Any) -> bool:
    return isinstance(value, list) and all(isinstance(item, str) for item in value)


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
    checks["workspaceRootString"] = isinstance(artifact.get("workspaceRoot"), str) and bool(
        str(artifact.get("workspaceRoot") or "").strip()
    )
    checks["requiredCommandsList"] = _is_string_list(artifact.get("requiredCommands"))
    checks["commandChecksBoolMap"] = _is_bool_map(artifact.get("commandChecks"))
    checks["workspaceChecksBoolMap"] = _is_bool_map(artifact.get("workspaceChecks"))

    missing_checks = artifact.get("missingChecks")
    checks["missingChecksObject"] = isinstance(missing_checks, dict)
    if isinstance(missing_checks, dict):
        checks["missingCommandsList"] = _is_string_list(missing_checks.get("commands"))
        checks["missingWorkspaceList"] = _is_string_list(missing_checks.get("workspace"))
    else:
        checks["missingCommandsList"] = False
        checks["missingWorkspaceList"] = False

    checks["recommendedCommandsList"] = _is_string_list(
        artifact.get("recommendedCommands")
    )
    checks["validBool"] = isinstance(artifact.get("valid"), bool)

    if checks["commandChecksBoolMap"]:
        command_checks = artifact.get("commandChecks") or {}
        assert isinstance(command_checks, dict)
        missing = sorted(
            key for key, ok in command_checks.items() if isinstance(key, str) and not ok
        )
        checks["missingCommandParity"] = (
            checks["missingCommandsList"]
            and sorted((missing_checks or {}).get("commands") or []) == missing
        )
    else:
        checks["missingCommandParity"] = False

    if checks["workspaceChecksBoolMap"]:
        workspace_checks = artifact.get("workspaceChecks") or {}
        assert isinstance(workspace_checks, dict)
        missing_workspace = sorted(
            key for key, ok in workspace_checks.items() if isinstance(key, str) and not ok
        )
        checks["missingWorkspaceParity"] = (
            checks["missingWorkspaceList"]
            and sorted((missing_checks or {}).get("workspace") or []) == missing_workspace
        )
    else:
        checks["missingWorkspaceParity"] = False

    valid = artifact.get("valid") if isinstance(artifact.get("valid"), bool) else None
    missing_total = 0
    if checks["missingCommandsList"]:
        missing_total += len((missing_checks or {}).get("commands") or [])
    if checks["missingWorkspaceList"]:
        missing_total += len((missing_checks or {}).get("workspace") or [])
    checks["validMissingConsistency"] = (
        isinstance(valid, bool)
        and ((valid and missing_total == 0) or ((not valid) and missing_total >= 1))
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
