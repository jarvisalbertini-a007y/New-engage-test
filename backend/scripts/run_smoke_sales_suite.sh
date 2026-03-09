#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

bash backend/scripts/run_smoke_frontend_sales_workflow.sh
bash backend/scripts/run_smoke_sales_dashboard_workflow.sh
bash backend/scripts/run_smoke_multi_channel_controls_workflow.sh
bash backend/scripts/run_smoke_baseline_command_aliases_workflow.sh
bash backend/scripts/run_smoke_baseline_command_aliases_artifact_workflow.sh
bash backend/scripts/run_smoke_sales_campaign_workflow.sh
bash backend/scripts/run_smoke_sales_runtime_prereqs_artifact_workflow.sh
bash backend/scripts/run_smoke_baseline_metrics_artifact_workflow.sh
bash backend/scripts/run_smoke_connector_canary_dry_run_workflow.sh
bash backend/scripts/run_smoke_connector_credential_lifecycle_workflow.sh
bash backend/scripts/run_smoke_connector_reliability_workflow.sh
bash backend/scripts/run_smoke_connector_input_validation_workflow.sh
bash backend/scripts/run_smoke_telemetry_quality_workflow.sh
bash backend/scripts/run_smoke_telemetry_event_root_backfill_workflow.sh
bash backend/scripts/run_smoke_telemetry_event_root_backfill_artifact_cleanup_workflow.sh
bash backend/scripts/run_smoke_schema_gate_workflow.sh
bash backend/scripts/run_smoke_orchestration_slo_gate_workflow.sh
bash backend/scripts/run_smoke_connector_release_gate_workflow.sh
bash backend/scripts/run_smoke_health.sh
