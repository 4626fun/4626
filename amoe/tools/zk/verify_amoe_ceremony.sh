#!/usr/bin/env bash
# Reproduce: snarkjs zkey verify against the committed circuit.
# Verifies the full ceremony chain from amoe_final.zkey back to phase-1.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BUILD="$ROOT/amoe/circuits/build"

command -v circom >/dev/null || { echo "circom v2 required"; exit 1; }
command -v snarkjs >/dev/null || { echo "snarkjs required"; exit 1; }

if [ ! -f "$BUILD/amoe_eligibility.r1cs" ]; then
  echo "[verify] Compiling circuit..."
  (cd "$BUILD" && [ -d node_modules ] || { npm init -y >/dev/null && npm install --no-save circomlib >/dev/null; })
  circom "$ROOT/amoe/circuits/amoe_eligibility.circom" --r1cs --sym -o "$BUILD" -l "$BUILD/node_modules"
fi

if [ ! -f "$BUILD/pot14_final.ptau" ]; then
  echo "[verify] Downloading Hermez ptau-14..."
  curl -sL -o "$BUILD/pot14_final.ptau" \
    "https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_14.ptau"
fi

if [ ! -f "$BUILD/amoe_final.zkey" ]; then
  echo "[verify] amoe_final.zkey missing — fetch it from the release artifact"
  exit 1
fi

echo "[verify] Running snarkjs zkey verify..."
snarkjs zkey verify "$BUILD/amoe_eligibility.r1cs" "$BUILD/pot14_final.ptau" "$BUILD/amoe_final.zkey"
echo "[verify] OK"
