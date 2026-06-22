#!/usr/bin/env bash
# Smoke-test the deploy dry-run API against a local fork.
# Prerequisites: pnpm -C frontend dev:deploy-dry-run must be running.
#
# Authenticates with a REAL local session token minted from AUTH_SESSION_SECRET
# (scripts/mint-dev-session-token.mjs) — the legacy X-Deploy-Dry-Run-Dev bypass
# header was removed and must not be reintroduced (see deploySessionDryRun.test.ts).
#
# The placeholder creator token (0x…0003) has no on-chain authority on the fork,
# so the handler correctly stops at the creator-token authority check (403). Reaching
# that check proves the full plumbing: server up -> DB configured -> auth passed ->
# rate-limit passed -> body parsed -> fork RPC resolved -> creator-authority validation
# reached. A full phase simulation requires a real creator token owned by the session
# wallet on the fork and is covered by the vitest dry-run suite (deploySessionDryRun).

set -euo pipefail

PORT="${DEPLOY_DRY_RUN_PORT:-5174}"
OWNER="0x0000000000000000000000000000000000000002"
ORIGIN="http://localhost:${PORT}"
HOST_HEADER="localhost:${PORT}"
URL="http://127.0.0.1:${PORT}/api/deploy/v2/session/dry-run"

if ! command -v node >/dev/null 2>&1; then
  echo "node is required to mint the dev session token." >&2
  exit 2
fi

TOKEN="$(node scripts/mint-dev-session-token.mjs "${OWNER}")"
if [[ -z "${TOKEN}" ]]; then
  echo "Failed to mint dev session token (is AUTH_SESSION_SECRET set in frontend/.env?)." >&2
  exit 2
fi

BODY='{
  "smartWallet": "0x0000000000000000000000000000000000000002",
  "creatorToken": "0x0000000000000000000000000000000000000003",
  "ownerAddress": "0x0000000000000000000000000000000000000002",
  "phase1Calls": [{"to": "0x0000000000000000000000000000000000000010", "value": "0", "data": "0x12345678"}],
  "phase2CoreCalls": [{"to": "0x0000000000000000000000000000000000000011", "value": "0", "data": "0x23456789"}],
  "phase2FinalizeCalls": [{"to": "0x0000000000000000000000000000000000000012", "value": "0", "data": "0x34567890"}],
  "phase3Calls": [{"to": "0x0000000000000000000000000000000000000013", "value": "0", "data": "0x45678901"}],
  "phase4Calls": [],
  "version": "vtest"
}'

echo "Smoke-testing deploy dry-run at ${URL} (authenticated session: ${OWNER})..."
RESP=$(curl -sS -w "\n%{http_code}" -X POST "$URL" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Host: ${HOST_HEADER}" \
  -H "Origin: ${ORIGIN}" \
  -d "$BODY")
HTTP_CODE=$(echo "$RESP" | tail -n1)
BODY_OUT=$(echo "$RESP" | sed '$d')

echo "HTTP $HTTP_CODE"
echo "$BODY_OUT" | jq . 2>/dev/null || echo "$BODY_OUT"

if [[ "$HTTP_CODE" == "200" ]]; then
  if echo "$BODY_OUT" | grep -q '"success":true'; then
    OK=$(echo "$BODY_OUT" | jq -r '.data.ok // false' 2>/dev/null || echo "false")
    if [[ "$OK" == "true" ]]; then
      echo "PASS: Dry-run completed successfully on fork."
      exit 0
    fi
    echo "Dry-run ran but reported failure (check phases/failure in response)."
    exit 0
  fi
fi

if [[ "$HTTP_CODE" == "403" ]] && echo "$BODY_OUT" | grep -q "Creator token authority mismatch"; then
  echo "PASS: Dry-run handler reached creator-token authority check (auth + DB + fork plumbing OK). Full phase simulation requires a real creator token owned by the session wallet on the fork."
  exit 0
fi

echo "Smoke test did not pass (see error above)."
exit 1
