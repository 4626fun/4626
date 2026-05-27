#!/usr/bin/env bash
# Deploy creator-share-hook to Solana devnet at the mainnet program id (B2 smoke / cost-probe).
#
# Devnet does not ship this program by default. Requires the program id keypair that
# derives to EjpziSWGRcEiDHLXft5etbUtcJiZxEttkwz1tqiuzzWU (team secret store).
#
# Usage:
#   COST_PROBE_HOOK_PROGRAM_KEYPAIR=/path/to/keypair.json \
#   SOLANA_PRIVATE_KEY=... \
#     bash scripts/deploy-devnet.sh
#
#   bash scripts/deploy-devnet.sh --dry-run

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROGRAM_ID="EjpziSWGRcEiDHLXft5etbUtcJiZxEttkwz1tqiuzzWU"
RPC_URL="${SOLANA_RPC_URL:-${RPC_URL_SOLANA_TESTNET:-https://api.devnet.solana.com}}"
DRY_RUN=0

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --help|-h)
      sed -n '2,18p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown arg: $arg" >&2
      exit 1
      ;;
  esac
done

if ! command -v solana >/dev/null; then
  echo "solana CLI not on PATH" >&2
  exit 1
fi

PROGRAM_KEYPAIR="${COST_PROBE_HOOK_PROGRAM_KEYPAIR:-}"
if [[ -z "$PROGRAM_KEYPAIR" ]]; then
  echo "Set COST_PROBE_HOOK_PROGRAM_KEYPAIR (must match program id $PROGRAM_ID)" >&2
  exit 1
fi
if [[ ! -f "$PROGRAM_KEYPAIR" ]]; then
  echo "COST_PROBE_HOOK_PROGRAM_KEYPAIR not a file: $PROGRAM_KEYPAIR" >&2
  exit 1
fi

DERIVED=$(solana address -k "$PROGRAM_KEYPAIR")
if [[ "$DERIVED" != "$PROGRAM_ID" ]]; then
  echo "Program keypair derives to $DERIVED, expected $PROGRAM_ID" >&2
  exit 1
fi

resolve_payer_keypair() {
  if [[ -n "${SOLANA_KEYPAIR_PATH:-}" ]]; then
    echo "$SOLANA_KEYPAIR_PATH"
    return
  fi
  if [[ -n "${SOLANA_PRIVATE_KEY:-}" ]]; then
    local tmp
    tmp="$(mktemp /tmp/creator-share-hook-devnet.XXXXXX.json)"
    REPO_ROOT="$(cd "$ROOT/../.." && pwd)"
    pnpm -C "$REPO_ROOT/kpr" exec node - <<'NODE' "$tmp"
const fs = require('node:fs')
const bs58 = require('bs58')
const out = process.argv[1]
const raw = String(process.env.SOLANA_PRIVATE_KEY ?? '').trim()
let sk
if (raw.startsWith('[')) sk = Uint8Array.from(JSON.parse(raw))
else if (fs.existsSync(raw)) sk = Uint8Array.from(JSON.parse(fs.readFileSync(raw, 'utf8')))
else sk = bs58.decode(raw)
fs.writeFileSync(out, JSON.stringify(Array.from(sk)))
NODE
    echo "$tmp"
    return
  fi
  solana config get keypair 2>/dev/null | awk '/Keypair Path/ {print $3}' || true
}

PAYER="$(resolve_payer_keypair || true)"
if [[ -z "$PAYER" || ! -f "$PAYER" ]]; then
  echo "Set SOLANA_PRIVATE_KEY or SOLANA_KEYPAIR_PATH for devnet payer" >&2
  exit 1
fi

cleanup() {
  if [[ "${PAYER:-}" == /tmp/creator-share-hook-devnet.* ]]; then
    rm -f "$PAYER"
  fi
}
trap cleanup EXIT

solana config set --url "$RPC_URL" --keypair "$PAYER" >/dev/null

echo "=== deploy creator-share-hook devnet ($([[ $DRY_RUN -eq 1 ]] && echo DRY-RUN || echo EXECUTE)) ==="
echo "RPC: $RPC_URL"
echo "Program id: $PROGRAM_ID"
echo "Payer: $(solana address)"

bash "$ROOT/scripts/build-sbf.sh"
SO="$ROOT/target/deploy/creator_share_hook.so"
SO_BYTES=$(wc -c <"$SO" | tr -d ' ')
echo "Binary: $SO ($SO_BYTES bytes)"

EXISTING=$(solana program show "$PROGRAM_ID" 2>/dev/null || true)
if [[ -n "$EXISTING" ]]; then
  echo "$EXISTING"
  DUMP_TMP="$(mktemp /tmp/hook-devnet-check.XXXXXX.so)"
  if solana program dump "$PROGRAM_ID" "$DUMP_TMP" >/dev/null 2>&1 \
    && strings "$DUMP_TMP" | rg -q 'relay_entries|RelayEntries' \
    && ! strings "$DUMP_TMP" | rg -q 'drain_entries|DrainEntries'; then
    rm -f "$DUMP_TMP"
    echo "Devnet program already deployed with canonical bytecode"
    exit 0
  fi
  rm -f "$DUMP_TMP"
  echo "Upgrading existing devnet program…"
else
  echo "First devnet deploy (program id keypair required)…"
fi

if [[ "$DRY_RUN" -eq 1 ]]; then
  if [[ -n "$EXISTING" ]]; then
    echo "DRY-RUN: solana program deploy $SO --program-id $PROGRAM_ID"
  else
    echo "DRY-RUN: solana program deploy $SO --program-id $PROGRAM_KEYPAIR"
  fi
  exit 0
fi

if [[ -z "$EXISTING" ]]; then
  solana program deploy "$SO" --program-id "$PROGRAM_KEYPAIR"
else
  solana program deploy "$SO" --program-id "$PROGRAM_ID"
fi

echo "Devnet hook deploy complete. Run:"
echo "  pnpm -C frontend ops:pipe-b-devnet-rehearsal -- --live-devnet"
