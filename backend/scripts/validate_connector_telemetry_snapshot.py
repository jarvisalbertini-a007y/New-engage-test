#!/usr/bin/env python3
"""Validate connector telemetry snapshot contract for traceability audit coverage."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Dict, List


TRACEABILITY_EVENT_TYPE = "integrations_traceability_status_evaluated"
CONNECTOR_RATE_LIMIT_EVENT_TYPE = "integrations_connector_rate_limited"
SENDGRID_WEBHOOK_PROCESSED_EVENT_TYPE = "sendgrid_webhook_processed"

REQUIRED_TOP_LEVEL_KEYS = [
    "generatedAt",
    "eventCount",
    "byProvider",
    "byEventType",
    "traceabilityAudit",
    "governanceAudit",
    "packetValidationAudit",
    "connectorRateLimit",
    "sendgridWebhookTimestamp",
    "recentEvents",
]

REQUIRED_TRACEABILITY_KEYS = [
    "eventCount",
    "decisionCounts",
    "readyCount",
    "notReadyCount",
]

REQUIRED_GOVERNANCE_KEYS = [
    "eventCount",
    "snapshotEvaluationCount",
    "baselineEvaluationCount",
    "statusCounts",
]

REQUIRED_PACKET_VALIDATION_KEYS = [
    "eventCount",
    "statusCounts",
    "withinFreshnessCount",
    "outsideFreshnessCount",
    "missingFreshnessCount",
    "latestEvaluatedAt",
]

REQUIRED_CONNECTOR_RATE_LIMIT_KEYS = [
    "eventCount",
    "byEndpoint",
    "latestEventAt",
    "maxRetryAfterSeconds",
    "avgRetryAfterSeconds",
    "maxResetInSeconds",
    "avgResetInSeconds",
]

REQUIRED_SENDGRID_WEBHOOK_TIMESTAMP_KEYS = [
    "eventCount",
    "pressureLabelCounts",
    "pressureHintCounts",
    "timestampFallbackCount",
    "futureSkewEventCount",
    "staleEventCount",
    "freshEventCount",
    "timestampAnomalyCountTotal",
    "avgTimestampAnomalyCount",
    "avgTimestampAnomalyRatePct",
    "maxTimestampAnomalyRatePct",
    "timestampAgeBucketCounts",
    "timestampAnomalyEventTypeCounts",
    "timestampDominantAnomalyBucketCounts",
    "timestampDominantAnomalyEventTypeCounts",
    "timestampPressureHighAnomalyRatePct",
    "timestampPressureModerateAnomalyRatePct",
    "timestampPressureHighAnomalyCount",
    "timestampPressureModerateAnomalyCount",
    "latestEventAt",
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

    governance = payload.get("governanceAudit")
    if not isinstance(governance, dict):
        errors.append("governanceAudit must be an object")
    else:
        for key in REQUIRED_GOVERNANCE_KEYS:
            if key not in governance:
                errors.append(f"governanceAudit missing key: {key}")
        for key in ("eventCount", "snapshotEvaluationCount", "baselineEvaluationCount"):
            value = governance.get(key)
            if not isinstance(value, int):
                errors.append(f"governanceAudit.{key} must be an integer")

        status_counts = governance.get("statusCounts")
        if not isinstance(status_counts, dict):
            errors.append("governanceAudit.statusCounts must be an object")
        else:
            for status, count in status_counts.items():
                if not isinstance(status, str):
                    errors.append("governanceAudit status key must be a string")
                    break
                if not isinstance(count, int):
                    errors.append(
                        f"governanceAudit.statusCounts.{status} must be an integer"
                    )

    packet_validation = payload.get("packetValidationAudit")
    if not isinstance(packet_validation, dict):
        errors.append("packetValidationAudit must be an object")
    else:
        for key in REQUIRED_PACKET_VALIDATION_KEYS:
            if key not in packet_validation:
                errors.append(f"packetValidationAudit missing key: {key}")

        for key in (
            "eventCount",
            "withinFreshnessCount",
            "outsideFreshnessCount",
            "missingFreshnessCount",
        ):
            value = packet_validation.get(key)
            if not isinstance(value, int):
                errors.append(f"packetValidationAudit.{key} must be an integer")

        status_counts = packet_validation.get("statusCounts")
        if not isinstance(status_counts, dict):
            errors.append("packetValidationAudit.statusCounts must be an object")
        else:
            for status, count in status_counts.items():
                if not isinstance(status, str):
                    errors.append("packetValidationAudit status key must be a string")
                    break
                if not isinstance(count, int):
                    errors.append(
                        f"packetValidationAudit.statusCounts.{status} must be an integer"
                    )

        latest_evaluated_at = packet_validation.get("latestEvaluatedAt")
        if latest_evaluated_at is not None and not isinstance(latest_evaluated_at, str):
            errors.append("packetValidationAudit.latestEvaluatedAt must be a string or null")

    connector_rate_limit = payload.get("connectorRateLimit")
    if not isinstance(connector_rate_limit, dict):
        errors.append("connectorRateLimit must be an object")
    else:
        for key in REQUIRED_CONNECTOR_RATE_LIMIT_KEYS:
            if key not in connector_rate_limit:
                errors.append(f"connectorRateLimit missing key: {key}")
        event_count = connector_rate_limit.get("eventCount")
        if not isinstance(event_count, int):
            errors.append("connectorRateLimit.eventCount must be an integer")
        by_endpoint = connector_rate_limit.get("byEndpoint")
        if not isinstance(by_endpoint, dict):
            errors.append("connectorRateLimit.byEndpoint must be an object")
        else:
            for endpoint, count in by_endpoint.items():
                if not isinstance(endpoint, str):
                    errors.append("connectorRateLimit.byEndpoint key must be a string")
                    break
                if not isinstance(count, int):
                    errors.append(
                        f"connectorRateLimit.byEndpoint.{endpoint} must be an integer"
                    )
        latest_event_at = connector_rate_limit.get("latestEventAt")
        if latest_event_at is not None and not isinstance(latest_event_at, str):
            errors.append("connectorRateLimit.latestEventAt must be a string or null")
        for key in (
            "maxRetryAfterSeconds",
            "avgRetryAfterSeconds",
            "maxResetInSeconds",
            "avgResetInSeconds",
        ):
            value = connector_rate_limit.get(key)
            if value is not None and not isinstance(value, (int, float)):
                errors.append(f"connectorRateLimit.{key} must be a number or null")

    sendgrid_webhook_timestamp = payload.get("sendgridWebhookTimestamp")
    if not isinstance(sendgrid_webhook_timestamp, dict):
        errors.append("sendgridWebhookTimestamp must be an object")
    else:
        for key in REQUIRED_SENDGRID_WEBHOOK_TIMESTAMP_KEYS:
            if key not in sendgrid_webhook_timestamp:
                errors.append(f"sendgridWebhookTimestamp missing key: {key}")
        if not isinstance(sendgrid_webhook_timestamp.get("eventCount"), int):
            errors.append("sendgridWebhookTimestamp.eventCount must be an integer")
        for key in (
            "timestampFallbackCount",
            "futureSkewEventCount",
            "staleEventCount",
            "freshEventCount",
            "timestampAnomalyCountTotal",
            "timestampPressureHighAnomalyCount",
            "timestampPressureModerateAnomalyCount",
        ):
            value = sendgrid_webhook_timestamp.get(key)
            if value is not None and not isinstance(value, int):
                errors.append(f"sendgridWebhookTimestamp.{key} must be an integer or null")
        for key in (
            "avgTimestampAnomalyCount",
            "avgTimestampAnomalyRatePct",
            "maxTimestampAnomalyRatePct",
            "timestampPressureHighAnomalyRatePct",
            "timestampPressureModerateAnomalyRatePct",
        ):
            value = sendgrid_webhook_timestamp.get(key)
            if value is not None and not isinstance(value, (int, float)):
                errors.append(f"sendgridWebhookTimestamp.{key} must be a number or null")
        for key in (
            "pressureLabelCounts",
            "pressureHintCounts",
            "timestampAgeBucketCounts",
            "timestampAnomalyEventTypeCounts",
            "timestampDominantAnomalyBucketCounts",
            "timestampDominantAnomalyEventTypeCounts",
        ):
            value = sendgrid_webhook_timestamp.get(key)
            if not isinstance(value, dict):
                errors.append(f"sendgridWebhookTimestamp.{key} must be an object")
            elif any(not isinstance(count, int) for count in value.values()):
                errors.append(
                    f"sendgridWebhookTimestamp.{key} values must be integers"
                )
        latest_event_at = sendgrid_webhook_timestamp.get("latestEventAt")
        if latest_event_at is not None and not isinstance(latest_event_at, str):
            errors.append(
                "sendgridWebhookTimestamp.latestEventAt must be a string or null"
            )

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
            packet_status = row.get("governancePacketValidationStatus")
            packet_freshness = row.get("governancePacketValidationWithinFreshness")
            if packet_status is not None and not isinstance(packet_status, str):
                errors.append(
                    f"recentEvents traceability row {idx} governancePacketValidationStatus must be string or null"
                )
            if packet_freshness is not None and not isinstance(packet_freshness, bool):
                errors.append(
                    f"recentEvents traceability row {idx} governancePacketValidationWithinFreshness must be boolean or null"
                )

    connector_rate_limit_rows = [
        row
        for row in recent_events
        if isinstance(row, dict) and row.get("eventType") == CONNECTOR_RATE_LIMIT_EVENT_TYPE
    ]
    for idx, row in enumerate(connector_rate_limit_rows):
        if not row.get("connectorRateLimitEndpoint"):
            errors.append(
                f"recentEvents connector-rate-limit row {idx} missing connectorRateLimitEndpoint"
            )
        for field in (
            "connectorRateLimitRetryAfterSeconds",
            "connectorRateLimitResetInSeconds",
            "connectorRateLimitWindowSeconds",
            "connectorRateLimitMaxRequests",
        ):
            value = row.get(field)
            if value is not None and not isinstance(value, int):
                errors.append(
                    f"recentEvents connector-rate-limit row {idx} {field} must be integer or null"
                )

    sendgrid_webhook_rows = [
        row
        for row in recent_events
        if isinstance(row, dict)
        and row.get("eventType") == SENDGRID_WEBHOOK_PROCESSED_EVENT_TYPE
    ]
    for idx, row in enumerate(sendgrid_webhook_rows):
        label = row.get("timestampPressureLabel")
        if label is not None and not isinstance(label, str):
            errors.append(
                f"recentEvents sendgrid-webhook row {idx} timestampPressureLabel must be string or null"
            )
        for field in (
            "timestampAnomalyCount",
            "futureSkewThresholdSeconds",
            "staleEventAgeThresholdSeconds",
        ):
            value = row.get(field)
            if value is not None and not isinstance(value, int):
                errors.append(
                    f"recentEvents sendgrid-webhook row {idx} {field} must be integer or null"
                )
        anomaly_rate_pct = row.get("timestampAnomalyRatePct")
        if anomaly_rate_pct is not None and not isinstance(anomaly_rate_pct, (int, float)):
            errors.append(
                f"recentEvents sendgrid-webhook row {idx} timestampAnomalyRatePct must be number or null"
            )
        for field in (
            "timestampAnomalyEventTypeCounts",
            "timestampAgeBucketCounts",
        ):
            value = row.get(field)
            if value is not None and not isinstance(value, dict):
                errors.append(
                    f"recentEvents sendgrid-webhook row {idx} {field} must be object or null"
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
