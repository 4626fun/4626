#!/usr/bin/env bash
# CI guard: enforce that AmoePlonkVerifier.sol still carries the divergences
# from stock snarkjs output that we depend on for security.
#
# Specifically, this script asserts:
#
#   1. The contract is named `AmoePlonkVerifier`, not `PlonkVerifier`.
#   2. The pragma is `^0.8.20` (snarkjs ships `>=0.7.0 <0.9.0`).
#   3. The header banner contains the "DIVERGENCE FROM STOCK SNARKJS" block.
#   4. `verifyProof` calls `checkField` on every public-input slot
#      (calldataload(add(_pubSignals, 0)) ... add(_pubSignals, 224)).
#   5. The 8 checkField calls appear *between* `checkProofData()` and
#      `calculateChallenges(`, i.e. before the values reach the transcript.
#   6. The committed contract is byte-identical to what
#      `amoe/tools/zk/_patch_amoe_plonk_verifier.py` produces from the canonical
#      raw snarkjs source (when that source is on disk — local dev only).
#
# Why this exists:
#   The stock snarkjs PLONK verifier omits a checkField pass on the 8 public
#   inputs. Without that pass a malicious prover can submit non-canonical
#   (x + k*q) encodings that bypass the router's raw-bytes replay maps. We
#   patched it once on PR #409; this guard makes sure that fix stays in
#   even if someone re-exports the verifier from snarkjs.
#
# Usage:
#   amoe/tools/ci/check_amoe_plonk_patch.sh
#
# Exit codes:
#   0  all checks pass
#   1  a check failed (CI should block)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
VERIFIER="$ROOT/contracts/utilities/lottery/zk/AmoePlonkVerifier.sol"
RAW="$ROOT/amoe/circuits/build/plonk_fresh/AmoePlonkVerifier_raw.sol"

ok()   { printf '\033[32m[ok]\033[0m   %s\n' "$*"; }
fail() { printf '\033[31m[FAIL]\033[0m %s\n' "$*" >&2; exit 1; }
info() { printf '\033[36m[..]\033[0m   %s\n' "$*"; }

[ -f "$VERIFIER" ] || fail "verifier not found at $VERIFIER"

# ----------------------------------------------------------------------------- 
# 1. Contract renamed.
# ----------------------------------------------------------------------------- 

if grep -qE '^contract\s+PlonkVerifier\b' "$VERIFIER"; then
  fail "AmoePlonkVerifier.sol still contains 'contract PlonkVerifier'. Run amoe/tools/zk/regen_amoe_plonk_verifier.sh."
fi
grep -qE '^contract\s+AmoePlonkVerifier\b' "$VERIFIER" \
  || fail "AmoePlonkVerifier.sol must declare 'contract AmoePlonkVerifier'"
ok "contract renamed to AmoePlonkVerifier"

# ----------------------------------------------------------------------------- 
# 2. Pragma bumped.
# ----------------------------------------------------------------------------- 

if grep -qE 'pragma solidity\s+>=0\.7\.0\s*<0\.9\.0' "$VERIFIER"; then
  fail "AmoePlonkVerifier.sol still has the snarkjs pragma '>=0.7.0 <0.9.0' (need ^0.8.20)"
fi
grep -qE 'pragma solidity\s+\^0\.8\.20' "$VERIFIER" \
  || fail "AmoePlonkVerifier.sol must use 'pragma solidity ^0.8.20'"
ok "pragma is ^0.8.20"

# ----------------------------------------------------------------------------- 
# 3. Banner present.
# ----------------------------------------------------------------------------- 

grep -q 'DIVERGENCE FROM STOCK SNARKJS OUTPUT' "$VERIFIER" \
  || fail "header banner missing 'DIVERGENCE FROM STOCK SNARKJS OUTPUT' block"
ok "divergence banner present"

# ----------------------------------------------------------------------------- 
# 4. All 8 checkField(_pubSignals + N*32) calls present.
# ----------------------------------------------------------------------------- 

EXPECTED_OFFSETS=(0 32 64 96 128 160 192 224)
for off in "${EXPECTED_OFFSETS[@]}"; do
  # Match the offset at the end of the calldataload call. Allow flexible
  # spacing because formatters can collapse runs of spaces.
  if ! grep -qE "checkField\(calldataload\(add\(_pubSignals,\s*${off}\s*\)\)\)" "$VERIFIER"; then
    fail "missing public-input field guard for offset ${off} (slot $((off / 32)))"
  fi
done
ok "all 8 public-input checkField calls present"

# ----------------------------------------------------------------------------- 
# 5. The 8 calls appear between checkProofData() and calculateChallenges(.
# ----------------------------------------------------------------------------- 

L_CHECKPROOFDATA="$(grep -nE '^\s*checkProofData\(\)\s*$' "$VERIFIER" | head -1 | cut -d: -f1 || true)"
L_CALLCHALLENGES="$(grep -nE '^\s*calculateChallenges\(pMem,\s*_pubSignals\)' "$VERIFIER" | head -1 | cut -d: -f1 || true)"
L_FIRST_GUARD="$(grep -nE 'checkField\(calldataload\(add\(_pubSignals,\s*0\s*\)\)\)' "$VERIFIER" | head -1 | cut -d: -f1 || true)"
L_LAST_GUARD="$(grep -nE 'checkField\(calldataload\(add\(_pubSignals,\s*224\s*\)\)\)' "$VERIFIER" | head -1 | cut -d: -f1 || true)"

[ -n "$L_CHECKPROOFDATA" ]   || fail "could not locate checkProofData() call"
[ -n "$L_CALLCHALLENGES" ]   || fail "could not locate calculateChallenges(pMem, _pubSignals) call"
[ -n "$L_FIRST_GUARD" ]      || fail "could not locate first public-input checkField call"
[ -n "$L_LAST_GUARD" ]       || fail "could not locate last public-input checkField call"

if ! [ "$L_CHECKPROOFDATA" -lt "$L_FIRST_GUARD" ]; then
  fail "checkField(_pubSignals, 0) must come AFTER checkProofData() (line $L_CHECKPROOFDATA), not at line $L_FIRST_GUARD"
fi
if ! [ "$L_LAST_GUARD" -lt "$L_CALLCHALLENGES" ]; then
  fail "checkField(_pubSignals, 224) must come BEFORE calculateChallenges (line $L_CALLCHALLENGES), not at line $L_LAST_GUARD"
fi
info "checkProofData() at line $L_CHECKPROOFDATA"
info "checkField loop at lines $L_FIRST_GUARD..$L_LAST_GUARD"
info "calculateChallenges at line $L_CALLCHALLENGES"
ok "guard ordering is correct"

# ----------------------------------------------------------------------------- 
# 6. Optional: verify byte-equivalence with what the regen script produces
#    from the canonical raw file. Skipped on CI runners that don't ship the
#    raw artifact (it's gitignored — only present on machines that have
#    actually run `regen_amoe_plonk_verifier.sh`).
# ----------------------------------------------------------------------------- 

if [ -f "$RAW" ] && command -v python3 >/dev/null 2>&1; then
  TMP="$(mktemp)"
  trap 'rm -f "$TMP"' EXIT
  python3 "$ROOT/amoe/tools/zk/_patch_amoe_plonk_verifier.py" \
    --raw "$RAW" --out "$TMP"
  if ! diff -q "$VERIFIER" "$TMP" >/dev/null; then
    info "diff between committed and regenerated:"
    diff -u "$VERIFIER" "$TMP" | head -40 >&2 || true
    fail "AmoePlonkVerifier.sol drifted from the regen output. Run amoe/tools/zk/regen_amoe_plonk_verifier.sh."
  fi
  ok "committed verifier byte-matches regen output"
else
  info "skipping byte-equivalence check (raw snarkjs source not on disk)"
fi

printf '\033[32m\nall AmoePlonkVerifier patch guards passed\033[0m\n'
