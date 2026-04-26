#!/usr/bin/env bash
# Emit AmoeGroth16Verifier.sol via zkMetal (MIT) instead of snarkjs (GPL-3.0).
# Requires `amoe-prover` built from relayer/zkproof on an Apple Silicon host.
#
# Usage: tools/zk/emit_amoe_verifier.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BUILD="$ROOT/circuits/amoe/build"
OUT="$ROOT/contracts/utilities/lottery/zk/AmoeGroth16Verifier.sol"

if [ ! -f "$BUILD/verification_key.json" ]; then
  echo "missing $BUILD/verification_key.json — run circuit build first" >&2
  exit 1
fi

BIN="$ROOT/relayer/zkproof/.build/release/amoe-prover"
if [ ! -x "$BIN" ]; then
  echo "building amoe-prover (release) …" >&2
  ( cd "$ROOT/relayer/zkproof" && swift build -c release )
fi

"$BIN" emit-verifier \
  --vk   "$BUILD/verification_key.json" \
  --out  "$OUT" \
  --name AmoeGroth16Verifier

echo "wrote $OUT" >&2
