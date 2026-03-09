#!/usr/bin/env python3
"""Generate deterministic runtime prerequisite artifact fixtures for contract validation."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Dict


COMMAND = "verify_sales_runtime_prereqs"
SUPPORTED_PROFILES = ("healthy", "missing-command", "missing-workspace")


def parse_args():
    parser = argparse.ArgumentParser(
        description=(
            "Generate deterministic runtime prerequisite artifact fixtures for "
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
        default="sales_runtime_prereqs",
        help="Filename prefix for generated artifacts.",
    )
    return parser.parse_args()


def _profile_timestamp(profile: str) -> str:
    return {
        "healthy": "2026-02-27T01:00:00+00:00",
        "missing-command": "2026-02-27T01:05:00+00:00",
        "missing-workspace": "2026-02-27T01:10:00+00:00",
    }[profile]


def build_fixture_payload(profile: str) -> Dict[str, Any]:
    if profile not in SUPPORTED_PROFILES:
        raise ValueError(f"Unsupported profile: {profile}")

    command_checks: Dict[str, bool] = {
        "bash": True,
        "git": True,
        "node": True,
        "npm": True,
    }
    workspace_checks: Dict[str, bool] = {
        "root_exists": True,
        "backend_dir_exists": True,
        "frontend_dir_exists": True,
        "venv_python_exists": True,
    }
    recommended_commands = []

    if profile == "missing-command":
        command_checks["node"] = False
        recommended_commands.append("Install node and npm, then re-run: brew install node")
    if profile == "missing-workspace":
        workspace_checks["frontend_dir_exists"] = False
        recommended_commands.append(
            "Confirm the repository root is correct and contains both `backend/` and `frontend/` directories."
        )

    missing_commands = sorted([name for name, ok in command_checks.items() if not ok])
    missing_workspace = sorted([name for name, ok in workspace_checks.items() if not ok])
    valid = len(missing_commands) == 0 and len(missing_workspace) == 0

    artifact_payload = {
        "workspaceRoot": "/Users/AIL/Documents/EngageAI/EngageAI2",
        "validatedAt": _profile_timestamp(profile),
        "requiredCommands": ["bash", "git", "node", "npm"],
        "commandChecks": command_checks,
        "workspaceChecks": workspace_checks,
        "missingChecks": {
            "commands": missing_commands,
            "workspace": missing_workspace,
        },
        "recommendedCommands": recommended_commands,
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
        "generatedAt": "2026-02-27T01:15:00+00:00",
        "command": "generate_sales_runtime_prereqs_artifact_fixtures",
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
