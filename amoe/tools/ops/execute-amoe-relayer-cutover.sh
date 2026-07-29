#!/usr/bin/env bash
# Execute the queued LotteryManager4626 AMOE relayer cutover to the multi-entry
# LotteryAmoeRouter, then print the env flip checklist.
#
# Prerequisites:
#   - queueAmoeRelayerChange already landed (pending = NEW_ROUTER)
#   - block.timestamp >= pendingAmoeRelayerEffectiveAt (2-day timelock)
#   - PRIVATE_KEY is manager owner
#   - BASE_RPC_URL set
#
# Usage:
#   amoe/tools/ops/execute-amoe-relayer-cutover.sh
#   amoe/tools/ops/execute-amoe-relayer-cutover.sh --dry-run

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT"

if [[ -f .env ]]; then set -a; # shellcheck disable=SC1091
  source .env; set +a; fi
if [[ -f frontend/.env ]]; then set -a; # shellcheck disable=SC1091
  source frontend/.env; set +a; fi

export PATH="${HOME}/.foundry/bin:${PATH}"

MGR="${LOTTERY_MANAGER:-0x0fC6f30adFD9e82097895Bb166536FdFD8EaC97b}"
NEW_ROUTER="${AMOE_CUTOVER_ROUTER:-0x44d070C95Da7228BDf316E3DCB81e89FD1D6e338}"
NEW_VERIFIER="${AMOE_CUTOVER_VERIFIER:-0xcEA9e27cC9baF88Cb50777B5cD23fbE8BF53c229}"
RPC="${BASE_RPC_URL:?BASE_RPC_URL required}"
PK="${PRIVATE_KEY:?PRIVATE_KEY required}"
DRY_RUN=0
if [[ "${1:-}" == "--dry-run" ]]; then DRY_RUN=1; fi

now="$(date +%s)"
eff="$(cast call "$MGR" "pendingAmoeRelayerEffectiveAt()(uint256)" --rpc-url "$RPC" | awk '{print $1}')"
pending="$(cast call "$MGR" "pendingAmoeRelayer()(address)" --rpc-url "$RPC")"
current="$(cast call "$MGR" "authorizedAmoeRelayer()(address)" --rpc-url "$RPC")"

echo "manager=$MGR"
echo "current_relayer=$current"
echo "pending_relayer=$pending"
echo "effective_at=$eff"
echo "now=$now"

if [[ "${pending,,}" != "${NEW_ROUTER,,}" ]]; then
  if [[ "${current,,}" == "${NEW_ROUTER,,}" ]]; then
    echo "already cut over — authorizedAmoeRelayer is NEW_ROUTER"
    exit 0
  fi
  echo "ERROR: pending relayer is not NEW_ROUTER ($NEW_ROUTER)" >&2
  exit 1
fi

if [[ "$eff" == "0" ]]; then
  echo "ERROR: no pending AMOE relayer change queued" >&2
  exit 1
fi

if (( now < eff )); then
  remain=$((eff - now))
  echo "ERROR: timelock not expired (${remain}s / $(awk -v s="$remain" 'BEGIN{printf "%.2f", s/3600}')h remaining)" >&2
  exit 2
fi

# Preflight new router wiring
for getter in manager verifier pointsLedgerPublisher allowlistPublisher; do
  val="$(cast call "$NEW_ROUTER" "${getter}()(address)" --rpc-url "$RPC")"
  echo "new_router.${getter}=$val"
done

if [[ "$DRY_RUN" == "1" ]]; then
  echo "dry-run: would executeAmoeRelayerChange()"
  exit 0
fi

echo "=== executeAmoeRelayerChange ==="
cast send "$MGR" "executeAmoeRelayerChange()" \
  --rpc-url "$RPC" \
  --private-key "$PK" \
  --legacy

live="$(cast call "$MGR" "authorizedAmoeRelayer()(address)" --rpc-url "$RPC")"
echo "authorizedAmoeRelayer=$live"
if [[ "${live,,}" != "${NEW_ROUTER,,}" ]]; then
  echo "ERROR: cutover failed — authorizedAmoeRelayer != NEW_ROUTER" >&2
  exit 1
fi

cat <<EOF

CUTOVER ON-CHAIN COMPLETE

Flip these env values (local + Vercel production/preview/development):

  LOTTERY_AMOE_ROUTER=${NEW_ROUTER}
  VITE_LOTTERY_AMOE_ROUTER=${NEW_ROUTER}

Optional notes:
  AmoePlonkVerifier=${NEW_VERIFIER}
  Old router (deprecated after flip)=0xf07D4811C55DAB360D4aF802FA9756EBca241DAC

Publisher cron must publish allowlist + points-ledger roots to ${NEW_ROUTER}
(same publisher EOA 0x793CA281… — already set on-chain).

EOF
