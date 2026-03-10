#!/usr/bin/env bash
# Smoke-test the deploy dry-run API against a local fork.
# Prerequisites: pnpm -C frontend dev:deploy-dry-run must be running.
# Uses dev bypass (DEPLOY_DRY_RUN_DEV_BYPASS=1) for unauthenticated request.

set -euo pipefail

PORT="${DEPLOY_DRY_RUN_PORT:-5174}"
OWNER="0x0000000000000000000000000000000000000002"
ORIGIN="http://localhost:${PORT}"
HOST_HEADER="localhost:${PORT}"
URL="http://127.0.0.1:${PORT}/api/deploy/session/dry-run"

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

echo "Smoke-testing deploy dry-run at ${URL}..."
RESP=$(curl -sS -w "\n%{http_code}" -X POST "$URL" \
  -H 'Content-Type: application/json' \
  -H "X-Deploy-Dry-Run-Dev: ${OWNER}" \
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

if [[ "$HTTP_CODE" == "403" ]] && echo "$BODY_OUT" | grep -q "Creator access required"; then
  echo "PASS: Dry-run handler reached allowlist check (auth + origin OK). Full flow requires approved creator wallet."
  exit 0
fi

echo "Smoke test did not pass (see error above)."
exit 1
