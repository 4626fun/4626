#!/usr/bin/env bash
# AMOE v2 ceremony — Step F (final beacon + emit verifier).
#
# After all contributors have submitted, run this once the Bitcoin block
# pinned in v2-manifest.md §5 has been mined.
#
# Steps:
#   1. Verify the latest contribution chain.
#   2. Run snarkjs zkey beacon with the Bitcoin block hash.
#   3. Re-verify the chain INCLUDING the beacon.
#   4. Emit verification_key_v2.json + AmoeGroth16Verifier_v2.sol.
#   5. Append the finalize row to the transcript.
#
# Usage:
#   bash circuits/amoe/ceremony/v2/scripts/02-finalize.sh \
#       <bitcoin_block_hash_hex_no_0x> \
#       <bitcoin_block_height>

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../../../.." && pwd)"
BUILD="$ROOT/circuits/amoe/build"
TRANSCRIPT="$ROOT/circuits/amoe/ceremony/v2/ceremony_transcript_v2.txt"

if [ $# -ne 2 ]; then
    echo "usage: $0 <bitcoin_block_hash_hex_no_0x> <bitcoin_block_height>"
    echo
    echo "Cross-reference the block hash against at least 2 explorers (e.g."
    echo "mempool.space, blockchain.com, blockstream.info) before running."
    exit 1
fi

BEACON_HASH="$1"
BEACON_HEIGHT="$2"
ITERATIONS=10  # 2^10 = 1024, snarkjs default for production

# Sanity check the hash format (64 hex chars, no 0x prefix).
if ! [[ "$BEACON_HASH" =~ ^[0-9a-fA-F]{64}$ ]]; then
    echo "ERR: beacon hash must be 64 hex chars, no 0x prefix."
    echo "     got: $BEACON_HASH"
    exit 1
fi

command -v snarkjs >/dev/null || { echo "snarkjs required"; exit 1; }

# Find the latest contribution file: amoe_v2_NNNN.zkey with highest NNNN.
LAST_ZKEY="$(ls "$BUILD"/amoe_v2_[0-9][0-9][0-9][0-9].zkey 2>/dev/null | sort | tail -1 || true)"
if [ -z "$LAST_ZKEY" ]; then
    echo "ERR: no amoe_v2_NNNN.zkey files in $BUILD/"
    echo "     Have all contributors submitted?"
    exit 1
fi

OUT_ZKEY="$BUILD/amoe_v2_final.zkey"
if [ -f "$OUT_ZKEY" ]; then
    echo "WARN: $OUT_ZKEY already exists. Move it aside before re-running."
    exit 1
fi

echo "==> AMOE v2 ceremony — Step F (final beacon)"
echo "    Latest contribution: $LAST_ZKEY"
echo "    Beacon block:        $BEACON_HEIGHT"
echo "    Beacon hash:         $BEACON_HASH"
echo "    Iterations:          2^$ITERATIONS"
echo

# 1. Pre-verify.
echo "[finalize] Pre-verify latest contribution chain..."
snarkjs zkey verify \
    "$BUILD/amoe_eligibility.r1cs" \
    "$BUILD/pot14_final.ptau" \
    "$LAST_ZKEY"

# 2. Beacon.
echo
echo "[finalize] Running snarkjs zkey beacon..."
snarkjs zkey beacon "$LAST_ZKEY" "$OUT_ZKEY" \
    "$BEACON_HASH" "$ITERATIONS" \
    --name="final beacon — bitcoin block $BEACON_HEIGHT"

# 3. Post-verify (full chain INCLUDING beacon).
echo
echo "[finalize] Post-verify full chain (with beacon)..."
snarkjs zkey verify \
    "$BUILD/amoe_eligibility.r1cs" \
    "$BUILD/pot14_final.ptau" \
    "$OUT_ZKEY"

# 4. Emit verifier artifacts.
echo
echo "[finalize] Exporting verification key..."
snarkjs zkey export verificationkey "$OUT_ZKEY" "$BUILD/verification_key_v2.json"

echo "[finalize] Emitting Solidity verifier..."
snarkjs zkey export solidityverifier "$OUT_ZKEY" "$BUILD/AmoeGroth16Verifier_v2.sol"

# 5. Append to transcript.
mkdir -p "$(dirname "$TRANSCRIPT")"
{
    echo "----"
    echo "FINAL BEACON"
    echo "Verified at:    $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
    echo "Block height:   $BEACON_HEIGHT"
    echo "Block hash:     $BEACON_HASH"
    echo "Iterations:     2^$ITERATIONS"
    echo "Output zkey:    $(basename "$OUT_ZKEY")"
    echo "zkey SHA-256:   $(sha256sum "$OUT_ZKEY" | cut -d' ' -f1)"
    echo "VK   SHA-256:   $(sha256sum "$BUILD/verification_key_v2.json" | cut -d' ' -f1)"
    echo "Sol  SHA-256:   $(sha256sum "$BUILD/AmoeGroth16Verifier_v2.sol" | cut -d' ' -f1)"
} >> "$TRANSCRIPT"

echo
echo "==> Finalize complete."
echo "    zkey:     $OUT_ZKEY"
echo "    VK json:  $BUILD/verification_key_v2.json"
echo "    Verifier: $BUILD/AmoeGroth16Verifier_v2.sol"
echo "    Transcript: $TRANSCRIPT"
echo
echo "Next: commit the transcript + verifier contract, tag amoe-v2-ceremony-final,"
echo "      and open the follow-up PR replacing MockAmoeGroth16Verifier_v2."
