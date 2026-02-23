#!/usr/bin/env python3
"""
Evaluate connector SLO gates and return non-zero exit code when gates fail.

Usage:
  python backend/scripts/evaluate_connector_slo_gates.py \
    --base-url http://127.0.0.1:8000 \
    --token <bearer_token> \
    --days 7 \
    --limit 2000 \
    --max-error-rate-pct 5
"""

import argparse
import json
import sys
import urllib.error
import urllib.parse
import urllib.request
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


def parse_args():
    parser = argparse.ArgumentParser(description="Evaluate connector SLO gates")
    parser.add_argument("--base-url", required=True, help="Backend base URL")
    parser.add_argument("--token", required=True, help="Bearer token")
    parser.add_argument("--days", type=int, default=7, help="Lookback window in days")
    parser.add_argument("--limit", type=int, default=2000, help="Telemetry event limit")
    parser.add_argument(
        "--max-error-rate-pct",
        type=float,
        default=None,
        help="Optional override for max error rate threshold",
    )
    parser.add_argument(
        "--min-schema-v2-pct",
        type=float,
        default=None,
        help="Optional override for minimum sales schema v2 coverage threshold",
    )
    parser.add_argument(
        "--min-schema-v2-sample-count",
        type=int,
        default=None,
        help="Optional override for minimum sales schema v2 sample count",
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

    query = {"days": args.days, "limit": args.limit}
    if args.max_error_rate_pct is not None:
        query["max_error_rate_pct"] = args.max_error_rate_pct
    if args.min_schema_v2_pct is not None:
        query["min_schema_v2_pct"] = args.min_schema_v2_pct
    if args.min_schema_v2_sample_count is not None:
        query["min_schema_v2_sample_count"] = args.min_schema_v2_sample_count
    query_str = urllib.parse.urlencode(query)
    url = f"{args.base_url.rstrip('/')}/api/integrations/integrations/telemetry/slo-gates?{query_str}"

    try:
        payload = fetch_json(url, args.token)
    except urllib.error.HTTPError as exc:
        print(f"HTTP error while evaluating SLO gates: {exc.code}", file=sys.stderr)
        return 2
    except urllib.error.URLError as exc:
        print(f"Network error while evaluating SLO gates: {exc.reason}", file=sys.stderr)
        return 2

    print(json.dumps(payload, indent=2))
    gates = payload.get("gates") or {}
    return 0 if gates.get("overallPassed") else 1


if __name__ == "__main__":
    raise SystemExit(main())
