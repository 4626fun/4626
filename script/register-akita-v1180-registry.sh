#!/usr/bin/env bash
set -euo pipefail

# Register AKITA creator coin on v1.18.0 Registry4626 for lottery / AMOE paths.
#
# Usage:
#   ./script/register-akita-v1180-registry.sh
#   ./script/register-akita-v1180-registry.sh --dry-run

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

DRY_RUN=0
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=1
fi

if [[ -z "${PRIVATE_KEY:-}" || -z "${BASE_RPC_URL:-}" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT_DIR/.env"
  set +a
fi

REGISTRY="${REGISTRY_4626:-0x1365e9CEfc516f8A287c51FBaeF96FB4581c6CA2}"
CREATOR_COIN="${AKITA_CREATOR_COIN:-0x5b674196812451b7cec024fe9d22d2c0b172fa75}"
VAULT="${AKITA_VAULT:-0x82C06EaAE27B1Ca31fA29F22341A162A670A4471}"
WRAPPER="${AKITA_WRAPPER:-0x58Cd1E9248F89138208A601e95A531d3c0fa0c4f}"
SHARE_OFT="${AKITA_SHARE_OFT:-0x4df30fFfDA1D4A81bcf4DC778292Be8Ff9752a57}"
GAUGE="${AKITA_GAUGE:-0xB471B53cD0A30289Bc3a2dc3c6dd913288F8baA1}"
ORACLE="${AKITA_ORACLE:-0x8C044aeF10d05bcC53912869db89f6e1f37bC6fC}"
CREATOR_WALLET="${AKITA_CREATOR_WALLET:-0xAb6d5C10b03300326cd7fab7267ae192842967b5}"

send_tx() {
  local label="$1"
  local to="$2"
  local sig="$3"
  shift 3
  echo "==> $label"
  if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "    (dry-run) cast send $to \"$sig\" $*"
    return 0
  fi
  cast send "$to" "$sig" "$@" \
    --rpc-url "$BASE_RPC_URL" --private-key "$PRIVATE_KEY" --json | jq -r '.transactionHash // .hash // .'
}

token_field="$(cast call "$REGISTRY" "getTokenInfo(address)(address)" "$CREATOR_COIN" --rpc-url "$BASE_RPC_URL" 2>/dev/null || true)"
if [[ "$token_field" == "$CREATOR_COIN" ]]; then
  echo "AKITA already registered on $REGISTRY"
else
  NAME="$(cast call "$CREATOR_COIN" "name()(string)" --rpc-url "$BASE_RPC_URL")"
  SYMBOL="$(cast call "$CREATOR_COIN" "symbol()(string)" --rpc-url "$BASE_RPC_URL")"
  send_tx "registerToken" "$REGISTRY" \
    "registerToken(address,string,string,address,address,uint24)" \
    "$CREATOR_COIN" "$NAME" "$SYMBOL" "$CREATOR_WALLET" "0x0000000000000000000000000000000000000000" 0
fi

send_tx "setVault" "$REGISTRY" "setVault(address,address)" "$CREATOR_COIN" "$VAULT"
send_tx "setWrapperForToken" "$REGISTRY" "setWrapperForToken(address,address)" "$CREATOR_COIN" "$WRAPPER"
send_tx "setShareOFTForToken" "$REGISTRY" "setShareOFTForToken(address,address)" "$CREATOR_COIN" "$SHARE_OFT"
send_tx "setGaugeControllerForToken" "$REGISTRY" "setGaugeControllerForToken(address,address)" "$CREATOR_COIN" "$GAUGE"
send_tx "setOracleForToken" "$REGISTRY" "setOracleForToken(address,address)" "$CREATOR_COIN" "$ORACLE"

ACTIVE="$(cast call "$REGISTRY" "isTokenActive(address)(bool)" "$CREATOR_COIN" --rpc-url "$BASE_RPC_URL")"
echo "isTokenActive($CREATOR_COIN) => $ACTIVE"
if [[ "$ACTIVE" != "true" ]]; then
  send_tx "setTokenStatus(true)" "$REGISTRY" "setTokenStatus(address,bool)" "$CREATOR_COIN" true
fi

ACTIVE="$(cast call "$REGISTRY" "isTokenActive(address)(bool)" "$CREATOR_COIN" --rpc-url "$BASE_RPC_URL")"
VAULT_LIVE="$(cast call "$REGISTRY" "getVaultForToken(address)(address)" "$CREATOR_COIN" --rpc-url "$BASE_RPC_URL")"
echo "OK registry=$REGISTRY active=$ACTIVE vault=$VAULT_LIVE"
