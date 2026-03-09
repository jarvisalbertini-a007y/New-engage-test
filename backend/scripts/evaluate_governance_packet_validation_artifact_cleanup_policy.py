#!/usr/bin/env python3
"""Evaluate policy gate for governance packet validation artifact cleanup apply-mode."""

from __future__ import annotations

import argparse
import importlib.util
import json
import os
from pathlib import Path
from typing import Any, Dict


ALLOW_APPLY_ENV_VAR = "GOVERNANCE_PACKET_ARTIFACT_CLEANUP_ALLOW_APPLY"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Evaluate whether governance packet validation artifact cleanup may run in apply mode."
        )
    )
    parser.add_argument(
        "--artifact-dir",
        default="backend/test_reports",
        help="Directory containing governance packet validation artifacts.",
    )
    parser.add_argument(
        "--prefix",
        default="governance_packet_validation",
        help="Governance packet validation artifact filename prefix.",
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
        default=1,
        help="Always keep at least this many newest artifacts.",
    )
    parser.add_argument(
        "--max-apply-candidates",
        type=int,
        default=20,
        help="Maximum stale candidate count allowed for unattended apply mode.",
    )
    return parser.parse_args()


def _load_cleanup_module():
    script_path = (
        Path(__file__).resolve().parent / "cleanup_governance_packet_validation_artifacts.py"
    )
    spec = importlib.util.spec_from_file_location(
        "cleanup_governance_packet_validation_artifacts",
        script_path,
    )
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load cleanup module: {script_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _is_truthy(value: Any) -> bool:
    normalized = str(value or "").strip().lower()
    return normalized in {"1", "true", "yes", "on"}


def evaluate_policy_from_summary(
    dry_run_summary: Dict[str, Any],
    *,
    max_apply_candidates: int,
    allow_apply_flag: bool,
) -> Dict[str, Any]:
    if max_apply_candidates < 1:
        raise ValueError("max-apply-candidates must be >= 1")

    candidate_count = int(dry_run_summary.get("candidateCount") or 0)
    if candidate_count <= 0:
        decision = "SKIP_APPLY"
        reason = "No stale governance packet validation artifacts detected."
        recommended_command = None
    elif candidate_count > max_apply_candidates:
        decision = "ACTION_REQUIRED"
        reason = (
            "Candidate count exceeds unattended cleanup threshold; narrow retention "
            "scope or perform manual review first."
        )
        recommended_command = (
            "npm run verify:governance:packet:artifact:cleanup:dry-run -- --keep-days 7"
        )
    elif not allow_apply_flag:
        decision = "ACTION_REQUIRED"
        reason = (
            f"Set {ALLOW_APPLY_ENV_VAR}=true to allow unattended cleanup apply execution."
        )
        recommended_command = (
            f"{ALLOW_APPLY_ENV_VAR}=true npm run "
            "verify:governance:packet:artifact:cleanup:apply:guarded"
        )
    else:
        decision = "ALLOW_APPLY"
        reason = (
            "Stale governance packet validation artifact candidate count is within threshold."
        )
        recommended_command = (
            "npm run verify:governance:packet:artifact:cleanup:apply:guarded"
        )

    return {
        "decision": decision,
        "reason": reason,
        "maxApplyCandidates": max_apply_candidates,
        "candidateCount": candidate_count,
        "allowApplyFlag": allow_apply_flag,
        "allowApplyEnvVar": ALLOW_APPLY_ENV_VAR,
        "recommendedCommand": recommended_command,
        "dryRunSummary": dry_run_summary,
    }


def main() -> int:
    args = parse_args()
    artifact_dir = Path(args.artifact_dir)
    if not artifact_dir.exists():
        print(f"Artifact directory does not exist: {artifact_dir}")
        return 1

    cleanup_module = _load_cleanup_module()
    try:
        dry_run_summary = cleanup_module.run_cleanup(
            artifact_dir=artifact_dir,
            prefix=args.prefix,
            keep_days=args.keep_days,
            keep_min_count=args.keep_min_count,
            apply=False,
        )
        result = evaluate_policy_from_summary(
            dry_run_summary,
            max_apply_candidates=args.max_apply_candidates,
            allow_apply_flag=_is_truthy(os.environ.get(ALLOW_APPLY_ENV_VAR)),
        )
    except ValueError as exc:
        print(str(exc))
        return 1

    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
