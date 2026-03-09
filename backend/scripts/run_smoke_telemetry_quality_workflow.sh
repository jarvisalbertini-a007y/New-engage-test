#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

bash backend/scripts/run_smoke_telemetry_status_filter_workflow.sh
bash backend/scripts/run_smoke_telemetry_status_count_workflow.sh
bash backend/scripts/run_smoke_telemetry_export_distribution_workflow.sh
