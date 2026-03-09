#!/usr/bin/env python3
"""Generate deterministic baseline command-alias artifact fixtures for contract validation."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Dict


COMMAND = "verify_sales_baseline_command_aliases"
SUPPORTED_PROFILES = ("healthy", "missing-alias", "mismatched-alias")


def parse_args():
    parser = argparse.ArgumentParser(
        description=(
            "Generate deterministic baseline command-alias artifact fixtures for "
            "validator contract checks."
        )
    )
    parser.add_argument(
        "--output-dir",
        default="backend/test_reports",
        help="Directory where fixture artifacts are written.",
    )
    parser.add_argument(
        "--prefix",
        default="sales_baseline_command_aliases",
        help="Filename prefix for generated artifacts.",
    )
    return parser.parse_args()


def _profile_timestamp(profile: str) -> str:
    return {
        "healthy": "2026-03-02T01:00:00+00:00",
        "missing-alias": "2026-03-02T01:05:00+00:00",
        "mismatched-alias": "2026-03-02T01:10:00+00:00",
    }[profile]


def _base_required_aliases() -> Dict[str, str]:
    return {
        "test": "npm run verify:backend:sales",
        "typecheck": "npm run check",
        "verify:baseline:quick": "bash backend/scripts/run_baseline_quick_workflow.sh",
        "verify:smoke:sales": "bash backend/scripts/run_smoke_sales_suite.sh",
    }


def build_fixture_payload(profile: str) -> Dict[str, Any]:
    if profile not in SUPPORTED_PROFILES:
        raise ValueError(f"Unsupported profile: {profile}")

    required_aliases = _base_required_aliases()
    alias_checks = {
        key: {
            "expected": value,
            "actual": value,
            "valid": True,
        }
        for key, value in required_aliases.items()
    }
    errors = []

    if profile == "missing-alias":
        alias_checks["verify:smoke:sales"] = {
            "expected": required_aliases["verify:smoke:sales"],
            "actual": None,
            "valid": False,
        }
        errors.append("Required alias `verify:smoke:sales` is missing.")
    elif profile == "mismatched-alias":
        alias_checks["typecheck"] = {
            "expected": required_aliases["typecheck"],
            "actual": "npm run lint",
            "valid": False,
        }
        errors.append("Alias `typecheck` maps to unexpected command value.")

    missing_aliases = sorted(
        key for key, entry in alias_checks.items() if entry.get("actual") is None
    )
    mismatched_aliases = sorted(
        key for key, entry in alias_checks.items() if entry.get("valid") is False
    )

    valid = len(errors) == 0 and len(mismatched_aliases) == 0
    artifact_payload = {
        "packageJsonPath": "/Users/AIL/Documents/EngageAI/EngageAI2/package.json",
        "validatedAt": _profile_timestamp(profile),
        "packageJsonExists": True,
        "requiredAliases": required_aliases,
        "aliasChecks": alias_checks,
        "missingAliases": missing_aliases,
        "mismatchedAliases": mismatched_aliases,
        "errors": errors,
        "valid": valid,
    }

    return {
        "generatedAt": _profile_timestamp(profile),
        "command": COMMAND,
        "artifact": artifact_payload,
    }


def generate_fixtures(output_dir: str, prefix: str) -> Dict[str, Any]:
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    profiles = []

    for profile in SUPPORTED_PROFILES:
        payload = build_fixture_payload(profile)
        artifact_path = output_path / f"{prefix}_{profile}.json"
        artifact_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        profiles.append(
            {
                "profile": profile,
                "valid": bool(payload.get("artifact", {}).get("valid")),
                "artifact": str(artifact_path),
            }
        )

    return {
        "generatedAt": "2026-03-02T01:15:00+00:00",
        "command": "generate_sales_baseline_command_aliases_artifact_fixtures",
        "outputDir": str(output_path),
        "prefix": prefix,
        "profiles": profiles,
    }


def main():
    args = parse_args()
    manifest = generate_fixtures(args.output_dir, args.prefix)
    print(json.dumps(manifest, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
