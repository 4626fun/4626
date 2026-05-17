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
#   bash amoe/circuits/ceremony/v2/scripts/01-verify-contribution.sh \
#       amoe/circuits/build/amoe_v2_0001.zkey

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../../../.." && pwd)"
BUILD="$ROOT/amoe/circuits/build"
TRANSCRIPT="$ROOT/amoe/circuits/ceremony/v2/ceremony_transcript_v2.txt"

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

# 3. Extract the NEWEST contribution name + 4-line hash from the verify
#    output. snarkjs prints rows like:
#        [INFO]  snarkJS: contribution #2 bob 2026-05-02:
#                AAAA BBBB CCCC DDDD
#                ...
#        [INFO]  snarkJS: contribution #1 alice 2026-05-01:
#                ...
#    Important: snarkjs lists contributions in REVERSE order (newest first),
#    and we want the highest-numbered one. We track the max # seen and only
#    keep the buffer for that block.
NEWEST_BLOCK="$(awk '
    /contribution #[0-9]+ / {
        # Find the "#N name" portion using POSIX match() (RSTART/RLENGTH).
        s = $0
        if (match(s, /#[0-9]+ /) > 0) {
            tail = substr(s, RSTART + 1)            # drop leading "#"
            sp = index(tail, " ")
            cur_num = substr(tail, 1, sp - 1) + 0   # contribution number
            cur_name = substr(tail, sp + 1)         # rest of the line
            sub(/:[[:space:]]*$/, "", cur_name)     # strip trailing colon
            flag=1; n=0; buf=""
        }
        next
    }
    flag && /^[[:space:]]+[0-9a-f]{8}/ {
        buf = (buf == "" ? $0 : buf ORS $0)
        n++
        if (n==4) {
            flag=0
            if (cur_num > max_num) {
                max_num = cur_num
                best_name = cur_name
                best_buf = buf
            }
        }
    }
    END {
        if (max_num > 0) {
            print best_name
            print "---HASH---"
            print best_buf
        }
    }
' "$STRIP_LOG")"

LAST_NAME="$(printf '%s\n' "$NEWEST_BLOCK" | awk '/^---HASH---$/{exit} {print}')"
LAST_HASH_LINES="$(printf '%s\n' "$NEWEST_BLOCK" | awk 'f{print} /^---HASH---$/{f=1}')"

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
