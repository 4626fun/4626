#!/usr/bin/env bash
# CI guard: size gate for CreatorOVault.
#
# CreatorOVault uses a Diamond-style module split (core / strategies /
# admin) to stay under the EIP-170 24,576-byte runtime bytecode cap.
# As of commit 19ad35b21 (June 2026 x-ray audit pass) the vault
# measured 22,915 B — 1,661 B of headroom.
#
# Unlike CreatorLotteryManager (which lives ~48 B from the cap and
# uses a warn-only guard), CreatorOVault has comfortable headroom
# today but is expected to grow as modules add features. This gate
# provides early warning before the hard EIP-170 gate trips.
#
# Thresholds (update as headroom changes):
#   WARN  = 23,500 bytes  (~1,076 B headroom under EIP-170)
#   FAIL  = 24,000 bytes  (~576 B safety margin — blocks merge)
#   HARD  = 24,576 bytes  (EIP-170 — already enforced by forge build --sizes)
#
# Behaviour:
#   - size <= WARN          : ok, exit 0
#   - WARN < size < FAIL    : print warning, exit 0 (warn-only)
#   - size >= FAIL          : print error, exit 1 (blocking — merge blocked)
#   - size >= HARD          : print error, exit 1 (defence-in-depth;
#                             primary enforcer remains forge build --sizes)
#
# PR requirement (enforced by policy, not this script):
#   Any change touching contracts/vault/CreatorOVault.sol must include
#   a short "size budget review" note in the PR description or a linked
#   issue. Estimate byte impact and confirm remaining headroom.
#
# Usage:
#   amoe/tools/ci/check_ovault_size_warn.sh
#
# Exit codes:
#   0  size < FAIL (any warning printed is informational)
#   1  size >= FAIL (blocks merge)
#   2  inspect failed / could not determine size

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

CONTRACT="contracts/vault/CreatorOVault.sol:CreatorOVault"
WARN_THRESHOLD=23500
FAIL_THRESHOLD=24000
HARD_THRESHOLD=24576

ok()   { printf '\033[32m[ok]\033[0m   %s\n' "$*"; }
warn() { printf '\033[33m[WARN]\033[0m %s\n' "$*"; }
err()  { printf '\033[31m[FAIL]\033[0m %s\n' "$*" >&2; }
info() { printf '\033[36m[..]\033[0m   %s\n' "$*"; }

command -v forge >/dev/null 2>&1 || { echo "forge not on PATH" >&2; exit 2; }

info "inspecting deployed bytecode size for CreatorOVault"

HEX="$(forge inspect "$CONTRACT" deployedBytecode 2>/dev/null || true)"
if [ -z "$HEX" ] || [ "$HEX" = "0x" ]; then
  err "forge inspect returned empty deployedBytecode for $CONTRACT"
  exit 2
fi

HEX_NO_PREFIX="${HEX#0x}"
HEX_LEN="${#HEX_NO_PREFIX}"
if (( HEX_LEN % 2 != 0 )); then
  err "deployedBytecode hex has odd length ($HEX_LEN)"
  exit 2
fi

SIZE=$(( HEX_LEN / 2 ))
HEADROOM=$(( HARD_THRESHOLD - SIZE ))

if (( SIZE <= WARN_THRESHOLD )); then
  ok "CreatorOVault: ${SIZE} B (${HEADROOM} B headroom under EIP-170)"
  exit 0
fi

if (( SIZE >= FAIL_THRESHOLD )); then
  err "CreatorOVault: ${SIZE} B exceeds fail threshold (${FAIL_THRESHOLD} B)"
  err "  Headroom under EIP-170: ${HEADROOM} B"
  err "  This is a BLOCKING gate — merge cannot proceed."
  err "  Split or shrink the contract before landing this PR."
  err "  PR policy: include a 'size budget review' note (see docs/operations/contract-size-gate.md)."
  exit 1
fi

# WARN < size < FAIL
warn "CreatorOVault: ${SIZE} B exceeds warn threshold (${WARN_THRESHOLD} B)"
warn "  Headroom under EIP-170: ${HEADROOM} B"
warn "  Headroom under fail gate: $(( FAIL_THRESHOLD - SIZE )) B"
warn "  PR policy: include a 'size budget review' note for any change touching CreatorOVault.sol."
exit 0
