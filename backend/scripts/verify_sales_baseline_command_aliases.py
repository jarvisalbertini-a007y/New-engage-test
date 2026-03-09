#!/usr/bin/env python3
"""Validate canonical sales baseline command aliases in package.json."""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Tuple


ROOT_DIR = Path(__file__).resolve().parents[2]
DEFAULT_PACKAGE_JSON = ROOT_DIR / "package.json"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Verify canonical command aliases required by sales baseline and "
            "smoke chains."
        )
    )
    parser.add_argument(
        "--package-json",
        default=str(DEFAULT_PACKAGE_JSON),
        help="Path to package.json (defaults to repository root package.json).",
    )
    parser.add_argument(
        "--require-alias",
        action="append",
        default=[],
        help=(
            "Additional alias requirement in the form name=expected-command. "
            "Can be supplied multiple times."
        ),
    )
    parser.add_argument(
        "--output",
        default="",
        help="Optional JSON artifact path for persisted alias verification output.",
    )
    return parser.parse_args()


def _default_required_aliases() -> Dict[str, str]:
    return {
        "test": "npm run verify:backend:sales",
        "typecheck": "npm run check",
        "verify:baseline:quick": "bash backend/scripts/run_baseline_quick_workflow.sh",
        "verify:smoke:sales": "bash backend/scripts/run_smoke_sales_suite.sh",
    }


def _parse_extra_aliases(entries: List[str]) -> Tuple[Dict[str, str], List[str]]:
    parsed: Dict[str, str] = {}
    errors: List[str] = []
    for raw_entry in entries:
        entry = str(raw_entry).strip()
        if not entry:
            continue
        if "=" not in entry:
            errors.append(
                f"Invalid --require-alias entry `{entry}`; expected name=expected-command."
            )
            continue
        alias, expected = entry.split("=", 1)
        alias = alias.strip()
        expected = expected.strip()
        if not alias or not expected:
            errors.append(
                f"Invalid --require-alias entry `{entry}`; alias and expected command are required."
            )
            continue
        parsed[alias] = expected
    return parsed, errors


def _load_scripts(package_json_path: Path) -> Dict[str, str]:
    payload = json.loads(package_json_path.read_text(encoding="utf-8"))
    scripts = payload.get("scripts", {})
    if not isinstance(scripts, dict):
        raise ValueError("package.json `scripts` must be an object")
    return {str(key): str(value) for key, value in scripts.items()}


def _write_output_artifact(path: Path, payload: Dict[str, object]) -> None:
    artifact = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "command": "verify_sales_baseline_command_aliases",
        "artifact": payload,
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(artifact, indent=2, sort_keys=True), encoding="utf-8")


def main() -> int:
    args = parse_args()
    package_json_path = Path(args.package_json)

    parse_errors: List[str] = []
    package_json_exists = package_json_path.is_file()
    scripts: Dict[str, str] = {}

    if package_json_exists:
        try:
            scripts = _load_scripts(package_json_path)
        except Exception as exc:
            parse_errors.append(f"Failed to parse package.json: {exc}")
    else:
        parse_errors.append(f"package.json not found: {package_json_path}")

    required_aliases = dict(_default_required_aliases())
    extra_aliases, extra_errors = _parse_extra_aliases(list(args.require_alias or []))
    parse_errors.extend(extra_errors)
    required_aliases.update(extra_aliases)

    alias_checks: Dict[str, Dict[str, object]] = {}
    missing_aliases: List[str] = []
    mismatched_aliases: List[str] = []
    for alias in sorted(required_aliases):
        expected = required_aliases[alias]
        actual = scripts.get(alias)
        valid = actual == expected
        alias_checks[alias] = {
            "expected": expected,
            "actual": actual,
            "valid": valid,
        }
        if actual is None:
            missing_aliases.append(alias)
        if not valid:
            mismatched_aliases.append(alias)

    valid = not parse_errors and not mismatched_aliases
    output = {
        "packageJsonPath": str(package_json_path),
        "validatedAt": datetime.now(timezone.utc).isoformat(),
        "packageJsonExists": package_json_exists,
        "requiredAliases": required_aliases,
        "aliasChecks": alias_checks,
        "missingAliases": missing_aliases,
        "mismatchedAliases": mismatched_aliases,
        "errors": parse_errors,
        "valid": valid,
    }

    output_path = str(args.output or "").strip()
    if output_path:
        _write_output_artifact(Path(output_path), output)

    print(json.dumps(output, indent=2, sort_keys=True))
    return 0 if valid else 1


if __name__ == "__main__":
    raise SystemExit(main())
