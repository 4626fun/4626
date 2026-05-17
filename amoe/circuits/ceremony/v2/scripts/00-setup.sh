#!/usr/bin/env bash
# AMOE v2 ceremony — Step 0 (coordinator setup).
#
# Produces amoe_v2_0000.zkey, the empty starting file every contributor
# chains off of. Deterministic from (R1CS, ptau) — no coordinator entropy
# enters the chain at this step.
#
# Run from the repo root:
#   bash amoe/circuits/ceremony/v2/scripts/00-setup.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../../../.." && pwd)"
BUILD="$ROOT/amoe/circuits/build"

# Manifest-pinned circuit hash (from v2-manifest.md §1). If this doesn't
# match the hash snarkjs prints below, the circuit has drifted since the
# manifest was tagged — STOP.
EXPECTED_R1CS_HASH_HEAD="b93497b0 68d1b96b fec84a90 be154a55"

command -v snarkjs >/dev/null || { echo "snarkjs required (npm i -g snarkjs)"; exit 1; }

echo "==> AMOE v2 ceremony — Step 0 (coordinator setup)"
echo

if [ ! -f "$BUILD/amoe_eligibility.r1cs" ]; then
    echo "ERR: $BUILD/amoe_eligibility.r1cs missing — compile first via:"
    echo "    bash amoe/tools/zk/verify_amoe_ceremony.sh"
    exit 1
fi

if [ ! -f "$BUILD/pot14_final.ptau" ]; then
    echo "ERR: $BUILD/pot14_final.ptau missing — fetch it via:"
    echo "    curl -sLo $BUILD/pot14_final.ptau https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_14.ptau"
    exit 1
fi

if [ -f "$BUILD/amoe_v2_0000.zkey" ]; then
    echo "WARN: $BUILD/amoe_v2_0000.zkey already exists."
    echo "      If this is a re-run, move the old file aside first."
    echo "      Aborting to be safe."
    exit 1
fi

echo "[setup] R1CS:  $BUILD/amoe_eligibility.r1cs"
echo "[setup] ptau:  $BUILD/pot14_final.ptau"
echo

# Capture the snarkjs output so we can extract the circuit hash and check it.
LOG="$(mktemp)"
trap 'rm -f "$LOG"' EXIT

snarkjs groth16 setup \
    "$BUILD/amoe_eligibility.r1cs" \
    "$BUILD/pot14_final.ptau" \
    "$BUILD/amoe_v2_0000.zkey" 2>&1 | tee "$LOG"

echo
echo "[setup] Verifying circuit hash matches manifest..."
ACTUAL_HEAD="$(grep -A1 'Circuit hash' "$LOG" | tail -1 | tr -s ' ' | sed 's/^[[:space:]]*//')"
if [ "$ACTUAL_HEAD" != "$EXPECTED_R1CS_HASH_HEAD" ]; then
    echo "ERR: circuit hash mismatch."
    echo "  expected (manifest): $EXPECTED_R1CS_HASH_HEAD"
    echo "  actual   (this run): $ACTUAL_HEAD"
    echo "Refusing to proceed. Re-pin the manifest if the circuit was intentionally changed."
    rm -f "$BUILD/amoe_v2_0000.zkey"
    exit 1
fi

echo "[setup] OK — circuit hash matches manifest."
echo

OUT_SHA="$(sha256sum "$BUILD/amoe_v2_0000.zkey" | cut -d' ' -f1)"
echo "==> Step 0 complete."
echo "    File:    $BUILD/amoe_v2_0000.zkey"
echo "    SHA-256: $OUT_SHA"
echo
echo "Send this SHA-256 to contributor 1 alongside the file so they can verify"
echo "what they received before contributing."
