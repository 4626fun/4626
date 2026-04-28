#!/usr/bin/env bash
# AMOE v2 ceremony — Step 1..N (per-contribution verification).
#
# After a contributor returns amoe_v2_<N>.zkey, the coordinator runs this
# script to:
#   - confirm the full chain still verifies against (R1CS, ptau)
#   - extract the contribution name + hash from the new zkey
#   - append a row to ceremony_transcript_v2.txt
#
# Cross-check the printed contribution hash against what the contributor
# posted publicly. They MUST match.
#
# Usage:
#   bash circuits/amoe/ceremony/v2/scripts/01-verify-contribution.sh \
#       circuits/amoe/build/amoe_v2_0001.zkey

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../../../.." && pwd)"
BUILD="$ROOT/circuits/amoe/build"
TRANSCRIPT="$ROOT/circuits/amoe/ceremony/v2/ceremony_transcript_v2.txt"

if [ $# -ne 1 ]; then
    echo "usage: $0 <path/to/amoe_v2_NNNN.zkey>"
    exit 1
fi

ZKEY="$1"
[ -f "$ZKEY" ] || { echo "ERR: $ZKEY not found"; exit 1; }

command -v snarkjs >/dev/null || { echo "snarkjs required"; exit 1; }

echo "==> Verifying $(basename "$ZKEY")"
echo

# 1. Verify the full chain. Capture output for hash extraction.
CHAIN_LOG="$(mktemp)"
trap 'rm -f "$CHAIN_LOG"' EXIT

echo "[verify] snarkjs zkey verify ..."
snarkjs zkey verify \
    "$BUILD/amoe_eligibility.r1cs" \
    "$BUILD/pot14_final.ptau" \
    "$ZKEY" 2>&1 | tee "$CHAIN_LOG"

if ! grep -q "ZKey Ok!" "$CHAIN_LOG"; then
    echo
    echo "ERR: zkey verify did not report 'ZKey Ok!' — refusing to record"
    echo "     this contribution. Inspect the output above."
    exit 1
 fi

# 2. Strip ANSI escape codes from the log so awk can match cleanly.
STRIP_LOG="$(mktemp)"
sed -E 's/\x1B\[[0-9;]*[A-Za-z]//g' "$CHAIN_LOG" > "$STRIP_LOG"

# 3. Extract the LAST contribution name + 4-line hash from the verify
#    output. snarkjs prints rows like:
#        [INFO]  snarkJS: contribution #2 alice 2026-05-01:
#                AAAA BBBB CCCC DDDD
#                EEEE FFFF GGGG HHHH
#                IIII JJJJ KKKK LLLL
#                MMMM NNNN OOOO PPPP
LAST_NAME="$(awk -F'contribution #[0-9]+ ' '/contribution #[0-9]+ /{n=$2} END{sub(/:[[:space:]]*$/, "", n); print n}' "$STRIP_LOG")"
LAST_HASH_LINES="$(awk '
    /contribution #[0-9]+ /{ flag=1; n=0; next }
    flag && /^[[:space:]]+[0-9a-f]{8}/ { print; n++; if (n==4) flag=0 }
' "$STRIP_LOG")"

rm -f "$STRIP_LOG"

# 4. Append to transcript.
mkdir -p "$(dirname "$TRANSCRIPT")"
{
    echo "----"
    echo "File:        $(basename "$ZKEY")"
    echo "Verified at: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
    echo "Name:        ${LAST_NAME:-(unparsed — inspect manually)}"
    echo "SHA-256:     $(sha256sum "$ZKEY" | cut -d' ' -f1)"
    echo "Latest hash:"
    echo "$LAST_HASH_LINES"
} >> "$TRANSCRIPT"

echo
echo "==> Verification complete."
echo "    Appended to: $TRANSCRIPT"
echo
echo "Cross-check the 'Latest hash' above against what the contributor posted publicly."
echo "If they don't match — STOP. Discard this contribution and re-issue the input."
