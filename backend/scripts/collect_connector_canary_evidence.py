#!/usr/bin/env python3
"""
Collect connector canary evidence from the telemetry summary endpoint.

Usage:
  python backend/scripts/collect_connector_canary_evidence.py \
    --base-url http://127.0.0.1:8000 \
    --token <bearer_token> \
    --days 7 \
    --limit 1000 \
    --output backend/test_reports/connector_canary_evidence.json
"""

import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from core.integration_slo_policy import (
    PERCENT_THRESHOLD_MAX,
    PERCENT_THRESHOLD_MIN,
    SAMPLE_THRESHOLD_MAX,
    SAMPLE_THRESHOLD_MIN,
    SLO_QUERY_LIMIT_MAX,
    SLO_QUERY_LIMIT_MIN,
    TELEMETRY_DAYS_MAX,
    TELEMETRY_DAYS_MIN,
)

ORCHESTRATION_ATTEMPT_THRESHOLD_MIN = 0
ORCHESTRATION_ATTEMPT_THRESHOLD_MAX = 5000


def parse_args():
    parser = argparse.ArgumentParser(description="Collect connector canary evidence")
    parser.add_argument("--base-url", required=True, help="Backend base URL (example: http://127.0.0.1:8000)")
    parser.add_argument("--token", required=True, help="Bearer token for authenticated API access")
    parser.add_argument("--days", type=int, default=7, help="Telemetry lookback window in days")
    parser.add_argument("--limit", type=int, default=1000, help="Telemetry event fetch limit")
    parser.add_argument(
        "--max-error-rate-pct",
        type=float,
        default=None,
        help="Optional override for SLO max error rate threshold",
    )
    parser.add_argument(
        "--min-schema-v2-pct",
        type=float,
        default=None,
        help="Optional override for SLO minimum schema v2 coverage threshold",
    )
    parser.add_argument(
        "--min-schema-v2-sample-count",
        type=int,
        default=None,
        help="Optional override for SLO minimum schema v2 sample count",
    )
    parser.add_argument(
        "--max-orchestration-attempt-error-count",
        type=int,
        default=None,
        help="Optional override for maximum orchestration attempt error count",
    )
    parser.add_argument(
        "--max-orchestration-attempt-skipped-count",
        type=int,
        default=None,
        help="Optional override for maximum orchestration attempt skipped count",
    )
    parser.add_argument(
        "--output",
        default="backend/test_reports/connector_canary_evidence.json",
        help="Output JSON file path",
    )
    return parser.parse_args()


def _validate_args(args):
    if args.days < TELEMETRY_DAYS_MIN or args.days > TELEMETRY_DAYS_MAX:
        return f"days must be between {TELEMETRY_DAYS_MIN} and {TELEMETRY_DAYS_MAX}"
    if args.limit < SLO_QUERY_LIMIT_MIN or args.limit > SLO_QUERY_LIMIT_MAX:
        return f"limit must be between {SLO_QUERY_LIMIT_MIN} and {SLO_QUERY_LIMIT_MAX}"
    if args.max_error_rate_pct is not None and (
        args.max_error_rate_pct < PERCENT_THRESHOLD_MIN
        or args.max_error_rate_pct > PERCENT_THRESHOLD_MAX
    ):
        return (
            f"max_error_rate_pct must be between "
            f"{int(PERCENT_THRESHOLD_MIN)} and {int(PERCENT_THRESHOLD_MAX)}"
        )
    if args.min_schema_v2_pct is not None and (
        args.min_schema_v2_pct < PERCENT_THRESHOLD_MIN
        or args.min_schema_v2_pct > PERCENT_THRESHOLD_MAX
    ):
        return (
            f"min_schema_v2_pct must be between "
            f"{int(PERCENT_THRESHOLD_MIN)} and {int(PERCENT_THRESHOLD_MAX)}"
        )
    if args.min_schema_v2_sample_count is not None and (
        args.min_schema_v2_sample_count < SAMPLE_THRESHOLD_MIN
        or args.min_schema_v2_sample_count > SAMPLE_THRESHOLD_MAX
    ):
        return (
            f"min_schema_v2_sample_count must be between "
            f"{SAMPLE_THRESHOLD_MIN} and {SAMPLE_THRESHOLD_MAX}"
        )
    orchestration_attempt_error_count = getattr(
        args, "max_orchestration_attempt_error_count", None
    )
    if orchestration_attempt_error_count is not None and (
        orchestration_attempt_error_count < ORCHESTRATION_ATTEMPT_THRESHOLD_MIN
        or orchestration_attempt_error_count > ORCHESTRATION_ATTEMPT_THRESHOLD_MAX
    ):
        return (
            f"max_orchestration_attempt_error_count must be between "
            f"{ORCHESTRATION_ATTEMPT_THRESHOLD_MIN} and {ORCHESTRATION_ATTEMPT_THRESHOLD_MAX}"
        )
    orchestration_attempt_skipped_count = getattr(
        args, "max_orchestration_attempt_skipped_count", None
    )
    if orchestration_attempt_skipped_count is not None and (
        orchestration_attempt_skipped_count < ORCHESTRATION_ATTEMPT_THRESHOLD_MIN
        or orchestration_attempt_skipped_count > ORCHESTRATION_ATTEMPT_THRESHOLD_MAX
    ):
        return (
            f"max_orchestration_attempt_skipped_count must be between "
            f"{ORCHESTRATION_ATTEMPT_THRESHOLD_MIN} and {ORCHESTRATION_ATTEMPT_THRESHOLD_MAX}"
        )
    return None


def fetch_json(url: str, token: str):
    request = urllib.request.Request(url)
    request.add_header("Authorization", f"Bearer {token}")
    request.add_header("Accept", "application/json")
    with urllib.request.urlopen(request, timeout=20) as response:
        return json.loads(response.read().decode("utf-8"))


def main():
    args = parse_args()
    validation_error = _validate_args(args)
    if validation_error is not None:
        print(f"Argument error: {validation_error}", file=sys.stderr)
        return 2

    query = urllib.parse.urlencode({"days": args.days, "limit": args.limit})
    summary_url = f"{args.base_url.rstrip('/')}/api/integrations/integrations/telemetry/summary?{query}"
    health_url = f"{args.base_url.rstrip('/')}/api/integrations/integrations/health"
    slo_query = {"days": args.days, "limit": args.limit}
    if args.max_error_rate_pct is not None:
        slo_query["max_error_rate_pct"] = args.max_error_rate_pct
    if args.min_schema_v2_pct is not None:
        slo_query["min_schema_v2_pct"] = args.min_schema_v2_pct
    if args.min_schema_v2_sample_count is not None:
        slo_query["min_schema_v2_sample_count"] = args.min_schema_v2_sample_count
    if getattr(args, "max_orchestration_attempt_error_count", None) is not None:
        slo_query["max_orchestration_attempt_error_count"] = (
            args.max_orchestration_attempt_error_count
        )
    if getattr(args, "max_orchestration_attempt_skipped_count", None) is not None:
        slo_query["max_orchestration_attempt_skipped_count"] = (
            args.max_orchestration_attempt_skipped_count
        )
    slo_query_str = urllib.parse.urlencode(slo_query)
    slo_url = f"{args.base_url.rstrip('/')}/api/integrations/integrations/telemetry/slo-gates?{slo_query_str}"

    try:
        telemetry = fetch_json(summary_url, args.token)
        health = fetch_json(health_url, args.token)
        slo = fetch_json(slo_url, args.token)
    except urllib.error.HTTPError as exc:
        print(f"HTTP error while collecting evidence: {exc.code}", file=sys.stderr)
        return 1
    except urllib.error.URLError as exc:
        print(f"Network error while collecting evidence: {exc.reason}", file=sys.stderr)
        return 1

    evidence = {
        "collectedAt": datetime.now(timezone.utc).isoformat(),
        "baseUrl": args.base_url,
        "windowDays": args.days,
        "limit": args.limit,
        "telemetrySummary": telemetry,
        "healthSummary": health,
        "sloSummary": slo,
    }

    output_dir = os.path.dirname(args.output)
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(evidence, f, indent=2)

    print(f"Evidence written to {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
