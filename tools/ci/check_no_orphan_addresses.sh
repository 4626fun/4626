#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ORPHAN_REGISTRY="docs/operations/deployment/orphan-registry.md"

readonly ORPHAN_ADDRS=(
  "0xd593A8A58BDf7E7448D2dAbDE0Ae3B2BAFDA1357"
  "0x3F7AfD93824Ab25F73Bdca59aFDaB560F865b0C3"
  "0xC618Dde25F0085F3b2BC3a48ba806F8Fc9a93759"
  "0xA39A71a388816d657300EFffF1857F938AEF65D1"
  "0xd588f54Ea9e8c40701B419Cf6b8de7aE8d1fB22F"
  "0xd9bDFf55A886bADb011A12c447D72D174fD15964"
)

readonly WHITELIST=(
  "docs/operations/deployment/releases/v1.10.1-mainnet.md"
  "docs/operations/deployment/releases/v1.8.3-mainnet.md"
  "docs/operations/deployment/amoe-deploy-evidence-2026-05-01.md"
  "docs/operations/deployment/orphan-registry.md"
  "tools/ci/check_manager_amoe_surface.sh"
  "tools/ci/check_no_orphan_addresses.sh"
  "docs/operations/deployment/v1.10.1/pre-broadcast-cleanup.md"
  # Added during §6 guard expansion — paths that legitimately reference orphan addresses:
  "deployments/base/contracts/services/lottery/CreatorLotteryManager.json"
  "deployments/base/v1.8.1-vanity-manifest.json"
  "docs/operations/contract-size-gate.md"
  "docs/operations/deployment/releases/v1.10.1-pre-broadcast-checklist.md"
  "docs/operations/deployment/releases/v1.10.1-supabase-update-plan.md"
  "docs/operations/deployment/releases/v1.10.1-vercel-env-plan.md"
  "docs/operations/deployment/releases/v1.7.1-mainnet.md"
  "docs/operations/deployment/releases/v1.8.1-mainnet.md"
  "docs/operations/deployment/releases/v1.8.1-pre-broadcast-checklist.md"
  "docs/operations/deployment/v1.10.1/deployment-instructions.md"
  "docs/operations/deployment/v1.10.1/post-broadcast-orphan-finalization.md"
  "test/v183-release-target-guard.sh"
)

is_whitelisted_file() {
  local file="$1"
  local allowed

  for allowed in "${WHITELIST[@]}"; do
    if [[ "$file" == "$allowed" ]]; then
      return 0
    fi
  done

  [[ "$(basename "$file")" == "cursor-deploy-prompt-v1.10.1.md" ]]
}

matched_address_for_line() {
  local line="$1"
  local addr

  for addr in "${ORPHAN_ADDRS[@]}"; do
    if [[ "${line,,}" == *"${addr,,}"* ]]; then
      printf '%s\n' "$addr"
      return 0
    fi
  done

  printf '%s\n' "<unknown-orphan-address>"
}

main() {
  cd "$ROOT_DIR"

  local pattern
  pattern="$(IFS='|'; echo "${ORPHAN_ADDRS[*]}")"

  local failures=0
  local hit
  local file
  local line_no
  local content
  local addr

  while IFS= read -r hit; do
    file="${hit%%:*}"
    line_no="${hit#*:}"
    line_no="${line_no%%:*}"
    content="${hit#*:*:}"
    addr="$(matched_address_for_line "$content")"

    if is_whitelisted_file "$file"; then
      echo "[WHITELISTED] $addr $file:$line_no"
    else
      echo "orphan address outside whitelist: $addr $file:$line_no" >&2
      echo "hint: move intentional references to $ORPHAN_REGISTRY or remove stale wiring." >&2
      failures=1
    fi
  done < <(git grep -i -n -E "$pattern" -- ':!lib/liquidity-launcher' || true)

  if [[ "$failures" -ne 0 ]]; then
    exit 1
  fi

  echo "orphan address guard passed"
}

main "$@"
