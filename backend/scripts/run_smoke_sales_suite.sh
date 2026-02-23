#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

bash backend/scripts/run_smoke_sales_campaign_workflow.sh
bash backend/scripts/run_smoke_connector_canary_dry_run_workflow.sh
bash backend/scripts/run_smoke_schema_gate_workflow.sh
bash backend/scripts/run_smoke_connector_release_gate_workflow.sh
bash backend/scripts/run_smoke_health.sh
