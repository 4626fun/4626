#!/usr/bin/env bash
# Regenerate the AMOE PLONK verifier contract from source.
#
# This script reproduces the artifact in
#   contracts/utilities/lottery/zk/AmoePlonkVerifier.sol
# starting from:
#   * amoe/circuits/amoe_eligibility.circom            (source circuit)
#   * amoe/circuits/build/pot17_hez_final.ptau         (universal SRS)
#
# It then re-applies the divergences from stock snarkjs output that the
# AmoePlonkVerifier requires:
#   1. Contract renamed PlonkVerifier -> AmoePlonkVerifier
#   2. Pragma bumped to ^0.8.20
#   3. Header banner with provenance + the "DIVERGENCE FROM STOCK SNARKJS"
#      block explaining the public-input checkField loop
#   4. Explicit checkField calls on _pubSignals[0..7] inserted right after
#      checkProofData() — without this, a malicious prover can submit
#      non-canonical (x + k*q) encodings of public inputs and bypass the
#      router's raw-bytes replay maps. See PR #409 (codex bot finding).
#
# Why this script exists:
#   The snarkjs CLI emits a verifier that lacks the public-input field
#   bound check, and a future "let me just re-export the verifier" workflow
#   would silently drop our security patch. CI runs check_amoe_plonk_patch.sh
#   on every PR and rejects a verifier without the loop. Anyone needing
#   to regenerate the contract should use *this* script — not the snarkjs
#   CLI directly.
#
# Usage:
#   amoe/tools/zk/regen_amoe_plonk_verifier.sh
#
# Outputs (in amoe/circuits/build/plonk_fresh/):
#   * amoe_eligibility.r1cs / .sym / .wasm        (--O1 compile)
#   * amoe_plonk_final.zkey                        (PLONK setup vs pot17)
#   * vk_plonk.json                                (verification key)
#   * AmoePlonkVerifier_raw.sol                    (snarkjs source-of-truth)
#   * proof_plonk.json / public_plonk.json         (smoke-test proof, optional)
# And the patched contract is written back to:
#   contracts/utilities/lottery/zk/AmoePlonkVerifier.sol

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CIRCUITS="$ROOT/amoe/circuits"
BUILD="$CIRCUITS/build"
FRESH="$BUILD/plonk_fresh"
OUT="$ROOT/contracts/utilities/lottery/zk/AmoePlonkVerifier.sol"

PTAU="$BUILD/pot17_hez_final.ptau"
PTAU_SHA="6b662a324867139fb1a20a324d90b6ff61856dfb23f59326909f14b0e2483ae0"
PTAU_URL="https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_17.ptau"

CIRCOM="${CIRCOM:-circom}"
SNARKJS_CLI="${SNARKJS_CLI:-/usr/local/lib/node_modules/snarkjs/build/cli.cjs}"
NODE_HEAVY=(node --max-old-space-size=7000 "$SNARKJS_CLI")

err()  { printf '\033[31m[regen]\033[0m %s\n' "$*" >&2; }
log()  { printf '\033[36m[regen]\033[0m %s\n' "$*" >&2; }

# ------------------------------------------------------------------------------
# 0. Pre-flight checks.
# ------------------------------------------------------------------------------

command -v "$CIRCOM" >/dev/null 2>&1 || { err "circom not found in PATH"; exit 1; }
[ -f "$SNARKJS_CLI" ] || { err "snarkjs CLI not at $SNARKJS_CLI (override SNARKJS_CLI=...)"; exit 1; }
command -v node >/dev/null 2>&1 || { err "node not found in PATH"; exit 1; }
command -v sha256sum >/dev/null 2>&1 || { err "sha256sum not found"; exit 1; }

# Circom must be 2.1.x — 2.2+ changes constraint emission in ways the pinned
# zkey relies on. We only need a soft warning here, not a hard fail.
CIRCOM_VER="$($CIRCOM --version 2>/dev/null | head -1 || true)"
log "circom version: $CIRCOM_VER"
case "$CIRCOM_VER" in
  *2.1.*) ;;
  *) log "WARNING: tested with circom 2.1.9 — this is $CIRCOM_VER" ;;
esac

# ------------------------------------------------------------------------------
# 1. Make sure the universal Hermez pot17 SRS is on disk and uncorrupted.
# ------------------------------------------------------------------------------

mkdir -p "$BUILD" "$FRESH"

if [ ! -f "$PTAU" ]; then
  log "downloading Hermez pot17 ptau (~144 MB) ..."
  curl -fSL -o "$PTAU" "$PTAU_URL"
fi

ACTUAL_SHA="$(sha256sum "$PTAU" | awk '{print $1}')"
if [ "$ACTUAL_SHA" != "$PTAU_SHA" ]; then
  err "pot17 ptau sha mismatch:"
  err "  expected $PTAU_SHA"
  err "  actual   $ACTUAL_SHA"
  err "refusing to proceed with corrupted SRS"
  exit 1
fi
log "pot17 sha verified ($PTAU_SHA)"

# ------------------------------------------------------------------------------
# 2. Compile the circuit with --O1.
#
# PLONK rejects --O2's collapsed linear combinations with
# "Invalid witness length: Circuit: ..., witness: ..., ...".
# This is a circom/snarkjs interop bug, not a circuit bug. --O1 keeps the
# constraint structure PLONK expects.
# ------------------------------------------------------------------------------

log "compiling amoe_eligibility.circom with --O1 ..."
( cd "$FRESH" && \
  "$CIRCOM" "$CIRCUITS/amoe_eligibility.circom" \
    --r1cs --wasm --sym --O1 \
    -l "$CIRCUITS/node_modules" )

# ------------------------------------------------------------------------------
# 3. PLONK setup against pot17 — universal, no per-circuit phase 2.
# ------------------------------------------------------------------------------

log "running PLONK setup (memory-heavy, ~3-5 min) ..."
"${NODE_HEAVY[@]}" plonk setup \
  "$FRESH/amoe_eligibility.r1cs" \
  "$PTAU" \
  "$FRESH/amoe_plonk_final.zkey"

log "exporting verification key ..."
node "$SNARKJS_CLI" zkey export verificationkey \
  "$FRESH/amoe_plonk_final.zkey" \
  "$FRESH/vk_plonk.json"

log "exporting solidity verifier (snarkjs source-of-truth) ..."
node "$SNARKJS_CLI" zkey export solidityverifier \
  "$FRESH/amoe_plonk_final.zkey" \
  "$FRESH/AmoePlonkVerifier_raw.sol"

# ------------------------------------------------------------------------------
# 4. Apply the divergences from stock snarkjs output.
#
# We do this with a python helper so the substitutions are exact and the
# header banner stays in sync with what the production contract actually has.
# Editing in-place with sed is fragile against snarkjs version drift.
# ------------------------------------------------------------------------------

log "patching verifier (rename + pragma + banner + checkField loop) ..."
python3 "$ROOT/amoe/tools/zk/_patch_amoe_plonk_verifier.py" \
  --raw "$FRESH/AmoePlonkVerifier_raw.sol" \
  --out "$OUT"

log "wrote $OUT"

# ------------------------------------------------------------------------------
# 5. Smoke-test: run the forge tests against the new contract.
#    Any regression here means the patch script needs updating.
# ------------------------------------------------------------------------------

if command -v forge >/dev/null 2>&1; then
  log "smoke-testing with forge ..."
  ( cd "$ROOT" && forge test --match-contract AmoePlonkVerifier -vv ) || {
    err "forge test failed — verifier patch may be broken"
    exit 1
  }
else
  log "forge not found, skipping smoke test"
fi

log "done. Review the diff before committing:"
log "  git diff $OUT"
