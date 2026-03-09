#!/usr/bin/env python3
"""Apply event-root backfill artifact cleanup only when policy gate allows."""

from __future__ import annotations

import argparse
import importlib.util
import json
import os
from pathlib import Path
from typing import Any, Dict


def parse_args():
    parser = argparse.ArgumentParser(
        description="Apply event-root backfill artifact cleanup only when policy allows."
    )
    parser.add_argument(
        "--artifact-dir",
        default="backend/test_reports",
        help="Directory containing event-root backfill fixture artifacts.",
    )
    parser.add_argument(
        "--prefix",
        default="integration_telemetry_event_root_backfill",
        help="Fixture artifact filename prefix.",
    )
    parser.add_argument(
        "--keep-days",
        type=int,
        default=30,
        help="Retain artifacts newer than this many days.",
    )
    parser.add_argument(
        "--keep-min-count",
        type=int,
        default=3,
        help="Always keep at least this many newest artifacts.",
    )
    parser.add_argument(
        "--max-apply-candidates",
        type=int,
        default=20,
        help="Maximum stale candidate threshold for unattended apply cleanup.",
    )
    return parser.parse_args()


def _load_module(script_name: str):
    script_path = Path(__file__).resolve().parent / script_name
    spec = importlib.util.spec_from_file_location(script_name.replace(".py", ""), script_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load module: {script_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def resolve_guarded_apply_result(
    policy_result: Dict[str, Any],
    apply_summary: Dict[str, Any] | None,
) -> tuple[int, Dict[str, Any]]:
    decision = str(policy_result.get("decision") or "").upper()
    output: Dict[str, Any] = {"policy": policy_result}
    if apply_summary is not None:
        output["apply"] = apply_summary
    if decision == "ACTION_REQUIRED":
        return 1, output
    return 0, output


def main() -> int:
    args = parse_args()
    artifact_dir = Path(args.artifact_dir)
    if not artifact_dir.exists():
        print(f"Artifact directory does not exist: {artifact_dir}")
        return 1

    cleanup_module = _load_module(
        "cleanup_integration_telemetry_event_root_backfill_artifacts.py"
    )
    policy_module = _load_module(
        "evaluate_integration_telemetry_event_root_backfill_artifact_cleanup_policy.py"
    )

    try:
        dry_run_summary = cleanup_module.run_cleanup(
            artifact_dir=artifact_dir,
            prefix=args.prefix,
            keep_days=args.keep_days,
            keep_min_count=args.keep_min_count,
            apply=False,
        )
        policy_result = policy_module.evaluate_policy_from_summary(
            dry_run_summary,
            max_apply_candidates=args.max_apply_candidates,
            allow_apply_flag=policy_module._is_truthy(
                os.environ.get(policy_module.ALLOW_APPLY_ENV_VAR)
            ),
        )
    except ValueError as exc:
        print(str(exc))
        return 1

    apply_summary: Dict[str, Any] | None = None
    if str(policy_result.get("decision") or "").upper() == "ALLOW_APPLY":
        apply_summary = cleanup_module.run_cleanup(
            artifact_dir=artifact_dir,
            prefix=args.prefix,
            keep_days=args.keep_days,
            keep_min_count=args.keep_min_count,
            apply=True,
        )

    exit_code, output = resolve_guarded_apply_result(policy_result, apply_summary)
    print(json.dumps(output, indent=2))
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
