#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

STEP=0

green() { printf "\033[32m%s\033[0m\n" "$*"; }
yellow() { printf "\033[33m%s\033[0m\n" "$*"; }
red() { printf "\033[31m%s\033[0m\n" "$*"; }
blue() { printf "\033[36m%s\033[0m\n" "$*"; }

header() {
  STEP=$((STEP + 1))
  echo
  blue "========== Step ${STEP}: $* =========="
}

run_cmd() {
  local label="$1"
  shift
  echo "-> ${label}"
  "$@"
  green "PASS: ${label}"
}

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    red "FAIL: missing required env var: ${name}"
    exit 1
  fi
  green "PASS: ${name} is set"
}

is_truthy() {
  local raw="${1:-}"
  local normalized=""
  normalized="$(printf '%s' "$raw" | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]')"
  normalized="${normalized//\"/}"
  [[ "$normalized" == "true" || "$normalized" == "1" || "$normalized" == "yes" ]]
}

ask_yes_no() {
  local prompt="$1"
  local reply=""
  while true; do
    read -r -p "${prompt} [y/n]: " reply
    case "${reply}" in
      y|Y|yes|YES) return 0 ;;
      n|N|no|NO) return 1 ;;
      *) echo "Please answer y or n." ;;
    esac
  done
}

read_or_fail() {
  local prompt="$1"
  local var_name="$2"
  local value=""
  read -r -p "${prompt}: " value
  if [[ -z "${value}" ]]; then
    red "FAIL: value is required"
    exit 1
  fi
  printf -v "${var_name}" "%s" "${value}"
}

validate_status_progression() {
  local status_json="$1"
  local has_phase3 has_phase4 has_completed has_last_error

  if command -v jq >/dev/null 2>&1; then
    has_phase3="$(printf '%s' "$status_json" | jq -e 'tostring | test("phase3_sent")' >/dev/null && echo "1" || echo "0")"
    has_phase4="$(printf '%s' "$status_json" | jq -e 'tostring | test("phase4_sent")' >/dev/null && echo "1" || echo "0")"
    has_completed="$(printf '%s' "$status_json" | jq -e 'tostring | test("completed")' >/dev/null && echo "1" || echo "0")"
    has_last_error="$(printf '%s' "$status_json" | jq -e 'tostring | test("phase4 image gate failed|solana preflight error"; "i")' >/dev/null && echo "1" || echo "0")"
  else
    has_phase3="$(printf '%s' "$status_json" | rg "phase3_sent" >/dev/null && echo "1" || echo "0")"
    has_phase4="$(printf '%s' "$status_json" | rg "phase4_sent" >/dev/null && echo "1" || echo "0")"
    has_completed="$(printf '%s' "$status_json" | rg "completed" >/dev/null && echo "1" || echo "0")"
    has_last_error="$(printf '%s' "$status_json" | rg -i "phase4 image gate failed|solana preflight error" >/dev/null && echo "1" || echo "0")"
  fi

  if [[ "$has_phase3" != "1" || "$has_phase4" != "1" || "$has_completed" != "1" ]]; then
    red "FAIL: deploy-session status did not show required progression: phase3_sent -> phase4_sent -> completed"
    exit 1
  fi

  if [[ "$has_last_error" == "1" ]]; then
    red "FAIL: deploy-session status indicates image-gate or Solana preflight errors"
    exit 1
  fi

  green "PASS: deploy-session status progression is valid and no critical image/Solana errors were detected"
}

header "Freeze and Branch Sanity (Owner: Release operator)"
run_cmd "current branch visible" git rev-parse --abbrev-ref HEAD
run_cmd "working tree status" git status --short

if [[ -n "$(git status --porcelain)" ]]; then
  if [[ "${ALLOW_DIRTY_WORKTREE:-false}" == "true" ]]; then
    yellow "INFO: dirty working tree detected; skipping 'git pull --ff-only' because ALLOW_DIRTY_WORKTREE=true."
    yellow "INFO: use a clean tree for strict release hygiene."
  else
    red "FAIL: working tree has uncommitted changes; cannot safely run 'git pull --ff-only'."
    echo "Resolution options:"
    echo "  1) Commit your changes, then rerun:"
    echo "     git add -A && git commit -m \"...\""
    echo "  2) Stash your changes, then rerun:"
    echo "     git stash push -u"
    echo "  3) If you intentionally want to continue without pulling, rerun with:"
    echo "     ALLOW_DIRTY_WORKTREE=true ./scripts/launch.sh"
    exit 1
  fi
else
  run_cmd "pull latest via fast-forward only" git pull --ff-only
fi

if [[ -n "${EXPECTED_BRANCH:-}" ]]; then
  CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
  if [[ "$CURRENT_BRANCH" != "$EXPECTED_BRANCH" ]]; then
    red "FAIL: on branch '$CURRENT_BRANCH', expected '$EXPECTED_BRANCH'"
    exit 1
  fi
  green "PASS: expected branch '$EXPECTED_BRANCH' confirmed"
else
  yellow "INFO: EXPECTED_BRANCH not set; branch name check skipped."
fi

header "Required Environment Verification (Owner: Platform/Ops)"
echo "Pass criteria: all required vars set in current environment."

# Frontend required
require_env "VITE_DEPLOY_USE_SERVER_CONTINUE"
require_env "VITE_CDP_PAYMASTER_URL"

if ! is_truthy "${VITE_DEPLOY_USE_SERVER_CONTINUE}"; then
  red "FAIL: VITE_DEPLOY_USE_SERVER_CONTINUE must be truthy for canonical launch (accepted: true/1/yes)"
  exit 1
fi
green "PASS: VITE_DEPLOY_USE_SERVER_CONTINUE is truthy"

if [[ "${VITE_CDP_PAYMASTER_URL}" != "/api/paymaster" ]]; then
  red "FAIL: VITE_CDP_PAYMASTER_URL must be '/api/paymaster' for canonical launch"
  exit 1
fi
green "PASS: VITE_CDP_PAYMASTER_URL=/api/paymaster"

# Server required
require_env "CDP_PAYMASTER_URL"
require_env "AUTH_SESSION_SECRET"
require_env "CANONICAL_ORIGIN"
require_env "DATABASE_URL"
require_env "DEPLOY_SESSION_TOKEN_HMAC_SECRET"
require_env "PRIVY_APP_ID"
require_env "PRIVY_APP_SECRET"
require_env "PRIVY_WALLET_AUTHORIZATION_KEY"
require_env "PRIVY_WALLET_OWNER_ID"

SOLANA_ENABLED="${SOLANA_STRATEGY_ENABLED:-}"
if [[ -z "$SOLANA_ENABLED" ]]; then
  if ask_yes_no "Is Solana strategy enabled for this launch?"; then
    SOLANA_ENABLED="true"
  else
    SOLANA_ENABLED="false"
  fi
fi

if [[ "$SOLANA_ENABLED" == "true" ]]; then
  require_env "DEPLOY_SOLANA_REGISTRATION_SECRET"
  if [[ -z "${APP_ORIGIN:-}" && -z "${DEPLOY_SOLANA_REGISTRATION_ORIGINS:-}" ]]; then
    red "FAIL: set APP_ORIGIN or DEPLOY_SOLANA_REGISTRATION_ORIGINS when Solana strategy is enabled"
    exit 1
  fi
  green "PASS: Solana registration env requirements satisfied"
else
  yellow "INFO: Solana strategy disabled for this launch; Solana env checks skipped."
fi

header "Frontend Release Gates (Owner: Frontend)"
echo "Pass criteria: lint/typecheck/launch-critical tests/build all succeed."
run_cmd "install frontend dependencies (frozen lockfile)" pnpm -C frontend install --frozen-lockfile
run_cmd "frontend lint" pnpm -C frontend lint
run_cmd "frontend typecheck" pnpm -C frontend typecheck
run_cmd "frontend generate html shells" pnpm -C frontend generate:html-shells
run_cmd "frontend launch-critical tests (clean env)" env -i \
  PATH="$PATH" \
  HOME="$HOME" \
  SHELL="${SHELL:-/bin/bash}" \
  TERM="${TERM:-xterm-256color}" \
  PNPM_HOME="${PNPM_HOME:-}" \
  CI="${CI:-}" \
  pnpm -C frontend exec vitest run \
  api/__tests__/deploySession.test.ts \
  api/__tests__/deploySessionOwnership.test.ts \
  api/__tests__/deployRegisterSolanaBridgeToken.test.ts \
  api/__tests__/deploySolanaInfraStatus.test.ts \
  api/__tests__/seoRoutes.test.ts \
  src/lib/htmlShellsGenerated.guard.test.ts \
  server/_lib/wallet/userOperationSubmitter.test.ts \
  api/__tests__/rpcProxy.test.ts
run_cmd "frontend build" pnpm -C frontend build

header "Protocol/Contract Readiness Gates (Owner: Contracts)"
echo "Pass criteria: release target guard and focused contract tests succeed."
run_cmd "current release target guard" bash test/current-release-target-guard.sh
run_cmd "registry default scripts test" forge test --match-contract RegistryDefaultScriptsTest
run_cmd "seed creator registry config test" forge test --match-contract SeedCreatorRegistryConfigTest

if ask_yes_no "Run full forge test suite now (recommended for max confidence)?"; then
  run_cmd "full forge test suite" forge test
else
  yellow "INFO: full forge test suite skipped by operator."
fi

header "Canonical Deploy Path Smoke (Owner: Product engineer)"
echo "Pass criteria: deploy session shows phase3_sent -> phase4_sent -> completed with no critical errors."
read_or_fail "Enter APP_ORIGIN (example: https://app.4626.fun)" APP_ORIGIN
read_or_fail "Enter deploy SESSION_ID created via frontend /deploy flow" SESSION_ID

STATUS_PAYLOAD="$(printf '{"sessionId":"%s"}' "$SESSION_ID")"
STATUS_JSON="$(curl -sS -X POST "${APP_ORIGIN}/api/deploy/session/status" \
  -H "content-type: application/json" \
  --data "$STATUS_PAYLOAD")"

echo "Deploy session status response:"
printf '%s\n' "$STATUS_JSON"
validate_status_progression "$STATUS_JSON"

header "Image + Auction Readiness (Owner: Backend/Frontend)"
echo "Pass criteria: Share image endpoint returns non-empty bytes and auction status includes image fields."
read_or_fail "Enter SHARE_OFT address" SHARE_OFT
read_or_fail "Enter CCA strategy address" CCA_STRATEGY

IMAGE_BYTES="$(curl -sS -L "${APP_ORIGIN}/api/v1/token/${SHARE_OFT}/image?chain=8453&format=png" | wc -c | tr -d ' ')"
if [[ "$IMAGE_BYTES" -eq 0 ]]; then
  red "FAIL: ShareOFT image endpoint returned empty payload"
  exit 1
fi
green "PASS: ShareOFT image endpoint returned ${IMAGE_BYTES} bytes"

AUCTION_JSON="$(curl -sS "${APP_ORIGIN}/api/v1/auction/status?ccaStrategy=${CCA_STRATEGY}")"
echo "Auction status response:"
printf '%s\n' "$AUCTION_JSON"

if command -v jq >/dev/null 2>&1; then
  HAS_IMAGE_PATH="$(printf '%s' "$AUCTION_JSON" | jq -e 'tostring | test("auctionTokenImagePath")' >/dev/null && echo "1" || echo "0")"
  HAS_IMAGE_URL="$(printf '%s' "$AUCTION_JSON" | jq -e 'tostring | test("auctionTokenImageUrl")' >/dev/null && echo "1" || echo "0")"
else
  HAS_IMAGE_PATH="$(printf '%s' "$AUCTION_JSON" | rg "auctionTokenImagePath" >/dev/null && echo "1" || echo "0")"
  HAS_IMAGE_URL="$(printf '%s' "$AUCTION_JSON" | rg "auctionTokenImageUrl" >/dev/null && echo "1" || echo "0")"
fi

if [[ "$HAS_IMAGE_PATH" != "1" || "$HAS_IMAGE_URL" != "1" ]]; then
  red "FAIL: auction status missing auctionTokenImagePath or auctionTokenImageUrl"
  exit 1
fi
green "PASS: auction status includes image path and URL fields"

header "Onchain Wiring Spot Checks (Owner: Onchain operator)"
echo "Expected launch config:"
echo "  - Charm strategy weight: 3000 bps"
echo "  - Ajna strategy weight: 3000 bps"
echo "  - Solana strategy weight: 3000 bps"
echo "  - Idle reserve: 1000 bps"
if ask_yes_no "Did onchain spot checks confirm expected strategy weights and idle reserve?"; then
  green "PASS: onchain wiring confirmed by operator"
else
  red "FAIL: onchain strategy/idle checks not confirmed"
  exit 1
fi

header "Security/Trust Surface Preflight (Owner: PM/Marketing/Web)"
echo "Pass criteria: trust pages are live and risky claims removed/replaced."
if ask_yes_no "Are /risks, /security, /terms, /privacy, and /about all live and linked?"; then
  green "PASS: trust pages confirmed live"
else
  red "FAIL: required trust pages not confirmed"
  exit 1
fi

if ask_yes_no "Have APY/profit-guarantee style claims and misleading demo tile copy been removed/replaced?"; then
  green "PASS: marketing risk copy updates confirmed"
else
  red "FAIL: risky marketing copy still present"
  exit 1
fi

header "Go/No-Go (Owner: Launch lead)"
if ask_yes_no "All previous steps passed. Execute GO decision?"; then
  green "GO: launch checklist passed. Open traffic and monitor deploy-session status/errors."
  exit 0
else
  red "NO-GO: operator declined final launch decision."
  exit 1
fi
