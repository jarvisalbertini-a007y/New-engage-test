#!/usr/bin/env python3
"""Run telemetry event-root backfill apply-mode only when policy gates allow."""

from __future__ import annotations

import argparse
import importlib.util
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict


def parse_args():
    parser = argparse.ArgumentParser(
        description="Apply telemetry event-root backfill only when policy gate allows."
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
        help="Optional userId filter for scoped apply execution.",
    )
    parser.add_argument(
        "--event-type",
        default=None,
        help="Optional eventType filter for scoped apply execution.",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=500,
        help="Cursor batch size.",
    )
    parser.add_argument(
        "--max-docs",
        type=int,
        default=50000,
        help="Maximum matching docs to scan in one run.",
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
        help="Optional path to write JSON guarded-apply summary output.",
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


def build_guarded_apply_output(
    payload: Dict[str, Any],
    *,
    command: str = "run_integration_telemetry_event_root_backfill_guarded_apply",
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

    backfill_module = _load_module("backfill_integration_telemetry_event_root_contract.py")
    policy_module = _load_module("evaluate_integration_telemetry_event_root_backfill_policy.py")
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
        apply_summary = backfill_module.run_backfill(
            collection,
            user_id=args.user_id,
            event_type=args.event_type,
            batch_size=args.batch_size,
            max_docs=args.max_docs,
            apply=True,
        )

    exit_code, output = resolve_guarded_apply_result(policy_result, apply_summary)
    output_payload = build_guarded_apply_output(output)
    write_output(args.output, output_payload)
    print(json.dumps(output_payload, indent=2))
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
