#!/usr/bin/env bash
# Sync Railway Hermit ALFACLUB_API_KEY → Vercel production (hermit4626 bot token).
# Usage:
#   vercel login   # if CLI token is stale
#   bash frontend/scripts/ops/sync-alfaclub-api-key-to-vercel.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT"

PROJECT_ID="${VERCEL_PROJECT_ID:-prj_OepP5CKsVckpdLIGi1zRCZdiUPJ7}"
TEAM_ID="${VERCEL_TEAM_ID:-team_vwFyCLfPwJ8GfxE2yGHIkRJm}"

KEY="$(railway variables --service 4626-hermit-agent --kv 2>/dev/null | awk -F= '$1=="ALFACLUB_API_KEY"{print $2; exit}')"
KEY="${KEY//$'\r'/}"
if [[ ! "$KEY" =~ ^alfa_bot_ ]]; then
  echo "error: could not read ALFACLUB_API_KEY from Railway 4626-hermit-agent" >&2
  exit 1
fi

echo "Railway key prefix: ${KEY:0:12}… (len ${#KEY})"

# Prefer CLI when authenticated
if vercel whoami >/dev/null 2>&1; then
  echo "Using vercel CLI…"
  # Remove existing production value so add does not create duplicates
  vercel env rm ALFACLUB_API_KEY production --yes --scope akita-llc 2>/dev/null || true
  printf '%s' "$KEY" | vercel env add ALFACLUB_API_KEY production --scope akita-llc
  echo "Vercel production ALFACLUB_API_KEY updated. Trigger a production redeploy if crons are mid-flight."
  exit 0
fi

echo "error: vercel CLI not authenticated. Run: vercel login" >&2
echo "Then re-run this script." >&2
exit 2
