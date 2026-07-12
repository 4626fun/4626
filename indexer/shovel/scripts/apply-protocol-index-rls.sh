#!/usr/bin/env bash
# Idempotent apply of migrations/001_protocol_index_rls.sql.
# Exits non-zero when required tables are not ready yet (caller should retry).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SQL="$ROOT/migrations/001_protocol_index_rls.sql"

if [[ -z "${SHOVEL_PG_URL:-}" ]]; then
  echo "[shovel-rls] SHOVEL_PG_URL unset — skip" >&2
  exit 0
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "[shovel-rls] psql not installed — skip (apply manually after first Shovel run)" >&2
  exit 0
fi

if [[ ! -f "$SQL" ]]; then
  echo "[shovel-rls] missing $SQL — skip" >&2
  exit 0
fi

echo "[shovel-rls] applying $SQL" >&2
if psql "$SHOVEL_PG_URL" -v ON_ERROR_STOP=1 -f "$SQL" >/tmp/shovel-rls.out 2>/tmp/shovel-rls.err; then
  echo "[shovel-rls] ok" >&2
  exit 0
fi

err="$(tr '\n' ' ' </tmp/shovel-rls.err | head -c 400)"
echo "[shovel-rls] apply failed — ${err}" >&2
exit 1
