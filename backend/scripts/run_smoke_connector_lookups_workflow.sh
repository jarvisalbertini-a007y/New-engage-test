#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

bash backend/scripts/run_smoke_connector_lookups_ui_workflow.sh
bash backend/scripts/run_smoke_connector_lookups_export_workflow.sh
