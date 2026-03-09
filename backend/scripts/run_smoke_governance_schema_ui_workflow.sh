#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

CI=true npm --prefix frontend test -- \
  src/pages/Integrations.test.tsx \
  src/pages/SalesIntelligence.test.tsx \
  --watch=false \
  --testNamePattern="governance schema"
