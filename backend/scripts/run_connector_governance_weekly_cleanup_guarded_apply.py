#!/usr/bin/env python3
"""Run governance weekly report cleanup apply-mode only when policy gates allow."""

from __future__ import annotations

import argparse
import importlib.util
import json
from pathlib import Path
from typing import Any, Dict


def parse_args():
    parser = argparse.ArgumentParser(
        description="Apply governance weekly cleanup only when policy gate allows."
    )
    parser.add_argument(
        "--artifact-dir",
        default="backend/test_reports",
        help="Directory containing governance weekly report files.",
    )
    parser.add_argument(
        "--prefix",
        default="connector_governance_weekly_report",
        help="Filename prefix for governance weekly reports.",
    )
    parser.add_argument(
        "--keep-days",
        type=int,
        default=30,
        help="Retain reports newer than this many days.",
    )
    parser.add_argument(
        "--keep-min-count",
        type=int,
        default=1,
        help="Always keep at least this many newest reports.",
    )
    parser.add_argument(
        "--max-apply-candidates",
        type=int,
        default=20,
        help="Maximum stale-candidate threshold for unattended apply-mode cleanup.",
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


def _build_output(policy_result: Dict[str, Any], apply_result: Dict[str, Any] | None):
    output: Dict[str, Any] = {"policy": policy_result}
    if apply_result is not None:
        output["apply"] = apply_result
    return output


def main() -> int:
    args = parse_args()
    artifact_dir = Path(args.artifact_dir)
    if not artifact_dir.exists():
        print(f"Artifact directory does not exist: {artifact_dir}")
        return 1

    policy_module = _load_module("evaluate_connector_governance_weekly_cleanup_policy.py")
    cleanup_module = _load_module("cleanup_connector_governance_weekly_reports.py")

    try:
        policy_result = policy_module.evaluate_policy(
            artifact_dir=artifact_dir,
            prefix=args.prefix,
            keep_days=args.keep_days,
            keep_min_count=args.keep_min_count,
            max_apply_candidates=args.max_apply_candidates,
        )
    except ValueError as exc:
        print(str(exc))
        return 1

    decision = str(policy_result.get("decision") or "").upper()
    if decision == "ACTION_REQUIRED":
        print(json.dumps(_build_output(policy_result, None), indent=2))
        return 1
    if decision == "SKIP_APPLY":
        print(json.dumps(_build_output(policy_result, None), indent=2))
        return 0

    stale_records = cleanup_module.plan_cleanup(
        artifact_dir=artifact_dir,
        prefix=args.prefix,
        keep_days=args.keep_days,
        keep_min_count=args.keep_min_count,
    )
    apply_result = cleanup_module.execute_cleanup(stale_records=stale_records, apply=True)
    print(json.dumps(_build_output(policy_result, apply_result), indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
