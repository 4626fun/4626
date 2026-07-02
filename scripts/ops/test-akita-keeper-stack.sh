#!/usr/bin/env bash
# Smoke-test AKITA keeper stack wiring (read-only dry runs).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
KPR_DIR="$ROOT/kpr"

AKITA_VAULT="0x82C06EaAE27B1Ca31fA29F22341A162A670A4471"
AKITA_CREATOR="0x5b674196812451b7cec024fe9d22d2c0b172fa75"
AKITA_ORACLE="0x8C044aeF10d05bcC53912869db89f6e1f37bC6fC"
CANONICAL_ADAPTER="0x700b4BBAf965c013123bAd02a6562FBa487aC0f1"
LEGACY_ADAPTER="0x2414b595c4f18532a5836b6e2e6d536832c572e8"

echo "== AKITA keeper stack smoke =="
echo "repo: $ROOT"
echo

if [[ ! -f "$KPR_DIR/.env" ]]; then
  echo "WARN: $KPR_DIR/.env missing — copy from kpr/secrets.example.env"
else
  echo "OK: kpr/.env present"
fi

echo
echo "-- env sanity --"
required=(KPR_API_BASE_URL KPR_API_KEY BASE_RPC_URL)
for key in "${required[@]}"; do
  if [[ -z "${!key:-}" ]]; then
    if [[ -f "$KPR_DIR/.env" ]]; then
      # shellcheck disable=SC1090
      set -a && source "$KPR_DIR/.env" && set +a
    fi
  fi
  if [[ -z "${!key:-}" ]]; then
    echo "MISSING: $key"
  else
    echo "OK: $key set"
  fi
done

if [[ "${KPR_API_BASE_URL:-}" == *"4626.fun/api"* && "${KPR_API_BASE_URL:-}" != *"app.4626.fun"* ]]; then
  echo "WARN: KPR_API_BASE_URL should use https://app.4626.fun/api (marketing host returns 401 on protected routes)"
fi

for oracle_var in CHARM_REBALANCE_ORACLE_ADDRESS AJNA_BUCKET_ORACLE_ADDRESS; do
  val="${!oracle_var:-}"
  if [[ -n "$val" && "${val,,}" != "${AKITA_ORACLE,,}" ]]; then
    echo "WARN: $oracle_var=$val (AKITA live oracle is $AKITA_ORACLE)"
  elif [[ -n "$val" ]]; then
    echo "OK: $oracle_var matches AKITA oracle"
  fi
done

echo
echo "-- registry auth --"
if [[ -n "${KPR_API_BASE_URL:-}" && -n "${KPR_API_KEY:-}" ]]; then
  status="$(curl -sS -o /tmp/akita-vaults.json -w '%{http_code}' \
    -H "Authorization: Bearer ${KPR_API_KEY}" \
    "${KPR_API_BASE_URL%/}/vaults/active?chainId=8453")"
  echo "GET /vaults/active -> HTTP $status"
  if [[ "$status" == "200" ]]; then
    count="$(node -e "const j=require('/tmp/akita-vaults.json'); console.log(j?.data?.count ?? 0)")"
    echo "OK: registry returned $count vault(s)"
  else
    echo "FAIL: registry auth — check KPR_API_KEY on Vercel and app.4626.fun base URL"
  fi
else
  echo "SKIP: registry (KPR_API_BASE_URL / KPR_API_KEY not loaded)"
fi

echo
echo "-- KPR dry workflows --"
cd "$KPR_DIR"
pnpm exec tsx runner.ts vault-keeper --dry-run || echo "WARN: vault-keeper dry-run failed"
# Solana orchestrator smoke (share mesh — no legacy strategy rebalance)
pnpm preflight-orchestrator || echo "WARN: solana preflight reported blockers (expected until prod env is aligned)"

echo
echo "-- hints --"
echo "Vault:   $AKITA_VAULT"
echo "Creator: $AKITA_CREATOR"
echo "Oracle:  $AKITA_ORACLE"
echo "Solana:  scan canonical $CANONICAL_ADAPTER + legacy $LEGACY_ADAPTER for CREATOR balances"
echo "Enable:  KEEPER_AJNA_MANAGER_ENQUEUE_ENABLED=1, KEEPER_SOLANA_RECONCILE_ENABLED=1 on Vercel for cron lanes"
