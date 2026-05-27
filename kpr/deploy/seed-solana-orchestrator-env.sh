#!/usr/bin/env bash
# Build a minimal solana-keeper-orchestrator env from kpr/.env (KPR_* / SOLANA_* only).
#   cd /opt/4626
#   sudo bash kpr/deploy/seed-solana-orchestrator-env.sh \
#     --source /opt/4626/kpr/.env \
#     --dest /etc/4626/solana-keeper-orchestrator.env
#
# Preserves existing SOLANA_ORCHESTRATOR_API_KEY when dest already exists.

set -euo pipefail

SOURCE=""
DEST="/etc/4626/solana-keeper-orchestrator.env"
DRY_RUN=0
HOOK_SCHEMA="auto"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --source)
      SOURCE="${2:-}"
      shift 2
      ;;
    --dest)
      DEST="${2:-}"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    --hook-schema)
      HOOK_SCHEMA="${2:-}"
      shift 2
      ;;
    *)
      echo "Unknown arg: $1" >&2
      exit 1
      ;;
  esac
done

if [[ ! "${HOOK_SCHEMA}" =~ ^(auto|legacy|canonical)$ ]]; then
  echo "--hook-schema must be auto, legacy, or canonical" >&2
  exit 1
fi

if [[ -z "${SOURCE}" || ! -f "${SOURCE}" ]]; then
  echo "--source must point to an existing kpr/.env file" >&2
  exit 1
fi

read_env() {
  local key="$1"
  local line
  line="$(grep -E "^${key}=" "${SOURCE}" | tail -1 || true)"
  if [[ -n "${line}" ]]; then
    printf '%s' "${line#*=}"
    return 0
  fi
  return 1
}

# Map legacy CRE_* → KPR_* when reading source.
read_env_with_legacy() {
  local primary="$1"
  shift
  local val=""
  if val="$(read_env "${primary}" 2>/dev/null)"; then
    printf '%s' "${val}"
    return 0
  fi
  for legacy in "$@"; do
    if val="$(read_env "${legacy}" 2>/dev/null)"; then
      printf '%s' "${val}"
      return 0
    fi
  done
  return 1
}

require_from_source() {
  local key="$1"
  local val
  if ! val="$(read_env_with_legacy "${key}")"; then
    echo "missing ${key} in ${SOURCE}" >&2
    exit 1
  fi
  printf '%s' "${val}"
}

optional_from_source() {
  local key="$1"
  read_env_with_legacy "${key}" 2>/dev/null || true
}

existing_api_key=""
if [[ -f "${DEST}" ]]; then
  existing_api_key="$(grep -E '^SOLANA_ORCHESTRATOR_API_KEY=' "${DEST}" | tail -1 | cut -d= -f2- || true)"
fi

api_key="${existing_api_key}"
if [[ -z "${api_key}" ]]; then
  if api_key="$(optional_from_source SOLANA_ORCHESTRATOR_API_KEY)" && [[ -n "${api_key}" ]]; then
    :
  elif command -v openssl >/dev/null 2>&1; then
    api_key="$(openssl rand -hex 32)"
  else
    echo "Set SOLANA_ORCHESTRATOR_API_KEY manually — openssl not available" >&2
    exit 1
  fi
fi

quote_json_if_needed() {
  local raw="$1"
  if [[ -z "${raw}" ]]; then
    printf "'{}'"
    return
  fi
  if [[ "${raw}" == \'*\' ]]; then
    printf '%s' "${raw}"
    return
  fi
  if [[ "${raw}" == \"*\" ]]; then
    printf '%s' "${raw}"
    return
  fi
  printf "'%s'" "${raw}"
}

CANONICAL_SOLANA_BRIDGE_ADAPTER="0x700b4BBAf965c013123bAd02a6562FBa487aC0f1"
CANONICAL_LOTTERY_MANAGER="0x5c0115589d7F4930A0dc93417aE409f44186f4E7"
DEPRECATED_SOLANA_ADAPTERS="0x2414b595c4f18532A5836B6e2E6d536832c572e8|0x3a9dC0b2c11b348E4bD60D9605dc3D4Be9bB6cf5|0x90F578A4e23c1cB8DDFE63fd496ED7F4474f2b00"
DEPRECATED_LOTTERY_MANAGERS="0x3F7AfD93824Ab25F73Bdca59aFDaB560F865b0C3"

normalize_solana_bridge_adapter() {
  local raw="$1"
  if [[ -z "${raw}" ]]; then
    printf '%s' "${CANONICAL_SOLANA_BRIDGE_ADAPTER}"
    return
  fi
  if echo "${raw}" | grep -Eiq "${DEPRECATED_SOLANA_ADAPTERS}"; then
    echo "note: overriding deprecated SOLANA_BRIDGE_ADAPTER ${raw} -> ${CANONICAL_SOLANA_BRIDGE_ADAPTER}" >&2
    printf '%s' "${CANONICAL_SOLANA_BRIDGE_ADAPTER}"
    return
  fi
  printf '%s' "${raw}"
}

normalize_lottery_manager() {
  local raw="$1"
  if [[ -z "${raw}" ]]; then
    printf '%s' "${CANONICAL_LOTTERY_MANAGER}"
    return
  fi
  if echo "${raw}" | grep -Eiq "${DEPRECATED_LOTTERY_MANAGERS}"; then
    echo "note: overriding deprecated LOTTERY_MANAGER ${raw} -> ${CANONICAL_LOTTERY_MANAGER}" >&2
    printf '%s' "${CANONICAL_LOTTERY_MANAGER}"
    return
  fi
  printf '%s' "${raw}"
}

BASE_RPC_URL="$(require_from_source BASE_RPC_URL)"
SOLANA_RPC_URL="$(require_from_source SOLANA_RPC_URL)"
SOLANA_PROGRAM_ID="$(require_from_source SOLANA_PROGRAM_ID)"
SOLANA_KEEPER_KEYPAIR="$(require_from_source SOLANA_KEEPER_KEYPAIR)"
SOLANA_KEEPER_PUBKEY="$(require_from_source SOLANA_KEEPER_PUBKEY)"
SOLANA_CREATOR_MINTS="$(require_from_source SOLANA_CREATOR_MINTS)"
KPR_PRIVATE_KEY="$(optional_from_source KPR_PRIVATE_KEY)"

SOLANA_BRIDGE_ADAPTER="$(normalize_solana_bridge_adapter "$(optional_from_source SOLANA_BRIDGE_ADAPTER)")"

LOTTERY_MANAGER="$(normalize_lottery_manager "$(optional_from_source LOTTERY_MANAGER)")"

SHARE_MAP="$(quote_json_if_needed "$(optional_from_source SOLANA_SHARE_OFT_MAPPING)")"
CREATOR_MAP="$(quote_json_if_needed "$(optional_from_source SOLANA_CREATOR_COIN_TO_MINT_MAPPING)")"
TWIN_MAP="$(quote_json_if_needed "$(optional_from_source SOLANA_TWIN_TO_PUBKEY_MAPPING)")"

ALERT_WEBHOOK_URL="$(optional_from_source ALERT_WEBHOOK_URL)"

HOOK_PROGRAM_ID="EjpziSWGRcEiDHLXft5etbUtcJiZxEttkwz1tqiuzzWU"

classify_hook_schema() {
  if ! command -v solana >/dev/null 2>&1 || ! command -v strings >/dev/null 2>&1; then
    echo "legacy"
    return
  fi
  local rpc="${SOLANA_RPC_URL:-https://api.mainnet-beta.solana.com}"
  local tmp
  tmp="$(mktemp -d)"
  if ! solana program dump "${HOOK_PROGRAM_ID}" "${tmp}/hook.so" --url "${rpc}" >/dev/null 2>&1; then
    rm -rf "${tmp}"
    echo "legacy"
    return
  fi
  if strings "${tmp}/hook.so" | rg -q 'relay_entries|RelayEntries' && ! strings "${tmp}/hook.so" | rg -q 'drain_entries|DrainEntries'; then
    rm -rf "${tmp}"
    echo "canonical"
    return
  fi
  rm -rf "${tmp}"
  echo "legacy"
}

RESOLVED_HOOK_SCHEMA="${HOOK_SCHEMA}"
if [[ "${RESOLVED_HOOK_SCHEMA}" == "auto" ]]; then
  RESOLVED_HOOK_SCHEMA="$(classify_hook_schema)"
  echo "note: auto-detected SOLANA_HOOK_IX_SCHEMA=${RESOLVED_HOOK_SCHEMA} from mainnet bytecode" >&2
fi

tmp="$(mktemp)"
chmod 0640 "${tmp}"

cat >"${tmp}" <<EOF
# Generated by kpr/deploy/seed-solana-orchestrator-env.sh — orchestrator-only (no CRE_* / Privy)
# Source: ${SOURCE}
# $(date -u +"%Y-%m-%dT%H:%M:%SZ")

SOLANA_ORCHESTRATOR_PORT=8789
SOLANA_ORCHESTRATOR_API_KEY=${api_key}
SOLANA_ORCHESTRATOR_EXECUTE=1
SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED=0
SOLANA_ORCHESTRATOR_SETTLE_FEES_ENABLED=1
SOLANA_ORCHESTRATOR_WINNER_RELAY_ENABLED=1
SOLANA_HOOK_IX_SCHEMA=${RESOLVED_HOOK_SCHEMA}

BASE_RPC_URL=${BASE_RPC_URL}
SOLANA_RPC_URL=${SOLANA_RPC_URL}

SOLANA_PROGRAM_ID=${SOLANA_PROGRAM_ID}
SOLANA_KEEPER_KEYPAIR=${SOLANA_KEEPER_KEYPAIR}
SOLANA_KEEPER_PUBKEY=${SOLANA_KEEPER_PUBKEY}

SOLANA_CREATOR_MINTS=${SOLANA_CREATOR_MINTS}
SOLANA_SHARE_OFT_MAPPING=${SHARE_MAP}
SOLANA_CREATOR_COIN_TO_MINT_MAPPING=${CREATOR_MAP}
SOLANA_TWIN_TO_PUBKEY_MAPPING=${TWIN_MAP}

SOLANA_BRIDGE_ADAPTER=${SOLANA_BRIDGE_ADAPTER}
LOTTERY_MANAGER=${LOTTERY_MANAGER}
EOF

if [[ -n "${KPR_PRIVATE_KEY}" ]]; then
  echo "KPR_PRIVATE_KEY=${KPR_PRIVATE_KEY}" >>"${tmp}"
fi

if [[ -n "${ALERT_WEBHOOK_URL}" ]]; then
  echo "ALERT_WEBHOOK_URL=${ALERT_WEBHOOK_URL}" >>"${tmp}"
fi

if [[ "${DRY_RUN}" == "1" ]]; then
  cat "${tmp}"
  rm -f "${tmp}"
  exit 0
fi

install -d -m 0755 "$(dirname "${DEST}")"
if [[ -f "${DEST}" ]]; then
  cp "${DEST}" "${DEST}.bak.$(date +%Y%m%d%H%M%S)"
fi
install -m 0640 "${tmp}" "${DEST}"
rm -f "${tmp}"

echo "Wrote ${DEST}"
echo "Next:"
echo "  pnpm -C frontend ops:post-hook-upgrade-preflight"
echo "  cd /opt/4626/kpr && pnpm preflight-orchestrator"
echo "  sudo systemctl restart solana-keeper-orchestrator"
