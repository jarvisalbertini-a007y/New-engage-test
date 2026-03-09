#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

bash backend/scripts/run_smoke_connector_orchestration_workflow.sh
bash backend/scripts/run_smoke_connector_provider_lookups_workflow.sh
bash backend/scripts/run_smoke_connector_lookups_workflow.sh
bash backend/scripts/run_smoke_sendgrid_reliability_workflow.sh
bash backend/scripts/run_smoke_credential_freshness_workflow.sh
