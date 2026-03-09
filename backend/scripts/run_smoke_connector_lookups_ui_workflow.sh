#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

CI=true npm --prefix frontend test -- src/lib/api.test.js --watch=false --runInBand --testNamePattern="supports connector lookup and enrichment endpoints"

CI=true npm --prefix frontend test -- src/pages/Integrations.test.tsx --watch=false --runInBand --testNamePattern="connector lookup sandbox controls|connector lookup metadata for rate limits, provider-order diagnostics, storage policy, and export payloads|rate-limited"
