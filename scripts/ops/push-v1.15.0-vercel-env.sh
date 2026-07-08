#!/usr/bin/env bash
# Push v1.15.0 infra env keys to Vercel (production + preview + development).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FRONTEND="$ROOT/frontend"
cd "$FRONTEND"

if ! command -v vercel >/dev/null 2>&1; then
  echo "vercel CLI required" >&2
  exit 1
fi

ENVIRONMENTS=(production preview development)

declare -A VALUES=(
  [DEPLOYMENT_EPOCH_TAG]=v1.15.0
  [REGISTRY_4626]=0x1eb9A364a3E763dD9249ba3413Dc19E13c1F4461
  [OVAULT_FACTORY]=0x26b74b1d3AadD17e714068d259051409C9f942d1
  [LOTTERY_MANAGER]=0xD62a8a2F4c25587FA80ED5782b50Af6654122b0b
  [LOTTERY_MANAGER]=0xD62a8a2F4c25587FA80ED5782b50Af6654122b0b
  [VAULT_ACTIVATION_BATCHER]=0xB06d99c81994F5829ba462c4afA78eCff75bC281
  [SOLANA_BRIDGE_ADAPTER]=0x363662F9728A9fd12c7CA398e5A6d1d9E7De07F1
  [UNIVERSAL_BYTECODE_STORE]=0x7D1029a832E2BEd2C961bC912b623b763862Ad3C
  [UNIVERSAL_CREATE2_DEPLOYER]=0xdC75A18C521f6Ae1ACa112A98E46c8231F431BC0
  [UNIVERSAL_CREATE2_FROM_STORE]=0xdC75A18C521f6Ae1ACa112A98E46c8231F431BC0
  [DEPLOYMENT_BATCHER]=0x17163e67dED6B45bd2A7E6a509A32fB7b0cB6D33
  [DEPLOYMENT_BATCHER]=0x17163e67dED6B45bd2A7E6a509A32fB7b0cB6D33
  [DEPLOYMENT_BATCHER_AUTO_HANDOFF]=0x17163e67dED6B45bd2A7E6a509A32fB7b0cB6D33
  [VITE_REGISTRY]=0x1eb9A364a3E763dD9249ba3413Dc19E13c1F4461
  [VITE_FACTORY]=0x26b74b1d3AadD17e714068d259051409C9f942d1
  [VITE_VAULT_ACTIVATION_BATCHER]=0xB06d99c81994F5829ba462c4afA78eCff75bC281
  [VITE_LOTTERY_MANAGER]=0xD62a8a2F4c25587FA80ED5782b50Af6654122b0b
  [VITE_UNIVERSAL_BYTECODE_STORE]=0x7D1029a832E2BEd2C961bC912b623b763862Ad3C
  [VITE_UNIVERSAL_CREATE2_DEPLOYER]=0xdC75A18C521f6Ae1ACa112A98E46c8231F431BC0
  [VITE_DEPLOYMENT_BATCHER]=0x17163e67dED6B45bd2A7E6a509A32fB7b0cB6D33
  [VITE_DEPLOYMENT_BATCHER_AUTO_HANDOFF]=0x17163e67dED6B45bd2A7E6a509A32fB7b0cB6D33
  [VITE_SOLANA_BRIDGE_ADAPTER]=0x363662F9728A9fd12c7CA398e5A6d1d9E7De07F1
  [VITE_DEPLOYMENT_VERSION]=v1.15.0
)

upsert_env() {
  local key="$1"
  local value="$2"
  local env_name="$3"
  if vercel env update "$key" "$env_name" --value "$value" --yes </dev/null >/dev/null 2>&1; then
    echo "  $env_name: updated $key"
    return 0
  fi
  vercel env rm "$key" "$env_name" --yes </dev/null >/dev/null 2>&1 || true
  if [[ "$env_name" == "preview" ]]; then
    vercel env add "$key" preview "" --value "$value" --yes </dev/null >/dev/null
  else
    vercel env add "$key" "$env_name" --value "$value" --yes --force </dev/null >/dev/null
  fi
  echo "  $env_name: added $key"
}

for env_name in "${ENVIRONMENTS[@]}"; do
  echo "Updating Vercel $env_name..."
  for key in "${!VALUES[@]}"; do
    upsert_env "$key" "${VALUES[$key]}" "$env_name"
  done
done

echo "Vercel env cutover complete."
