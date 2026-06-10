#!/usr/bin/env bash
# Smoke-test AlfaClub counter-trade run + auth wiring.
set -euo pipefail

BASE_URL="${COUNTER_TRADE_BASE_URL:-https://app.4626.fun}"
CRON_SECRET_VALUE="${CRON_SECRET:-}"
EXPECT_DISABLED="${COUNTER_TRADE_EXPECT_DISABLED:-0}"
HTTP_METHOD="${COUNTER_TRADE_HTTP_METHOD:-POST}"

usage() {
  cat <<'EOF'
Usage:
  scripts/ops/counter-trade-smoke.sh [options]

Options:
  --base-url <url>         Base URL (default: https://app.4626.fun)
  --cron-secret <secret>   Cron secret (default: reads CRON_SECRET env)
  --expect-disabled        Assert run response reason=disabled
  --method <GET|POST>      HTTP method for run endpoint (default: POST)
  -h, --help               Show this help

Environment equivalents:
  COUNTER_TRADE_BASE_URL
  CRON_SECRET
  COUNTER_TRADE_EXPECT_DISABLED=1
  COUNTER_TRADE_HTTP_METHOD=GET|POST

Examples:
  CRON_SECRET=... scripts/ops/counter-trade-smoke.sh
  scripts/ops/counter-trade-smoke.sh --cron-secret "$CRON_SECRET" --expect-disabled
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --base-url)
      BASE_URL="${2:-}"
      shift 2
      ;;
    --cron-secret)
      CRON_SECRET_VALUE="${2:-}"
      shift 2
      ;;
    --expect-disabled)
      EXPECT_DISABLED=1
      shift
      ;;
    --method)
      HTTP_METHOD="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown arg: $1" >&2
      usage
      exit 1
      ;;
  esac
done

HTTP_METHOD_UPPER="$(echo "$HTTP_METHOD" | tr '[:lower:]' '[:upper:]')"
if [[ "$HTTP_METHOD_UPPER" != "GET" && "$HTTP_METHOD_UPPER" != "POST" ]]; then
  echo "ERROR: --method must be GET or POST" >&2
  exit 1
fi

if [[ -z "$CRON_SECRET_VALUE" ]]; then
  echo "ERROR: missing CRON secret (set CRON_SECRET or pass --cron-secret)." >&2
  exit 1
fi

RUN_URL="${BASE_URL%/}/api/v1/alfaclub/counter-trade-run"
STATUS_URL="${BASE_URL%/}/api/v1/alfaclub/counter-trade-status"

TMP_UNAUTH="$(mktemp)"
TMP_AUTH="$(mktemp)"
TMP_STATUS="$(mktemp)"
cleanup() { rm -f "$TMP_UNAUTH" "$TMP_AUTH" "$TMP_STATUS"; }
trap cleanup EXIT

echo "== counter-trade smoke =="
echo "base_url: $BASE_URL"
echo "run_url:  $RUN_URL"
echo "status:   $STATUS_URL"
echo "method:   $HTTP_METHOD_UPPER"
echo

echo "-- 1) run endpoint rejects missing secret --"
UNAUTH_CODE="$(curl -sS -o "$TMP_UNAUTH" -w '%{http_code}' -X "$HTTP_METHOD_UPPER" "$RUN_URL")"
echo "HTTP $UNAUTH_CODE"
if [[ "$UNAUTH_CODE" != "401" ]]; then
  echo "ERROR: expected 401 without cron secret" >&2
  echo "body: $(cat "$TMP_UNAUTH")" >&2
  exit 1
fi

echo
echo "-- 2) run endpoint accepts valid secret --"
AUTH_CODE="$(curl -sS -o "$TMP_AUTH" -w '%{http_code}' -X "$HTTP_METHOD_UPPER" \
  -H "x-cron-secret: $CRON_SECRET_VALUE" \
  "$RUN_URL")"
echo "HTTP $AUTH_CODE"
if [[ "$AUTH_CODE" != "200" && "$AUTH_CODE" != "202" ]]; then
  echo "ERROR: expected 200 or 202 with cron secret" >&2
  echo "body: $(cat "$TMP_AUTH")" >&2
  exit 1
fi

BODY_JSON="$(cat "$TMP_AUTH")"
SUCCESS_VALUE="$(node -e "const j=JSON.parse(process.argv[1]); process.stdout.write(String(j.success));" "$BODY_JSON" 2>/dev/null || true)"
REASON_VALUE="$(node -e "const j=JSON.parse(process.argv[1]); process.stdout.write(String(j.reason ?? '')); " "$BODY_JSON" 2>/dev/null || true)"
ROOM_VALUE="$(node -e "const j=JSON.parse(process.argv[1]); process.stdout.write(String(j.data?.roomId ?? '')); " "$BODY_JSON" 2>/dev/null || true)"

echo "success: ${SUCCESS_VALUE:-<parse-error>}"
echo "reason:  ${REASON_VALUE:-<none>}"
echo "roomId:  ${ROOM_VALUE:-<none>}"

if [[ "$EXPECT_DISABLED" == "1" && "${REASON_VALUE}" != "disabled" ]]; then
  echo "ERROR: expected reason=disabled but got '${REASON_VALUE}'" >&2
  exit 1
fi

echo
echo "-- 3) status endpoint requires auth session --"
STATUS_CODE="$(curl -sS -o "$TMP_STATUS" -w '%{http_code}' "$STATUS_URL")"
echo "HTTP $STATUS_CODE"
if [[ "$STATUS_CODE" != "401" ]]; then
  echo "ERROR: expected 401 for status endpoint without user session" >&2
  echo "body: $(cat "$TMP_STATUS")" >&2
  exit 1
fi

echo
echo "OK: counter-trade smoke checks passed."

