#!/usr/bin/env bash
# Read-only checks for AMOE multi-entry cutover readiness / post-execute health.
#
# Usage:
#   amoe/tools/ops/verify-amoe-cutover.sh
#   amoe/tools/ops/verify-amoe-cutover.sh --expect-live   # fail unless manager auth == NEW_ROUTER

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
OLD_ROUTER="${AMOE_OLD_ROUTER:-0xf07D4811C55DAB360D4aF802FA9756EBca241DAC}"
NEW_VERIFIER="${AMOE_CUTOVER_VERIFIER:-0xcEA9e27cC9baF88Cb50777B5cD23fbE8BF53c229}"
PUBLISHER="${AMOE_PUBLISHER:-0x793CA28123cBA3cA3c20b9C6C67f37510c89C145}"
RPC="${BASE_RPC_URL:?BASE_RPC_URL required}"
EXPECT_LIVE=0
if [[ "${1:-}" == "--expect-live" ]]; then EXPECT_LIVE=1; fi

now="$(date +%s)"
current="$(cast call "$MGR" "authorizedAmoeRelayer()(address)" --rpc-url "$RPC")"
pending="$(cast call "$MGR" "pendingAmoeRelayer()(address)" --rpc-url "$RPC")"
eff="$(cast call "$MGR" "pendingAmoeRelayerEffectiveAt()(uint256)" --rpc-url "$RPC" | awk '{print $1}')"

echo "now=$now"
echo "manager=$MGR"
echo "authorizedAmoeRelayer=$current"
echo "pendingAmoeRelayer=$pending"
echo "pendingAmoeRelayerEffectiveAt=$eff"

for getter in manager verifier pointsLedgerPublisher allowlistPublisher owner; do
  val="$(cast call "$NEW_ROUTER" "${getter}()(address)" --rpc-url "$RPC")"
  echo "new_router.${getter}=$val"
done

fail=0
check_eq() {
  local label="$1" got="$2" want="$3"
  if [[ "${got,,}" != "${want,,}" ]]; then
    echo "FAIL: $label got=$got want=$want" >&2
    fail=1
  else
    echo "ok: $label"
  fi
}

check_eq "new_router.manager" "$(cast call "$NEW_ROUTER" "manager()(address)" --rpc-url "$RPC")" "$MGR"
check_eq "new_router.verifier" "$(cast call "$NEW_ROUTER" "verifier()(address)" --rpc-url "$RPC")" "$NEW_VERIFIER"
check_eq "new_router.pointsLedgerPublisher" "$(cast call "$NEW_ROUTER" "pointsLedgerPublisher()(address)" --rpc-url "$RPC")" "$PUBLISHER"
check_eq "new_router.allowlistPublisher" "$(cast call "$NEW_ROUTER" "allowlistPublisher()(address)" --rpc-url "$RPC")" "$PUBLISHER"

if [[ "${current,,}" == "${NEW_ROUTER,,}" ]]; then
  echo "status=LIVE new router authorized"
  if [[ "$eff" != "0" ]]; then
    echo "WARN: pendingAmoeRelayerEffectiveAt still non-zero after live cutover" >&2
  fi
elif [[ "${current,,}" == "${OLD_ROUTER,,}" ]]; then
  echo "status=QUEUED still on old router"
  if (( now >= eff && eff != 0 )); then
    echo "READY: timelock expired — run execute-amoe-relayer-cutover.sh"
  else
    remain=$((eff - now))
    echo "WAIT: ${remain}s / $(awk -v s="$remain" 'BEGIN{printf "%.2f", s/3600}')h until execute"
  fi
  if [[ "$EXPECT_LIVE" == "1" ]]; then
    echo "FAIL: --expect-live but authorized relayer is still old router" >&2
    fail=1
  fi
else
  echo "FAIL: authorized relayer is neither NEW nor OLD" >&2
  fail=1
fi

env_router="${LOTTERY_AMOE_ROUTER:-}"
if [[ -n "$env_router" ]]; then
  echo "env.LOTTERY_AMOE_ROUTER=$env_router"
  if [[ "${current,,}" == "${NEW_ROUTER,,}" && "${env_router,,}" != "${NEW_ROUTER,,}" ]]; then
    echo "WARN: on-chain live is NEW but local LOTTERY_AMOE_ROUTER still points elsewhere" >&2
  fi
  if [[ "${current,,}" == "${OLD_ROUTER,,}" && "${env_router,,}" == "${NEW_ROUTER,,}" ]]; then
    echo "WARN: env already flipped to NEW but manager still authorizes OLD — do not use this env yet" >&2
    fail=1
  fi
else
  echo "env.LOTTERY_AMOE_ROUTER=(unset in sourced .env)"
fi

exit "$fail"
