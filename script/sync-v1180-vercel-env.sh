#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AMOE_ROUTER="${1:-}"

if [[ -z "$AMOE_ROUTER" ]]; then
  echo "Usage: $0 <AMOE_ROUTER_ADDRESS>" >&2
  exit 1
fi

HANDOFF="${ROOT_DIR}/tmp/base-v1.18.0-handoff.env"
if [[ -f "$HANDOFF" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$HANDOFF"
  set +a
fi

# CRON_SECRET for publish-cron lives in frontend/.env (not root .env).
if [[ -f "${ROOT_DIR}/frontend/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${ROOT_DIR}/frontend/.env"
  set +a
fi

REGISTRY="${REGISTRY_4626:-${REGISTRY:-0xDb8570Dd434b6fCb7f4463d1e7C6F01d4459A4E0}}"
OVAULT_FACTORY="${OVAULT_FACTORY:-0x70d0D2411D362BA50821389383Fa6B829d736232}"
VAULT_ACTIVATION_BATCHER="${VAULT_ACTIVATION_BATCHER:-0x4c4B8113ED37D8Fc4564f867edAf2B8EC13264a3}"
LOTTERY_MANAGER="${LOTTERY_MANAGER:-0xbE87AD917bE7f6a9AE1F9c9dd0A7Ec7550F3F8C1}"
VRF_CONSUMER="${VRF_CONSUMER:-0x0b41AD9Eb06EE14C360E1e3D16Af63F5a172Ec36}"
UNIVERSAL_BYTECODE_STORE="${UNIVERSAL_BYTECODE_STORE:-0xfa3e3b466635DAff910057f18749B93d56F9DE50}"
UNIVERSAL_CREATE2_DEPLOYER="${UNIVERSAL_CREATE2_DEPLOYER:-0x54660E61857a652753d805aD2c7b4f759C138bD5}"
DEPLOYMENT_BATCHER="${DEPLOYMENT_BATCHER:-0x02D7abC547F8B1e7E2D7a919D8D1005918361750}"
SOLANA_BRIDGE_ADAPTER="${SOLANA_BRIDGE_ADAPTER:-0x9A61814082A26192DD9Cb201b44058506685Be60}"
EPOCH="${DEPLOYMENT_EPOCH_TAG:-v1.18.0}"

declare -A SERVER_ENV=(
  [REGISTRY_4626]="$REGISTRY"
  [REGISTRY]="$REGISTRY"
  [CREATOR_REGISTRY]="$REGISTRY"
  [OVAULT_FACTORY]="$OVAULT_FACTORY"
  [VAULT_ACTIVATION_BATCHER]="$VAULT_ACTIVATION_BATCHER"
  [LOTTERY_MANAGER]="$LOTTERY_MANAGER"
  [CREATOR_LOTTERY_MANAGER]="$LOTTERY_MANAGER"
  [VRF_CONSUMER]="$VRF_CONSUMER"
  [UNIVERSAL_BYTECODE_STORE]="$UNIVERSAL_BYTECODE_STORE"
  [UNIVERSAL_CREATE2_DEPLOYER]="$UNIVERSAL_CREATE2_DEPLOYER"
  [UNIVERSAL_CREATE2_FROM_STORE]="$UNIVERSAL_CREATE2_DEPLOYER"
  [DEPLOYMENT_BATCHER]="$DEPLOYMENT_BATCHER"
  [CREATOR_VAULT_BATCHER]="$DEPLOYMENT_BATCHER"
  [DEPLOYMENT_BATCHER_AUTO_HANDOFF]="$DEPLOYMENT_BATCHER"
  [CREATOR_VAULT_BATCHER_AUTO_HANDOFF]="$DEPLOYMENT_BATCHER"
  [SOLANA_BRIDGE_ADAPTER]="$SOLANA_BRIDGE_ADAPTER"
  [LOTTERY_AMOE_ROUTER]="$AMOE_ROUTER"
  [DEPLOYMENT_EPOCH_TAG]="$EPOCH"
)

declare -A CLIENT_ENV=(
  [VITE_REGISTRY]="$REGISTRY"
  [VITE_FACTORY]="$OVAULT_FACTORY"
  [VITE_VAULT_ACTIVATION_BATCHER]="$VAULT_ACTIVATION_BATCHER"
  [VITE_LOTTERY_MANAGER]="$LOTTERY_MANAGER"
  [VITE_VRF_CONSUMER]="$VRF_CONSUMER"
  [VITE_UNIVERSAL_BYTECODE_STORE]="$UNIVERSAL_BYTECODE_STORE"
  [VITE_UNIVERSAL_CREATE2_DEPLOYER]="$UNIVERSAL_CREATE2_DEPLOYER"
  [VITE_DEPLOYMENT_BATCHER]="$DEPLOYMENT_BATCHER"
  [VITE_CREATOR_VAULT_BATCHER]="$DEPLOYMENT_BATCHER"
  [VITE_DEPLOYMENT_BATCHER_AUTO_HANDOFF]="$DEPLOYMENT_BATCHER"
  [VITE_CREATOR_VAULT_BATCHER_AUTO_HANDOFF]="$DEPLOYMENT_BATCHER"
  [VITE_SOLANA_BRIDGE_ADAPTER]="$SOLANA_BRIDGE_ADAPTER"
  [VITE_DEPLOYMENT_VERSION]="$EPOCH"
)

declare -A PRIVY_ENV=(
  [PRIVY_WALLET_AUTHORIZATION_KEY]="${PRIVY_WALLET_AUTHORIZATION_KEY:-}"
  [PRIVY_WALLET_OWNER_ID]="${PRIVY_WALLET_OWNER_ID:-}"
  [AMOE_LEDGER_PUBLISHER_PRIVY_WALLET_ID]="${CANONICAL_CSW_PRIVY_WALLET_ID:-${AMOE_LEDGER_PUBLISHER_PRIVY_WALLET_ID:-}}"
  [AMOE_LEDGER_PUBLISHER_OWNER_ADDRESS]="${AMOE_LEDGER_PUBLISHER_OWNER_ADDRESS:-0x858c01556EC5a8531fA4118d595430AC7fD0baF0}"
)

upsert_env() {
  local target="$1"
  local key="$2"
  local value="$3"
  if [[ "$target" == "preview" ]]; then
    echo "  skip preview $key (Vercel CLI requires interactive git-branch; set in dashboard)" >&2
    return 0
  fi
  # Vercel CLI often hangs after a successful save; kill once "Overrode" appears.
  ( vercel env add "$key" "$target" --force --yes --value "$value" >/tmp/vercel-env-add.log 2>&1 ) &
  local pid=$!
  local i=0
  while kill -0 "$pid" 2>/dev/null && (( i < 20 )); do
    if grep -q "Overrode Environment Variable" /tmp/vercel-env-add.log 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      wait "$pid" 2>/dev/null || true
      echo "  $target $key"
      return 0
    fi
    sleep 1
    i=$((i + 1))
  done
  kill "$pid" 2>/dev/null || true
  wait "$pid" 2>/dev/null || true
  if grep -q "Overrode Environment Variable" /tmp/vercel-env-add.log 2>/dev/null; then
    echo "  $target $key"
    return 0
  fi
  echo "  FAIL $target $key" >&2
  cat /tmp/vercel-env-add.log >&2
  return 1
}

cd "$ROOT_DIR/frontend"

echo "==> Syncing Vercel env for project 4626 (production + development; preview skipped)"
for target in production development; do
  for key in "${!SERVER_ENV[@]}"; do
    upsert_env "$target" "$key" "${SERVER_ENV[$key]}"
  done
  for key in "${!CLIENT_ENV[@]}"; do
    upsert_env "$target" "$key" "${CLIENT_ENV[$key]}"
  done
  for key in "${!PRIVY_ENV[@]}"; do
    value="${PRIVY_ENV[$key]}"
    if [[ -z "$value" ]]; then
      echo "  skip $target $key (empty locally)" >&2
      continue
    fi
    upsert_env "$target" "$key" "$value"
  done
done

cd "$ROOT_DIR/frontend"
echo "==> Redeploy latest production (picks up env + VITE_* build vars)"
if vercel redeploy 4626.fun --target=production --no-wait 2>&1 | tail -5; then
  :
else
  echo "    warn: vercel redeploy 4626.fun failed; retry from dashboard if needed" >&2
fi

echo "==> Trigger AMOE publish-cron (best-effort)"
if [[ -n "${CRON_SECRET:-}" ]]; then
  curl -fsS -H "Authorization: Bearer ${CRON_SECRET}" \
    "https://4626.fun/api/v1/lottery/amoe/publish-cron" || true
  curl -fsS -H "Authorization: Bearer ${CRON_SECRET}" \
    "https://app.4626.fun/api/v1/lottery/amoe/publish-cron" || true
else
  echo "    skip: CRON_SECRET not set locally"
fi
