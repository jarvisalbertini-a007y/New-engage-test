#!/usr/bin/env python3
"""Evaluate policy gates for telemetry event-root backfill apply-mode execution."""

from __future__ import annotations

import argparse
import importlib.util
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict


ALLOW_APPLY_ENV_VAR = "BACKFILL_ALLOW_APPLY"


def parse_args():
    parser = argparse.ArgumentParser(
        description="Evaluate whether telemetry event-root backfill may run in apply mode."
    )
    parser.add_argument(
        "--mongo-url",
        default=os.environ.get("MONGO_URL", "mongodb://localhost:27017"),
        help="MongoDB connection URL.",
    )
    parser.add_argument(
        "--db-name",
        default=os.environ.get("DB_NAME", "engageai"),
        help="MongoDB database name.",
    )
    parser.add_argument(
        "--collection",
        default="integration_telemetry",
        help="Telemetry collection name.",
    )
    parser.add_argument(
        "--user-id",
        default=None,
        help="Optional userId filter for scoped policy evaluation.",
    )
    parser.add_argument(
        "--event-type",
        default=None,
        help="Optional eventType filter for scoped policy evaluation.",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=500,
        help="Cursor batch size for dry-run scan.",
    )
    parser.add_argument(
        "--max-docs",
        type=int,
        default=50000,
        help="Maximum matching docs to scan in policy dry-run.",
    )
    parser.add_argument(
        "--max-apply-candidates",
        type=int,
        default=2000,
        help="Maximum backfill candidate count allowed for unattended apply mode.",
    )
    parser.add_argument(
        "--output",
        default=None,
        help="Optional path to write JSON policy summary output.",
    )
    return parser.parse_args()


def _load_backfill_module():
    script_path = (
        Path(__file__).resolve().parent
        / "backfill_integration_telemetry_event_root_contract.py"
    )
    spec = importlib.util.spec_from_file_location(
        "backfill_integration_telemetry_event_root_contract",
        script_path,
    )
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load module: {script_path}")
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
        reason = "No telemetry event-root backfill candidates detected."
        recommended_command = None
    elif candidate_count > max_apply_candidates:
        decision = "ACTION_REQUIRED"
        reason = (
            "Candidate count exceeds unattended apply threshold; split scope or run "
            "manual review first."
        )
        recommended_command = (
            "npm run verify:telemetry:event-root:backfill:dry-run -- --max-docs 5000"
        )
    elif not allow_apply_flag:
        decision = "ACTION_REQUIRED"
        reason = (
            f"Set {ALLOW_APPLY_ENV_VAR}=true to allow unattended apply-mode execution."
        )
        recommended_command = (
            f"{ALLOW_APPLY_ENV_VAR}=true npm run "
            "verify:telemetry:event-root:backfill:apply:guarded"
        )
    else:
        decision = "ALLOW_APPLY"
        reason = "Backfill candidates are within unattended threshold and apply is authorized."
        recommended_command = "npm run verify:telemetry:event-root:backfill:apply:guarded"

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


def build_policy_output(
    payload: Dict[str, Any], *, command: str = "evaluate_integration_telemetry_event_root_backfill_policy"
) -> Dict[str, Any]:
    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "command": command,
        **payload,
    }


def write_output(output_path: str | None, payload: Dict[str, Any]) -> None:
    if not output_path:
        return
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def main() -> int:
    args = parse_args()
    try:
        from pymongo import MongoClient
    except Exception as exc:  # pragma: no cover
        print(f"Unable to import pymongo: {exc}")
        return 1

    try:
        client = MongoClient(args.mongo_url, serverSelectionTimeoutMS=5000)
        client.admin.command("ping")
    except Exception as exc:
        print(f"MongoDB connection failed: {exc}")
        return 1

    backfill_module = _load_backfill_module()
    collection = client[args.db_name][args.collection]
    try:
        dry_run_summary = backfill_module.run_backfill(
            collection,
            user_id=args.user_id,
            event_type=args.event_type,
            batch_size=args.batch_size,
            max_docs=args.max_docs,
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

    output = build_policy_output(result)
    write_output(args.output, output)
    print(json.dumps(output, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
