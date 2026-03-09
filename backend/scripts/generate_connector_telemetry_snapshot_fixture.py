#!/usr/bin/env python3
"""Generate a deterministic telemetry summary fixture with governance packet posture fields."""

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
        "eventCount": 6,
        "errorEventCount": 1,
        "byProvider": {
            "sendgrid": 3,
            "sales_intelligence": 1,
            "integrations": 2,
        },
        "byEventType": {
            "sendgrid_send_success": 1,
            "sendgrid_send_error": 1,
            "sendgrid_webhook_processed": 1,
            "sales_pipeline_forecast_generated": 1,
            "integrations_traceability_status_evaluated": 1,
            "integrations_connector_rate_limited": 1,
        },
        "bySchemaVersion": {
            "1": 2,
            "2": 1,
            "unknown": 2,
        },
        "trendByDay": [
            {
                "date": day_key,
                "events": 6,
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
        "governanceAudit": {
            "eventCount": 2,
            "snapshotEvaluationCount": 1,
            "baselineEvaluationCount": 1,
            "statusCounts": {"ACTION_REQUIRED": 1, "PASS": 1},
            "latestEvaluatedAt": now,
        },
        "packetValidationAudit": {
            "eventCount": 1,
            "statusCounts": {"ACTION_REQUIRED": 1},
            "withinFreshnessCount": 0,
            "outsideFreshnessCount": 1,
            "missingFreshnessCount": 0,
            "latestEvaluatedAt": now,
        },
        "connectorRateLimit": {
            "eventCount": 1,
            "byEndpoint": {"apollo_search": 1},
            "maxRetryAfterSeconds": 44,
            "avgRetryAfterSeconds": 44.0,
            "maxResetInSeconds": 43,
            "avgResetInSeconds": 43.0,
            "latestEventAt": now,
        },
        "sendgridWebhookTimestamp": {
            "eventCount": 1,
            "pressureLabelCounts": {"Moderate": 1},
            "pressureHintCounts": {"Validate event timestamp source clocks.": 1},
            "timestampFallbackCount": 1,
            "futureSkewEventCount": 0,
            "staleEventCount": 1,
            "freshEventCount": 0,
            "timestampAnomalyCountTotal": 2,
            "avgTimestampAnomalyCount": 2.0,
            "avgTimestampAnomalyRatePct": 50.0,
            "maxTimestampAnomalyRatePct": 50.0,
            "timestampAgeBucketCounts": {"stale": 1, "fallback": 1},
            "timestampAnomalyEventTypeCounts": {"open": 1, "processed": 1},
            "timestampDominantAnomalyBucketCounts": {"stale": 1},
            "timestampDominantAnomalyEventTypeCounts": {"open": 1},
            "timestampPressureHighAnomalyRatePct": 20.0,
            "timestampPressureModerateAnomalyRatePct": 5.0,
            "timestampPressureHighAnomalyCount": 10,
            "timestampPressureModerateAnomalyCount": 3,
            "latestEventAt": now,
        },
        "recentEvents": [
            {
                "eventType": "integrations_connector_rate_limited",
                "provider": "integrations",
                "createdAt": now,
                "schemaVersion": None,
                "requestId": "req-rate-limit-fixture",
                "traceabilityDecision": None,
                "traceabilityReady": None,
                "governanceStatus": None,
                "governancePacketValidationStatus": None,
                "governancePacketValidationWithinFreshness": None,
                "connectorRateLimitEndpoint": "apollo_search",
                "connectorRateLimitRetryAfterSeconds": 44,
                "connectorRateLimitResetInSeconds": 43,
                "connectorRateLimitWindowSeconds": 60,
                "connectorRateLimitMaxRequests": 1,
            },
            {
                "eventType": "integrations_traceability_status_evaluated",
                "provider": "integrations",
                "createdAt": now,
                "schemaVersion": None,
                "requestId": "req-traceability-fixture",
                "traceabilityDecision": "HOLD",
                "traceabilityReady": False,
                "governanceStatus": None,
                "governancePacketValidationStatus": "ACTION_REQUIRED",
                "governancePacketValidationWithinFreshness": False,
            },
            {
                "eventType": "sendgrid_webhook_processed",
                "provider": "sendgrid",
                "createdAt": now,
                "schemaVersion": 2,
                "requestId": "req-sendgrid-webhook-fixture",
                "traceabilityDecision": None,
                "traceabilityReady": None,
                "governanceStatus": None,
                "governancePacketValidationStatus": None,
                "governancePacketValidationWithinFreshness": None,
                "timestampPressureLabel": "Moderate",
                "timestampPressureHint": "Validate event timestamp source clocks.",
                "timestampAnomalyCount": 2,
                "timestampAnomalyRatePct": 50.0,
                "timestampAnomalyEventTypeCounts": {"open": 1, "processed": 1},
                "timestampDominantAnomalyBucket": "stale",
                "timestampDominantAnomalyEventType": "open",
                "timestampAgeBucketCounts": {"stale": 1, "fallback": 1},
                "futureSkewThresholdSeconds": 300,
                "staleEventAgeThresholdSeconds": 86400,
            },
            {
                "eventType": "sales_pipeline_forecast_generated",
                "provider": "sales_intelligence",
                "createdAt": now,
                "schemaVersion": 2,
                "requestId": "req-sales-fixture",
                "traceabilityDecision": None,
                "traceabilityReady": None,
                "governanceStatus": None,
                "governancePacketValidationStatus": None,
                "governancePacketValidationWithinFreshness": None,
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
