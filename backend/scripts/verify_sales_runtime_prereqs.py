#!/usr/bin/env python3
"""Validate local runtime prerequisites for sales-only verification chains."""

from __future__ import annotations

import argparse
import json
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List


ROOT_DIR = Path(__file__).resolve().parents[2]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Verify required local tools and workspace paths before running "
            "sales verification chains."
        )
    )
    parser.add_argument(
        "--require",
        action="append",
        default=[],
        help=(
            "Require an additional executable. "
            "Can be supplied multiple times."
        ),
    )
    parser.add_argument(
        "--workspace-root",
        default=str(ROOT_DIR),
        help="Workspace root to validate (defaults to repository root).",
    )
    parser.add_argument(
        "--output",
        default="",
        help="Optional JSON artifact path for persisted runtime prerequisite output.",
    )
    return parser.parse_args()


def _default_required_commands() -> List[str]:
    return ["bash", "git", "node", "npm"]


def _workspace_checks(workspace_root: Path) -> Dict[str, bool]:
    return {
        "root_exists": workspace_root.exists(),
        "backend_dir_exists": (workspace_root / "backend").is_dir(),
        "frontend_dir_exists": (workspace_root / "frontend").is_dir(),
        "venv_python_exists": (workspace_root / ".venv311" / "bin" / "python").is_file(),
    }


def _recommendations(missing_commands: List[str], missing_workspace_checks: List[str]) -> List[str]:
    recommendation_map = {
        "git": "Install git and re-run: brew install git",
        "node": "Install node and npm, then re-run: brew install node",
        "npm": "Install node and npm, then re-run: brew install node",
        "bash": "Install bash and ensure it is available on PATH.",
    }
    recommendations: List[str] = []
    for command in missing_commands:
        recommendations.append(
            recommendation_map.get(
                command,
                f"Install missing executable `{command}` and re-run runtime prerequisite checks.",
            )
        )
    if "venv_python_exists" in missing_workspace_checks:
        recommendations.append(
            "Create runtime venv and install backend dependencies: python3 -m venv .venv311"
        )
    if "backend_dir_exists" in missing_workspace_checks or "frontend_dir_exists" in missing_workspace_checks:
        recommendations.append(
            "Confirm the repository root is correct and contains both `backend/` and `frontend/` directories."
        )
    return recommendations


def _write_output_artifact(path: Path, payload: Dict[str, object]) -> None:
    artifact = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "command": "verify_sales_runtime_prereqs",
        "artifact": payload,
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(artifact, indent=2, sort_keys=True), encoding="utf-8")


def main() -> int:
    args = parse_args()
    workspace_root = Path(args.workspace_root)
    required = list(dict.fromkeys(_default_required_commands() + list(args.require or [])))

    command_checks = {
        command: bool(shutil.which(command))
        for command in required
    }
    path_checks = _workspace_checks(workspace_root)
    missing_commands = sorted(
        command for command, ok in command_checks.items() if not ok
    )
    missing_workspace_checks = sorted(
        check for check, ok in path_checks.items() if not ok
    )
    all_checks = [*command_checks.values(), *path_checks.values()]
    valid = all(all_checks) if all_checks else True

    output = {
        "workspaceRoot": str(workspace_root),
        "validatedAt": datetime.now(timezone.utc).isoformat(),
        "requiredCommands": required,
        "commandChecks": command_checks,
        "workspaceChecks": path_checks,
        "missingChecks": {
            "commands": missing_commands,
            "workspace": missing_workspace_checks,
        },
        "recommendedCommands": _recommendations(
            missing_commands=missing_commands,
            missing_workspace_checks=missing_workspace_checks,
        ),
        "valid": valid,
    }

    output_path = str(args.output or "").strip()
    if output_path:
        _write_output_artifact(Path(output_path), output)

    print(json.dumps(output, indent=2, sort_keys=True))
    return 0 if valid else 1


if __name__ == "__main__":
    raise SystemExit(main())
