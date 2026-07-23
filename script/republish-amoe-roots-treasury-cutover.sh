#!/usr/bin/env bash
# Treasury-EOA fallback for AMOE Merkle root republish when Privy CSW publisher
# UserOps fail (privy_http_401 / userop_submission_failed).
#
# Usage:
#   ./script/republish-amoe-roots-treasury-cutover.sh \
#     0x18D1806cfe044de1eb4652ab30Bf6937f8dfc0A7 \
#     67:0x012c73f72d683c330336a91a29391a0501678e83fa950151f8bc134be24f9840 \
#     68:0x2bdda0a15a502c96cff79aecb1dd459855792272c6bb44a99aba7e94bb06b4d5 \
#     ledger68:0x1a590d02657716f62174d7f12e09ef2f5af83676fc891fdacdec42d33c0580e9
#
# Requires: PRIVATE_KEY, BASE_RPC_URL in .env (treasury owner = router owner).

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
set -a
# shellcheck disable=SC1091
source "$ROOT_DIR/.env"
set +a

ROUTER="${1:?router address required}"
shift

TREASURY="${PROTOCOL_TREASURY:-0xB05Cf01231cF2fF99499682E64D3780d57c80FdD}"
CANONICAL_CSW="${AMOE_PUBLISHER:-0x793ca28123cba3ca3c20b9c6c67f37510c89c145}"

publishers_changed=0
restore_publishers() {
  if [[ "$publishers_changed" -ne 1 ]]; then
    return
  fi
  publishers_changed=0
  set +e
  echo "==> Restore publishers to canonical CSW $CANONICAL_CSW"
  cast send "$ROUTER" "setAllowlistPublisher(address)" "$CANONICAL_CSW" \
    --rpc-url "$BASE_RPC_URL" --private-key "$PRIVATE_KEY" --json | jq -r '.transactionHash // .hash'
  allowlist_restore_status=${PIPESTATUS[0]}
  cast send "$ROUTER" "setPointsLedgerPublisher(address)" "$CANONICAL_CSW" \
    --rpc-url "$BASE_RPC_URL" --private-key "$PRIVATE_KEY" --json | jq -r '.transactionHash // .hash'
  ledger_restore_status=${PIPESTATUS[0]}
  set -e
  if [[ "$allowlist_restore_status" -ne 0 || "$ledger_restore_status" -ne 0 ]]; then
    echo "ERROR: failed to restore one or more AMOE publisher roles" >&2
    return 1
  fi
}
trap restore_publishers EXIT

echo "==> Temporarily set publishers to treasury EOA $TREASURY"
cast send "$ROUTER" "setAllowlistPublisher(address)" "$TREASURY" \
  --rpc-url "$BASE_RPC_URL" --private-key "$PRIVATE_KEY" --json | jq -r '.transactionHash // .hash'
publishers_changed=1
cast send "$ROUTER" "setPointsLedgerPublisher(address)" "$TREASURY" \
  --rpc-url "$BASE_RPC_URL" --private-key "$PRIVATE_KEY" --json | jq -r '.transactionHash // .hash'

for spec in "$@"; do
  key="${spec%%:*}"
  root="${spec#*:}"
  if [[ "$key" == ledger* ]]; then
    epoch="${key#ledger}"
    echo "==> setPointsLedgerRoot epoch=$epoch"
    cast send "$ROUTER" "setPointsLedgerRoot(uint64,bytes32)" "$epoch" "$root" \
      --rpc-url "$BASE_RPC_URL" --private-key "$PRIVATE_KEY" --json | jq -r '.transactionHash // .hash'
  else
    echo "==> setAllowlistRoot epoch=$key"
    cast send "$ROUTER" "setAllowlistRoot(uint64,bytes32)" "$key" "$root" \
      --rpc-url "$BASE_RPC_URL" --private-key "$PRIVATE_KEY" --json | jq -r '.transactionHash // .hash'
  fi
done

restore_publishers
trap - EXIT

echo "Done."
