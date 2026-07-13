#!/usr/bin/env bash
set -euo pipefail

# Validate that a greenfield handoff env contains all keys needed for cutover.
#
# Usage:
#   ./script/validate-greenfield-handoff.sh tmp/base-v1.18.0-handoff.env

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

HANDOFF="${1:-}"
if [[ -z "$HANDOFF" ]]; then
  echo "Usage: ./script/validate-greenfield-handoff.sh <handoff-env-path>" >&2
  exit 1
fi

if [[ ! -f "$HANDOFF" ]]; then
  echo "Error: handoff env not found: $HANDOFF" >&2
  exit 1
fi

required_keys=(
  DEPLOYMENT_EPOCH_TAG
  REGISTRY
  OVAULT_FACTORY
  LOTTERY_MANAGER
  VRF_CONSUMER
  VAULT_ACTIVATION_BATCHER
  SOLANA_DESTINATION
  OVAULT_HUB_COMPOSER
  OVAULT_SOLANA_EID
  UNIVERSAL_BYTECODE_STORE
  UNIVERSAL_CREATE2_DEPLOYER
  DEPLOYMENT_BATCHER
  DEPLOYMENT_BATCHER_AUTO_HANDOFF
  DEPLOYMENT_BATCHER_PHASE1_MODULE
  DEPLOYMENT_BATCHER_PHASE2_MODULE
  DEPLOYMENT_BATCHER_PHASE3_HELPER
  DEPLOYMENT_BATCHER_SHARE_MESH_HELPER
  DEPLOYMENT_BATCHER_UTILS_HELPER
  OVAULT_CORE_MODULE
  OVAULT_STRATEGIES_MODULE
  OVAULT_ADMIN_MODULE
)

missing=()
for key in "${required_keys[@]}"; do
  value="$(grep -E "^${key}=" "$HANDOFF" | tail -1 | cut -d= -f2- || true)"
  if [[ -z "$value" ]]; then
    missing+=("$key")
  fi
done

if ((${#missing[@]} > 0)); then
  echo "Handoff validation failed: missing keys in ${HANDOFF}" >&2
  for key in "${missing[@]}"; do
    echo "  - ${key}" >&2
  done
  exit 1
fi

epoch="$(grep -E '^DEPLOYMENT_EPOCH_TAG=' "$HANDOFF" | tail -1 | cut -d= -f2-)"
manifest="${ROOT_DIR}/deployments/base/${epoch}-bytecode-manifest.json"
if [[ ! -f "$manifest" ]]; then
  echo "Warning: bytecode manifest not found yet: ${manifest}" >&2
  echo "Run: ./script/generate_bytecode_manifest.sh ${epoch}" >&2
else
  echo "Bytecode manifest present: ${manifest}"
fi

if ! grep -q '^WIRE_BATCHER_HELPERS_BATCHER=' "$HANDOFF"; then
  echo "Note: WIRE_BATCHER_HELPERS_BATCHER not set — treasury Safe must wire helpers before vault deploys."
fi

echo "Handoff validation passed (${#required_keys[@]} required keys present)."
