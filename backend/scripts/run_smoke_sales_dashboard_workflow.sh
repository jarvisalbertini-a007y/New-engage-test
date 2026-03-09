#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

CI=true npm --prefix frontend test -- src/pages/SalesIntelligence.test.tsx --watch=false --runInBand
"$ROOT_DIR/.venv311/bin/python" -m pytest -q backend/tests/test_predictive_runbook_contract.py
