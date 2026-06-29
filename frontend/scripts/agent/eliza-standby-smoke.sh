#!/usr/bin/env bash
# Local Eliza standby smoke: boot without XMTP consume, strip RAILWAY_* from .env
# so RAILWAY_TOKEN in developer .env does not trigger Railway-primary fatal guards.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

tmp_xmtp_db_dir="$(mktemp -d)"
tmp_env="$(mktemp)"
trap 'rm -rf "$tmp_xmtp_db_dir" "$tmp_env"' EXIT

if [[ -f .env ]]; then
  grep -v '^RAILWAY_' .env >"$tmp_env"
else
  : >"$tmp_env"
fi

set +e
timeout 20s env \
  PORT="${PORT:-8081}" \
  AGENT_RUNTIME_ROLE=standby \
  AGENT_CONSUME_XMTP=false \
  XMTP_DB_DIRECTORY="$tmp_xmtp_db_dir" \
  pnpm exec tsx --env-file="$tmp_env" server/agents/eliza/index.ts
code=$?
set -e

if [[ "$code" -eq 124 ]]; then
  exit 0
fi
exit "$code"
