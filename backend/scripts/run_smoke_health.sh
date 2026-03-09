#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

UVICORN_BIN="${UVICORN_BIN:-$ROOT_DIR/.venv311/bin/uvicorn}"
HOST="${SMOKE_HOST:-127.0.0.1}"
PORT="${SMOKE_PORT:-8001}"
HEALTH_URL="http://${HOST}:${PORT}/api/health"

LOG_FILE="${SMOKE_LOG_FILE:-/tmp/engageai_smoke_uvicorn.log}"
RESPONSE_FILE="${SMOKE_RESPONSE_FILE:-/tmp/engageai_smoke_response.json}"

cleanup() {
  if [[ -n "${SERVER_PID:-}" ]]; then
    kill "$SERVER_PID" >/dev/null 2>&1 || true
    wait "$SERVER_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

ENGAGEAI_SKIP_DB_CONNECT=1 PYTHONPATH=backend "$UVICORN_BIN" backend.server:app --host "$HOST" --port "$PORT" >"$LOG_FILE" 2>&1 &
SERVER_PID=$!

for _ in {1..25}; do
  if curl -sf "$HEALTH_URL" >"$RESPONSE_FILE" 2>/dev/null; then
    break
  fi
  sleep 1
done

curl -sf "$HEALTH_URL" >"$RESPONSE_FILE"
cat "$RESPONSE_FILE"
