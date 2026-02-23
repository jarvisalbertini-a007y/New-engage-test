#!/usr/bin/env python3
"""Generate a deterministic telemetry summary fixture with traceability audit fields."""

from __future__ import annotations

import argparse
import json
import os
from datetime import datetime, timezone


def parse_args():
    parser = argparse.ArgumentParser(
        description="Generate connector telemetry summary fixture."
    )
    parser.add_argument(
        "--output",
        default="backend/test_reports/connector-telemetry-summary-snapshot.json",
        help="Path to output telemetry snapshot fixture JSON.",
    )
    return parser.parse_args()


def build_fixture_payload():
    now = datetime.now(timezone.utc).isoformat()
    day_key = now[:10]
    return {
        "generatedAt": now,
        "windowDays": 7,
        "eventCount": 4,
        "errorEventCount": 1,
        "byProvider": {
            "sendgrid": 2,
            "sales_intelligence": 1,
            "integrations": 1,
        },
        "byEventType": {
            "sendgrid_send_success": 1,
            "sendgrid_send_error": 1,
            "sales_pipeline_forecast_generated": 1,
            "integrations_traceability_status_evaluated": 1,
        },
        "bySchemaVersion": {
            "1": 2,
            "2": 1,
            "unknown": 1,
        },
        "trendByDay": [
            {
                "date": day_key,
                "events": 4,
                "errors": 1,
                "salesIntelligenceEvents": 1,
            }
        ],
        "salesIntelligence": {
            "eventCount": 1,
            "byEventFamily": {"forecast": 1},
            "byEventType": {"sales_pipeline_forecast_generated": 1},
            "bySchemaVersion": {"2": 1},
            "trendByDay": [{"date": day_key, "forecast": 1}],
        },
        "traceabilityAudit": {
            "eventCount": 1,
            "decisionCounts": {"HOLD": 1},
            "readyCount": 0,
            "notReadyCount": 1,
            "latestEvaluatedAt": now,
        },
        "recentEvents": [
            {
                "eventType": "integrations_traceability_status_evaluated",
                "provider": "integrations",
                "createdAt": now,
                "schemaVersion": None,
                "requestId": "req-traceability-fixture",
                "traceabilityDecision": "HOLD",
                "traceabilityReady": False,
            },
            {
                "eventType": "sales_pipeline_forecast_generated",
                "provider": "sales_intelligence",
                "createdAt": now,
                "schemaVersion": 2,
                "requestId": "req-sales-fixture",
                "traceabilityDecision": None,
                "traceabilityReady": None,
            },
        ],
    }


def main():
    args = parse_args()
    payload = build_fixture_payload()
    output_dir = os.path.dirname(args.output)
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as output_file:
        json.dump(payload, output_file, indent=2)
    print(f"Wrote connector telemetry snapshot fixture: {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
