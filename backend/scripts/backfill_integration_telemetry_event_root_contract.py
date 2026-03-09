#!/usr/bin/env python3
"""Backfill integration telemetry event-root contract fields from payload metadata."""

from __future__ import annotations

import argparse
import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable


_STATUS_TOKEN_PATTERN = re.compile(r"[^A-Za-z0-9]+")


def parse_args():
    parser = argparse.ArgumentParser(
        description=(
            "Backfill request/schema/governance status fields at integration telemetry "
            "event root from existing payload metadata."
        )
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
        help="Optional userId filter for scoped backfill.",
    )
    parser.add_argument(
        "--event-type",
        default=None,
        help="Optional eventType filter for scoped backfill.",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=500,
        help="Cursor batch size when scanning telemetry docs.",
    )
    parser.add_argument(
        "--max-docs",
        type=int,
        default=50000,
        help="Maximum number of matching docs to scan in one run.",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Apply updates. Without this flag, command runs in dry-run mode.",
    )
    parser.add_argument(
        "--output",
        default=None,
        help="Optional path to write JSON summary output.",
    )
    return parser.parse_args()


def _coerce_payload_map(value: Any) -> Dict[str, Any]:
    if isinstance(value, dict):
        return value
    return {}


def normalize_status_token(value: Any) -> str | None:
    if value is None:
        return None
    normalized = str(value).strip()
    if not normalized:
        return None
    normalized = _STATUS_TOKEN_PATTERN.sub("_", normalized).strip("_").upper()
    return normalized or None


def normalize_request_id(value: Any) -> str | None:
    if value is None:
        return None
    normalized = str(value).strip()
    if not normalized:
        return None
    return normalized[:128]


def resolve_event_root_patch(doc: Dict[str, Any]) -> Dict[str, Any]:
    payload = _coerce_payload_map(doc.get("payload"))
    patch: Dict[str, Any] = {}

    current_request_id = normalize_request_id(doc.get("requestId"))
    payload_request_id = normalize_request_id(payload.get("request_id"))
    resolved_request_id = current_request_id or payload_request_id
    if resolved_request_id is not None and doc.get("requestId") != resolved_request_id:
        patch["requestId"] = resolved_request_id

    current_schema_version = doc.get("schemaVersion")
    payload_schema_version = payload.get("schema_version")
    resolved_schema_version = (
        current_schema_version
        if current_schema_version is not None
        else payload_schema_version
    )
    if (
        resolved_schema_version is not None
        and doc.get("schemaVersion") != resolved_schema_version
    ):
        patch["schemaVersion"] = resolved_schema_version

    current_governance_status = normalize_status_token(doc.get("governanceStatus"))
    payload_governance_status = normalize_status_token(payload.get("status"))
    resolved_governance_status = current_governance_status or payload_governance_status
    if (
        resolved_governance_status is not None
        and doc.get("governanceStatus") != resolved_governance_status
    ):
        patch["governanceStatus"] = resolved_governance_status

    current_packet_status = normalize_status_token(
        doc.get("governancePacketValidationStatus")
    )
    payload_packet_status = normalize_status_token(
        payload.get("governance_packet_validation_status")
    )
    resolved_packet_status = current_packet_status or payload_packet_status
    if (
        resolved_packet_status is not None
        and doc.get("governancePacketValidationStatus") != resolved_packet_status
    ):
        patch["governancePacketValidationStatus"] = resolved_packet_status

    current_packet_freshness = doc.get("governancePacketValidationWithinFreshness")
    if not isinstance(current_packet_freshness, bool):
        current_packet_freshness = None
    payload_packet_freshness = payload.get("governance_packet_validation_within_freshness")
    if not isinstance(payload_packet_freshness, bool):
        payload_packet_freshness = None
    resolved_packet_freshness = (
        current_packet_freshness
        if isinstance(current_packet_freshness, bool)
        else payload_packet_freshness
    )
    if (
        isinstance(resolved_packet_freshness, bool)
        and doc.get("governancePacketValidationWithinFreshness")
        != resolved_packet_freshness
    ):
        patch["governancePacketValidationWithinFreshness"] = resolved_packet_freshness

    return patch


def _build_query(user_id: str | None = None, event_type: str | None = None) -> Dict[str, Any]:
    query: Dict[str, Any] = {}
    if user_id:
        query["userId"] = str(user_id).strip()
    if event_type:
        query["eventType"] = str(event_type).strip()
    return query


def _scan_docs(collection, query: Dict[str, Any], batch_size: int) -> Iterable[Dict[str, Any]]:
    projection = {
        "_id": 1,
        "payload": 1,
        "requestId": 1,
        "schemaVersion": 1,
        "governanceStatus": 1,
        "governancePacketValidationStatus": 1,
        "governancePacketValidationWithinFreshness": 1,
    }
    return collection.find(query, projection).batch_size(batch_size)


def run_backfill(
    collection,
    *,
    user_id: str | None = None,
    event_type: str | None = None,
    batch_size: int = 500,
    max_docs: int = 50000,
    apply: bool = False,
) -> Dict[str, Any]:
    if batch_size < 1:
        raise ValueError("batch-size must be >= 1")
    if max_docs < 1:
        raise ValueError("max-docs must be >= 1")

    query = _build_query(user_id=user_id, event_type=event_type)
    scanned_count = 0
    candidate_count = 0
    updated_count = 0
    field_backfill_counts: Dict[str, int] = {}

    for doc in _scan_docs(collection, query=query, batch_size=batch_size):
        scanned_count += 1
        if scanned_count > max_docs:
            break

        patch = resolve_event_root_patch(doc)
        if not patch:
            continue

        candidate_count += 1
        for field_name in patch.keys():
            field_backfill_counts[field_name] = field_backfill_counts.get(field_name, 0) + 1
        if apply:
            collection.update_one({"_id": doc.get("_id")}, {"$set": patch})
            updated_count += 1

    return {
        "mode": "apply" if apply else "dry-run",
        "query": query,
        "batchSize": batch_size,
        "maxDocs": max_docs,
        "scannedCount": min(scanned_count, max_docs),
        "candidateCount": candidate_count,
        "updatedCount": updated_count,
        "fieldBackfillCounts": field_backfill_counts,
    }


def _build_summary(payload: Dict[str, Any], *, command: str) -> Dict[str, Any]:
    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "command": command,
        **payload,
    }


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

    collection = client[args.db_name][args.collection]
    try:
        result = run_backfill(
            collection,
            user_id=args.user_id,
            event_type=args.event_type,
            batch_size=args.batch_size,
            max_docs=args.max_docs,
            apply=args.apply,
        )
    except ValueError as exc:
        print(str(exc))
        return 1

    summary = _build_summary(
        result,
        command="backfill_integration_telemetry_event_root_contract",
    )
    if args.output:
        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
