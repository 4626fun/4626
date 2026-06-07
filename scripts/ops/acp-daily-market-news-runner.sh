#!/usr/bin/env bash
set -euo pipefail

##
# ACP daily market news runner (assistive-only).
#
# Primary: Otto AI mega_report
# Fallback: Laznek ai market_pulse
#
# Usage:
#   scripts/ops/acp-daily-market-news-runner.sh --slot morning
#   scripts/ops/acp-daily-market-news-runner.sh --slot checkpoint
#   scripts/ops/acp-daily-market-news-runner.sh --slot morning --dry-run
#
# Required env (GitHub Actions/headless mode):
#   ACP_ACCESS_TOKEN
#   ACP_REFRESH_TOKEN
#   ACP_OWNER_WALLET
#   ACP_CLIENT_AGENT_ID
#
# Local mode:
# - If ACP_* token envs are omitted, runner uses existing local `acp configure` session.
# - If ACP_CLIENT_AGENT_ID is omitted, runner uses the currently active ACP agent.
#
# Optional env:
#   ACP_CHAIN_ID (default: 8453)
#   OTTO_PROVIDER (default: 0x7457b799121c9b8c51298d08f1c19f0186648c90)
#   OTTO_OFFERING (default: mega_report)
#   OTTO_REQUIREMENTS_JSON (default: {"generate_mega_report":true})
#   OTTO_FUND_AMOUNT (default: 0.25)
#   PULSE_PROVIDER (default: 0xec3a443b26f77f235df969767bbcbce57ddca910)
#   PULSE_OFFERING (default: market_pulse)
#   PULSE_REQUIREMENTS_JSON (default: {})
#   PULSE_FUND_AMOUNT (default: 0; market_pulse commonly does not require funds)
#   FUND_CHECK_TIMEOUT_SECONDS (default: 180)
#   FUND_CHECK_INTERVAL_SECONDS (default: 15)
#
# Notes:
# - This script performs client-side job create + fund only. It does not auto-complete jobs.
# - If Otto create/fund fails during morning slot, Pulse fallback runs automatically.
# - Exits non-zero on hard failure; emits concise logs for CI.
##

SLOT="morning"
DRY_RUN="0"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --slot)
      SLOT="${2:-}"
      shift 2
      ;;
    --dry-run)
      DRY_RUN="1"
      shift
      ;;
    --help|-h)
      sed -n '1,120p' "$0"
      exit 0
      ;;
    *)
      echo "[acp-daily] unknown arg: $1" >&2
      exit 2
      ;;
  esac
done

if [[ "$SLOT" != "morning" && "$SLOT" != "checkpoint" ]]; then
  echo "[acp-daily] invalid --slot '$SLOT' (expected morning|checkpoint)" >&2
  exit 2
fi

require_env() {
  local key="$1"
  if [[ -z "${!key:-}" ]]; then
    echo "[acp-daily] missing required env: $key" >&2
    exit 2
  fi
}

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "[acp-daily] required command not found: $cmd" >&2
    exit 2
  fi
}

json_field() {
  local json="$1"
  local key="$2"
  printf '%s' "$json" | jq -r "$key"
}

require_cmd acp
require_cmd jq

ACP_CHAIN_ID="${ACP_CHAIN_ID:-8453}"
OTTO_PROVIDER="${OTTO_PROVIDER:-0x7457b799121c9b8c51298d08f1c19f0186648c90}"
OTTO_OFFERING="${OTTO_OFFERING:-mega_report}"
OTTO_REQUIREMENTS_JSON="${OTTO_REQUIREMENTS_JSON:-{\"generate_mega_report\":true}}"
OTTO_FUND_AMOUNT="${OTTO_FUND_AMOUNT:-0.25}"

PULSE_PROVIDER="${PULSE_PROVIDER:-0xec3a443b26f77f235df969767bbcbce57ddca910}"
PULSE_OFFERING="${PULSE_OFFERING:-market_pulse}"
PULSE_REQUIREMENTS_JSON="${PULSE_REQUIREMENTS_JSON:-{}}"
PULSE_FUND_AMOUNT="${PULSE_FUND_AMOUNT:-0}"

FUND_CHECK_TIMEOUT_SECONDS="${FUND_CHECK_TIMEOUT_SECONDS:-180}"
FUND_CHECK_INTERVAL_SECONDS="${FUND_CHECK_INTERVAL_SECONDS:-15}"

log() {
  echo "[acp-daily][$SLOT] $*" >&2
}

run_cmd() {
  if [[ "$DRY_RUN" == "1" ]]; then
    log "dry-run: $*"
    return 0
  fi
  "$@"
}

configure_acp() {
  if [[ -z "${ACP_ACCESS_TOKEN:-}" || -z "${ACP_REFRESH_TOKEN:-}" || -z "${ACP_OWNER_WALLET:-}" ]]; then
    log "using existing local ACP session (ACP_ACCESS_TOKEN/ACP_REFRESH_TOKEN/ACP_OWNER_WALLET not set)"
    return 0
  fi
  log "configuring ACP session"
  run_cmd acp configure \
    --token "$ACP_ACCESS_TOKEN" \
    --refresh-token "$ACP_REFRESH_TOKEN" \
    --wallet "$ACP_OWNER_WALLET" >/tmp/acp_configure_out.json
}

activate_client_agent() {
  if [[ -z "${ACP_CLIENT_AGENT_ID:-}" ]]; then
    log "using currently active ACP agent (ACP_CLIENT_AGENT_ID not set)"
    return 0
  fi
  log "activating client agent $ACP_CLIENT_AGENT_ID"
  run_cmd acp agent use --agent-id "$ACP_CLIENT_AGENT_ID" --json >/tmp/acp_agent_use_out.json
}

wait_for_fundable_balance() {
  local start now elapsed
  start="$(date +%s)"
  while true; do
    if [[ "$DRY_RUN" == "1" ]]; then
      log "dry-run: skipping fundable balance probe"
      return 0
    fi
    local balance_out
    if ! balance_out="$(acp wallet balance --chain-id "$ACP_CHAIN_ID" --json 2>/tmp/acp_wallet_balance_err.log)"; then
      log "wallet balance probe failed (continuing): $(tr '\n' ' ' </tmp/acp_wallet_balance_err.log)"
    else
      # The ACP balance endpoint does not always expose USDC directly.
      # We use it as a liveness check and allow the fund tx call to be the
      # true gate for spendable ERC20 balance.
      local addr
      addr="$(json_field "$balance_out" '.address // ""')"
      log "wallet balance probe ok for $addr"
      return 0
    fi

    now="$(date +%s)"
    elapsed="$(( now - start ))"
    if (( elapsed >= FUND_CHECK_TIMEOUT_SECONDS )); then
      log "timed out waiting for wallet balance endpoint"
      return 1
    fi
    sleep "$FUND_CHECK_INTERVAL_SECONDS"
  done
}

create_job() {
  local provider="$1"
  local offering="$2"
  local requirements="$3"

  if [[ "$DRY_RUN" == "1" ]]; then
    log "dry-run create-job provider=$provider offering=$offering requirements=$requirements"
    printf '%s\n' "dry-run-job-id"
    return 0
  fi

  local out job_id
  out="$(acp client create-job \
    --provider "$provider" \
    --offering-name "$offering" \
    --requirements "$requirements" \
    --chain-id "$ACP_CHAIN_ID" \
    --json)"
  job_id="$(json_field "$out" '.jobId // ""')"
  if [[ -z "$job_id" || "$job_id" == "null" ]]; then
    log "create-job failed output: $out"
    return 1
  fi
  log "created job $job_id for offering=$offering"
  printf '%s\n' "$job_id"
}

fund_job() {
  local job_id="$1"
  local amount="$2"

  if [[ "$amount" == "0" || "$amount" == "0.0" || "$amount" == "0.00" ]]; then
    log "skipping fund for job=$job_id (amount=$amount)"
    return 0
  fi

  if [[ "$DRY_RUN" == "1" ]]; then
    log "dry-run fund job=$job_id amount=$amount"
    return 0
  fi

  local out
  if ! out="$(acp client fund --job-id "$job_id" --amount "$amount" --chain-id "$ACP_CHAIN_ID" --json 2>/tmp/acp_fund_err.log)"; then
    # ACP can occasionally return a transport error even when budget.set lands.
    # Verify on-chain history before treating this as a hard failure.
    local hist
    if hist="$(acp job history --job-id "$job_id" --chain-id "$ACP_CHAIN_ID" --json 2>/tmp/acp_fund_history_err.log)" \
      && printf '%s' "$hist" | jq -e '(.status == "budget_set") or (.entries[]?.event?.type == "budget.set")' >/dev/null; then
      log "fund command returned error but budget.set is present for job=$job_id; continuing"
      return 0
    fi
    log "fund failed for job=$job_id amount=$amount error=$(tr '\n' ' ' </tmp/acp_fund_err.log)"
    return 1
  fi
  log "funded job=$job_id amount=$amount"
  log "fund response: $out"
}

run_primary_otto() {
  local job_id
  job_id="$(create_job "$OTTO_PROVIDER" "$OTTO_OFFERING" "$OTTO_REQUIREMENTS_JSON")"
  fund_job "$job_id" "$OTTO_FUND_AMOUNT"
}

run_fallback_pulse() {
  local job_id
  job_id="$(create_job "$PULSE_PROVIDER" "$PULSE_OFFERING" "$PULSE_REQUIREMENTS_JSON")"
  fund_job "$job_id" "$PULSE_FUND_AMOUNT"
}

main() {
  configure_acp
  activate_client_agent
  wait_for_fundable_balance

  if [[ "$SLOT" == "morning" ]]; then
    if run_primary_otto; then
      log "morning primary completed (Otto job created and budget step handled)"
      return 0
    fi
    log "morning primary failed, attempting Pulse fallback"
    if run_fallback_pulse; then
      log "fallback completed (Pulse job created and budget step handled)"
      return 0
    fi
    log "fallback failed"
    return 1
  fi

  # checkpoint slot
  run_fallback_pulse
  log "checkpoint completed (Pulse job created and budget step handled)"
}

main "$@"
