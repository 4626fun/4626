#!/usr/bin/env bash
# CI guard: warn-only size gate for CreatorLotteryManager.
#
# This is a SEPARATE, NON-BLOCKING heads-up gate that complements the
# existing EIP-170 hard gate (`forge build --sizes`, which fails at
# 24,576 bytes). The hard gate triggers AFTER a contract has already
# overflowed; by then a deploy is impossible until the offending PR
# is reverted or split.
#
# CreatorLotteryManager.sol is the protocol's largest production
# contract and historically lives within ~10-100 bytes of the cap.
# June 2026 x-ray contract audit pass measured 24,528 B (48 B headroom).
# Any innocent-looking PR (a new event field, an extra revert reason,
# an unchecked optimisation revert, or AMOE surface change) can
# silently consume the remaining margin.
#
# This script gives advance warning (currently targeting ~126 B lead time).
# It runs forge inspect, extracts the deployed bytecode size for
# CreatorLotteryManager, and prints a warning (without failing) when
# the size crosses the warn threshold but stays under the hard cap.
#
# Thresholds (update as headroom shrinks):
#   WARN  = 24,450 bytes  (~126 B headroom under EIP-170)
#   HARD  = 24,576 bytes  (EIP-170 — already enforced by `forge build --sizes`)
#
# Behaviour:
#   - size <= WARN          : ok, exit 0
#   - WARN < size < HARD    : print warning, exit 0 (warn-only)
#   - size >= HARD          : print error, exit 1 (defence-in-depth;
#                             primary enforcer remains the forge build gate)
#
# PR requirement (enforced by policy, not this script):
#   Any change touching contracts/utilities/lottery/CreatorLotteryManager.sol
#   (or its AdminModule) must include a short "size budget review" note
#   in the PR description or a linked issue. Estimate byte impact of the
#   change and confirm remaining headroom after the change.
#
# Usage:
#   amoe/tools/ci/check_manager_size_warn.sh
#
# Exit codes:
#   0  size <= HARD-1 (any warning printed is informational)
#   1  size >= HARD (mirrors EIP-170 gate; should not be reached in practice
#      because `forge build --sizes` will already have failed)
#   2  inspect failed / could not determine size

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

CONTRACT="contracts/utilities/lottery/CreatorLotteryManager.sol:CreatorLotteryManager"
WARN_THRESHOLD=24450
HARD_THRESHOLD=24576

ok()   { printf '\033[32m[ok]\033[0m   %s\n' "$*"; }
warn() { printf '\033[33m[WARN]\033[0m %s\n' "$*"; }
fail() { printf '\033[31m[FAIL]\033[0m %s\n' "$*" >&2; exit 1; }
info() { printf '\033[36m[..]\033[0m   %s\n' "$*"; }

command -v forge >/dev/null 2>&1 || { echo "forge not on PATH" >&2; exit 2; }

info "inspecting deployed bytecode size for CreatorLotteryManager"

# `forge inspect <contract> bytecode` returns the *deployed* runtime
# bytecode (post-constructor code that lives on chain) as 0x-prefixed
# hex. Length in bytes = (len(hex) - 2) / 2.
HEX="$(forge inspect "$CONTRACT" deployedBytecode 2>/dev/null || true)"
if [ -z "$HEX" ] || [ "$HEX" = "0x" ]; then
  # Fall back to `bytecode` (creation) only if deployedBytecode missing.
  echo "[FAIL] forge inspect returned empty deployedBytecode for $CONTRACT" >&2
  exit 2
fi

# Strip 0x prefix, then count.
HEX_NO_PREFIX="${HEX#0x}"
HEX_LEN="${#HEX_NO_PREFIX}"
if (( HEX_LEN % 2 != 0 )); then
  echo "[FAIL] deployedBytecode hex has odd length ($HEX_LEN)" >&2
  exit 2
fi
SIZE=$(( HEX_LEN / 2 ))

info "CreatorLotteryManager runtime size: ${SIZE} bytes"
info "warn threshold:                     ${WARN_THRESHOLD} bytes (~126 B target lead time)"
info "EIP-170 hard cap:                   ${HARD_THRESHOLD} bytes"

if (( SIZE >= HARD_THRESHOLD )); then
  fail "CreatorLotteryManager runtime size ${SIZE} >= EIP-170 cap ${HARD_THRESHOLD}. \
Contract is undeployable. (This should already have been caught by \
\`forge build --sizes\`.)"
fi

if (( SIZE > WARN_THRESHOLD )); then
  HEADROOM=$(( HARD_THRESHOLD - SIZE ))
  warn "CreatorLotteryManager runtime size ${SIZE} > warn threshold ${WARN_THRESHOLD}."
  warn "only ${HEADROOM} bytes of EIP-170 headroom remain (cap = ${HARD_THRESHOLD})."
  warn "PRs touching this file MUST include a 'size budget review' note estimating impact."
  warn "consider extracting another helper module (AdminModule precedent) before adding new logic."
  warn "this is a heads-up — the build still passes."
  exit 0
fi

HEADROOM=$(( HARD_THRESHOLD - SIZE ))
ok "CreatorLotteryManager has ${HEADROOM} bytes of EIP-170 headroom (size=${SIZE})."
ok "Any touching PRs should still note estimated size delta + remaining headroom."
exit 0
