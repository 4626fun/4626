#!/usr/bin/env bash
# Upgrade live mainnet creator-share-hook to canonical relay_entries / settle_fees bytecode.
#
# Usage:
#   bash scripts/upgrade-mainnet.sh              # dry-run (default)
#   bash scripts/upgrade-mainnet.sh --execute    # perform upgrade
#   bash scripts/upgrade-mainnet.sh --skip-build --execute
#
# Requires on operator host:
#   - Solana CLI (Agave 3.x) on PATH
#   - Upgrade authority keypair matching on-chain Authority
#   - SOLANA_KEYPAIR_PATH or SOLANA_PRIVATE_KEY (base58 or JSON array)
#   - ~3 SOL on deployer for buffer rent (mostly refunded)
#
# See docs/operations/creator-share-hook-mainnet-upgrade.md

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROGRAM_ID="EjpziSWGRcEiDHLXft5etbUtcJiZxEttkwz1tqiuzzWU"
PROGRAM_DATA="DojrYy5obEk2w9ZMpX1bLFHU4rrZqYQsZJZaXFxFGKFU"
EXPECTED_AUTHORITY="7Qi3WW7q4kmqXcMBca76b3WjNMdRmjjjrpG5FTc8htxY"
RPC_URL="${SOLANA_RPC_URL:-https://api.mainnet-beta.solana.com}"
SO="${ROOT}/target/deploy/creator_share_hook.so"
ARTIFACTS="${ROOT}/../../artifacts/creator-share-hook"
EXECUTE=0
SKIP_BUILD=0

for arg in "$@"; do
  case "$arg" in
    --execute) EXECUTE=1 ;;
    --skip-build) SKIP_BUILD=1 ;;
    --help|-h)
      sed -n '2,20p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown arg: $arg (try --help)" >&2
      exit 1
      ;;
  esac
done

if ! command -v solana >/dev/null 2>&1; then
  echo "solana CLI not on PATH" >&2
  exit 1
fi

resolve_keypair() {
  if [[ -n "${SOLANA_KEYPAIR_PATH:-}" ]]; then
    echo "$SOLANA_KEYPAIR_PATH"
    return
  fi
  if [[ -n "${SOLANA_PRIVATE_KEY:-}" ]]; then
    local tmp
    tmp="$(mktemp /tmp/creator-share-hook-upgrade.XXXXXX.json)"
    REPO_ROOT="$(cd "$ROOT/../.." && pwd)"
    SOLANA_KEYPAIR_OUT="$tmp" pnpm -C "$REPO_ROOT/kpr" exec node - <<'NODE'
const fs = require('node:fs')
const bs58Mod = require('bs58')
const decode = bs58Mod.decode ?? bs58Mod.default?.decode
if (typeof decode !== 'function') {
  console.error('bs58 decode unavailable')
  process.exit(1)
}
const out = process.env.SOLANA_KEYPAIR_OUT
if (!out) process.exit(1)
const raw = String(process.env.SOLANA_PRIVATE_KEY ?? '').trim()
if (!raw) process.exit(1)
let sk
if (raw.startsWith('[')) sk = Uint8Array.from(JSON.parse(raw))
else if (fs.existsSync(raw)) sk = Uint8Array.from(JSON.parse(fs.readFileSync(raw, 'utf8')))
else sk = decode(raw)
fs.writeFileSync(out, JSON.stringify(Array.from(sk)))
NODE
    if [[ ! -s "$tmp" ]]; then
      echo "Failed to decode SOLANA_PRIVATE_KEY to keypair JSON" >&2
      rm -f "$tmp"
      exit 1
    fi
    echo "$tmp"
    return
  fi
  solana config get keypair 2>/dev/null | awk '/Keypair Path/ {print $3}' || true
}

KEYPAIR="$(resolve_keypair || true)"
if [[ -z "$KEYPAIR" || ! -f "$KEYPAIR" ]]; then
  echo "Set SOLANA_KEYPAIR_PATH or SOLANA_PRIVATE_KEY (upgrade authority)." >&2
  exit 1
fi

cleanup() {
  if [[ "${KEYPAIR:-}" == /tmp/creator-share-hook-upgrade.* ]]; then
    rm -f "$KEYPAIR"
  fi
}
trap cleanup EXIT

solana config set --url "$RPC_URL" --keypair "$KEYPAIR" >/dev/null

MODE="DRY-RUN"
if [[ "$EXECUTE" -eq 1 ]]; then MODE="EXECUTE"; fi

echo "=== creator-share-hook mainnet upgrade ($MODE) ==="
echo "RPC: $RPC_URL"
echo "Program: $PROGRAM_ID"
echo "Keypair: $KEYPAIR"

if [[ "$SKIP_BUILD" -eq 0 ]]; then
  bash "$ROOT/scripts/build-sbf.sh"
fi

if [[ ! -f "$SO" ]]; then
  echo "Missing $SO — run build-sbf.sh first" >&2
  exit 1
fi

SO_BYTES=$(wc -c <"$SO" | tr -d ' ')
SO_SHA=$(sha256sum "$SO" | awk '{print $1}')
echo "Binary: $SO ($SO_BYTES bytes, sha256=$SO_SHA)"

SHOW=$(solana program show "$PROGRAM_ID")
echo "$SHOW"

AUTHORITY=$(echo "$SHOW" | awk '/Authority:/ {print $2}')
DATA_LEN=$(echo "$SHOW" | awk '/Data Length:/ {print $3}')
LAST_SLOT=$(echo "$SHOW" | awk '/Last Deployed In Slot:/ {print $5}')

if [[ "$AUTHORITY" != "$EXPECTED_AUTHORITY" ]]; then
  echo "Authority mismatch: on-chain=$AUTHORITY expected=$EXPECTED_AUTHORITY" >&2
  exit 1
fi

PUBKEY=$(solana address)
BALANCE=$(solana balance "$PUBKEY" | awk '{print $1}')
echo "Deployer balance: $BALANCE SOL (need ~2.5–3 SOL buffer rent for deploy; mostly refunded after upgrade)"
if [[ "$EXECUTE" -eq 1 ]]; then
  # Rough floor — solana program deploy needs a temporary buffer ~program size.
  if awk "BEGIN { exit !($BALANCE < 2.0) }"; then
    echo "Insufficient SOL on upgrade authority $PUBKEY ($BALANCE SOL). Fund to >= 3 SOL before --execute." >&2
    exit 1
  fi
fi

if [[ "$PUBKEY" != "$EXPECTED_AUTHORITY" ]]; then
  if [[ "$EXECUTE" -eq 1 ]]; then
    echo "Keypair pubkey $PUBKEY != upgrade authority $EXPECTED_AUTHORITY" >&2
    exit 1
  fi
  echo "WARN: keypair $PUBKEY != upgrade authority (OK for dry-run; set SOLANA_PRIVATE_KEY before --execute)"
fi

if [[ "$SO_BYTES" -gt "$DATA_LEN" ]]; then
  EXTRA=$((SO_BYTES - DATA_LEN))
  echo "ProgramData extend required: +$EXTRA bytes ($DATA_LEN -> $SO_BYTES)"
  if [[ "$EXECUTE" -eq 1 ]]; then
    solana program extend "$PROGRAM_ID" "$EXTRA"
  fi
else
  echo "ProgramData capacity OK ($SO_BYTES <= $DATA_LEN bytes)"
fi

mkdir -p "$ARTIFACTS"
BACKUP="$ARTIFACTS/pre-upgrade-${LAST_SLOT}-$(date -u +%Y%m%dT%H%M%SZ).so"
echo "Backing up live bytecode -> $BACKUP"
solana program dump "$PROGRAM_ID" "$BACKUP"
if strings "$BACKUP" | rg -q 'drain_entries|DrainEntries|flush_fees|FlushFees'; then
  echo "Pre-upgrade backup: legacy drain/flush bytecode confirmed"
elif strings "$BACKUP" | rg -q 'relay_entries|RelayEntries'; then
  echo "Pre-upgrade backup already shows relay_entries — chain may already be upgraded"
else
  echo "WARN: could not classify backup bytecode strings" >&2
fi

if [[ "$EXECUTE" -eq 0 ]]; then
  echo ""
  echo "DRY-RUN complete. Re-run with --execute to deploy:"
  echo "  bash scripts/upgrade-mainnet.sh --execute"
  echo ""
  echo "Post-upgrade: pnpm -C frontend ops:verify-hook-mainnet-bytecode (expect canonical)"
  exit 0
fi

echo "Deploying upgrade…"
solana program deploy "$SO" --program-id "$PROGRAM_ID"

POST=$(solana program show "$PROGRAM_ID")
echo "$POST"

POST_SLOT=$(echo "$POST" | awk '/Last Deployed In Slot:/ {print $5}')
DUMP="$ARTIFACTS/post-upgrade-${POST_SLOT}.so"
solana program dump "$PROGRAM_ID" "$DUMP"

if strings "$DUMP" | rg -q 'relay_entries|RelayEntries|SettleFees' \
  && ! strings "$DUMP" | rg -q 'drain_entries|DrainEntries|FlushFees' \
  && strings "$DUMP" | rg -q 'No Token-2022 transfer in progress'; then
  echo "Post-upgrade verify: canonical relay_entries / settle_fees + C-01 hardening bytecode OK"
else
  echo "Post-upgrade verify inconclusive — inspect dump at $DUMP" >&2
  exit 1
fi

echo ""
echo "Next:"
echo "  1. pnpm -C frontend ops:verify-hook-mainnet-bytecode"
echo "  2. orchestrator: SOLANA_HOOK_IX_SCHEMA=canonical (default); restart solana-keeper-orchestrator"
echo "  3. keep SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED=0 until B2 pool verified"
