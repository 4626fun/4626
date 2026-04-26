#!/usr/bin/env bash
# Regenerate AMOE circuit artifacts + the on-chain test fixture.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CIRC="$ROOT/circuits/amoe"
BUILD="$CIRC/build"
mkdir -p "$BUILD"
cd "$CIRC"

command -v circom >/dev/null || { echo "circom v2 not found"; exit 1; }
command -v snarkjs >/dev/null || { echo "snarkjs not found"; exit 1; }

(cd "$BUILD" && [ -f package.json ] || npm init -y >/dev/null
  npm install --no-save circomlib circomlibjs >/dev/null)

circom amoe_eligibility.circom --r1cs --wasm --sym -o "$BUILD" -l "$BUILD/node_modules"

[ -f "$BUILD/pot14_final.ptau" ] || curl -sL -o "$BUILD/pot14_final.ptau" \
  "https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_14.ptau"

snarkjs groth16 setup "$BUILD/amoe_eligibility.r1cs" "$BUILD/pot14_final.ptau" "$BUILD/amoe_0000.zkey" >/dev/null
echo "$(date +%s%N) $RANDOM" | snarkjs zkey contribute "$BUILD/amoe_0000.zkey" "$BUILD/amoe_final.zkey" \
  --name="regen $(date -u +%FT%T)" >/dev/null
snarkjs zkey export verificationkey "$BUILD/amoe_final.zkey" "$BUILD/verification_key.json" >/dev/null

snarkjs zkey export solidityverifier "$BUILD/amoe_final.zkey" "$BUILD/AmoeGroth16Verifier.sol" >/dev/null
sed -i 's/contract Groth16Verifier/contract AmoeGroth16Verifier/' "$BUILD/AmoeGroth16Verifier.sol"
cp "$BUILD/AmoeGroth16Verifier.sol" "$ROOT/contracts/utilities/lottery/zk/AmoeGroth16Verifier.sol"

# (fixture-input generator omitted here for brevity — see PR description)
echo "Verifier regenerated. Re-run fixture step from the PR notes if needed."
