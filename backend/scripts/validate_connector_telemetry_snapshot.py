#!/usr/bin/env python3
"""Validate connector telemetry snapshot contract for traceability audit coverage."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Dict, List


TRACEABILITY_EVENT_TYPE = "integrations_traceability_status_evaluated"

REQUIRED_TOP_LEVEL_KEYS = [
    "generatedAt",
    "eventCount",
    "byProvider",
    "byEventType",
    "traceabilityAudit",
    "recentEvents",
]

REQUIRED_TRACEABILITY_KEYS = [
    "eventCount",
    "decisionCounts",
    "readyCount",
    "notReadyCount",
]


def parse_args():
    parser = argparse.ArgumentParser(
        description="Validate connector telemetry summary snapshot contract."
    )
    parser.add_argument(
        "--snapshot",
        default="backend/test_reports/connector-telemetry-summary-snapshot.json",
        help="Path to telemetry snapshot JSON.",
    )
    return parser.parse_args()


def validate_snapshot(payload: Dict[str, Any]) -> List[str]:
    errors: List[str] = []
    for key in REQUIRED_TOP_LEVEL_KEYS:
        if key not in payload:
            errors.append(f"Missing top-level key: {key}")

    by_provider = payload.get("byProvider")
    if not isinstance(by_provider, dict):
        errors.append("byProvider must be an object")

    by_event_type = payload.get("byEventType")
    if not isinstance(by_event_type, dict):
        errors.append("byEventType must be an object")

    traceability = payload.get("traceabilityAudit")
    if not isinstance(traceability, dict):
        errors.append("traceabilityAudit must be an object")
    else:
        for key in REQUIRED_TRACEABILITY_KEYS:
            if key not in traceability:
                errors.append(f"traceabilityAudit missing key: {key}")
        decision_counts = traceability.get("decisionCounts")
        if not isinstance(decision_counts, dict):
            errors.append("traceabilityAudit.decisionCounts must be an object")
        else:
            for decision, count in decision_counts.items():
                if not isinstance(decision, str):
                    errors.append("traceabilityAudit decision key must be a string")
                    break
                if not isinstance(count, int):
                    errors.append(
                        f"traceabilityAudit.decisionCounts.{decision} must be an integer"
                    )

        for key in ("eventCount", "readyCount", "notReadyCount"):
            value = traceability.get(key)
            if not isinstance(value, int):
                errors.append(f"traceabilityAudit.{key} must be an integer")

    recent_events = payload.get("recentEvents")
    if not isinstance(recent_events, list):
        errors.append("recentEvents must be a list")
        return errors

    traceability_rows = [
        row
        for row in recent_events
        if isinstance(row, dict) and row.get("eventType") == TRACEABILITY_EVENT_TYPE
    ]
    if traceability_rows:
        for idx, row in enumerate(traceability_rows):
            if not row.get("requestId"):
                errors.append(
                    f"recentEvents traceability row {idx} missing requestId"
                )
            if not row.get("traceabilityDecision"):
                errors.append(
                    f"recentEvents traceability row {idx} missing traceabilityDecision"
                )
            if not isinstance(row.get("traceabilityReady"), bool):
                errors.append(
                    f"recentEvents traceability row {idx} traceabilityReady must be boolean"
                )

    return errors


def main() -> int:
    args = parse_args()
    snapshot_path = Path(args.snapshot)
    if not snapshot_path.exists():
        print(f"Snapshot does not exist: {snapshot_path}")
        return 1

    try:
        payload = json.loads(snapshot_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        print(f"Snapshot is not valid JSON: {snapshot_path}")
        return 1

    errors = validate_snapshot(payload)
    if errors:
        print("Connector telemetry snapshot validation failed:")
        for error in errors:
            print(f"- {error}")
        return 1

    print(f"Connector telemetry snapshot validation passed: {snapshot_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
