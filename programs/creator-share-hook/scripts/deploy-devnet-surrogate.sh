#!/usr/bin/env bash
# Build and deploy an explicitly noncanonical creator-share-hook program for
# devnet/local rehearsal only. This exists solely when the canonical program-id
# keypair cannot be recovered; it must never be used for mainnet or production.
#
# The Anchor program ID is compiled into the binary and owns the Transfer Hook
# extra-account-meta PDA. Therefore a canonical binary cannot safely be copied
# to an arbitrary program address. This helper copies the reviewed source to a
# temporary directory and changes exactly its declare_id! value before building.
#
# Required:
#   SOLANA_DEVNET_HOOK_PROGRAM_ID=<new noncanonical devnet pubkey>
#   SOLANA_DEVNET_HOOK_PROGRAM_KEYPAIR=/secure/path/to/that-keypair.json
#
# Optional:
#   SOLANA_DEVNET_HOOK_SO_PATH=/secure/artifacts/creator-share-hook-devnet.so
#   SOLANA_KEYPAIR_PATH=/secure/path/to/devnet-payer.json
#   SOLANA_PRIVATE_KEY=<base58, json, or keypair path>
#
# Modes:
#   --dry-run  (default) validates inputs and prints the one future deploy tx
#   --build    builds the isolated artifact but sends no Solana transaction
#   --execute  builds and deploys a new address after explicit operator approval
#   --upgrade-existing --execute
#              upgrades an existing surrogate only after a separate explicit gate

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CANONICAL_PROGRAM_ID="EjpziSWGRcEiDHLXft5etbUtcJiZxEttkwz1tqiuzzWU"
RPC_URL="${SOLANA_DEVNET_RPC_URL:-${RPC_URL_SOLANA_TESTNET:-${SOLANA_RPC_URL:-https://api.devnet.solana.com}}}"
MODE="dry-run"
UPGRADE_EXISTING=0

for arg in "$@"; do
  case "$arg" in
    --dry-run) MODE="dry-run" ;;
    --build) MODE="build" ;;
    --execute) MODE="execute" ;;
    --upgrade-existing) UPGRADE_EXISTING=1 ;;
    --help|-h)
      sed -n '2,27p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown arg: $arg" >&2
      exit 2
      ;;
  esac
done

if [[ ! "$RPC_URL" =~ (devnet|testnet|localhost|127\.0\.0\.1) ]]; then
  echo "Refusing non-devnet/local RPC for surrogate hook: $RPC_URL" >&2
  exit 2
fi
if ! command -v solana >/dev/null; then
  echo "solana CLI not on PATH" >&2
  exit 2
fi

PROGRAM_ID="${SOLANA_DEVNET_HOOK_PROGRAM_ID:-}"
if [[ -z "$PROGRAM_ID" ]]; then
  echo "Set SOLANA_DEVNET_HOOK_PROGRAM_ID to the noncanonical devnet program public address" >&2
  exit 2
fi
if [[ "$PROGRAM_ID" == "$CANONICAL_PROGRAM_ID" ]]; then
  echo "Use deploy-devnet.sh for the canonical address; this surrogate helper refuses Ejpzi…" >&2
  exit 2
fi
PROGRAM_KEYPAIR="${SOLANA_DEVNET_HOOK_PROGRAM_KEYPAIR:-}"
if [[ -n "$PROGRAM_KEYPAIR" ]]; then
  if [[ ! -f "$PROGRAM_KEYPAIR" ]]; then
    echo "SOLANA_DEVNET_HOOK_PROGRAM_KEYPAIR is not a file: $PROGRAM_KEYPAIR" >&2
    exit 2
  fi
  DERIVED_PROGRAM_ID="$(solana address -k "$PROGRAM_KEYPAIR")"
  if [[ "$DERIVED_PROGRAM_ID" != "$PROGRAM_ID" ]]; then
    echo "Devnet surrogate keypair derives to $DERIVED_PROGRAM_ID, expected $PROGRAM_ID" >&2
    exit 2
  fi
fi

DEFAULT_SO="$ROOT/target/devnet-surrogate/creator_share_hook-${PROGRAM_ID}.so"
OUTPUT_SO="${SOLANA_DEVNET_HOOK_SO_PATH:-$DEFAULT_SO}"
DEFAULT_ROLLBACK_SO="${OUTPUT_SO%.so}-preupgrade.so"
ROLLBACK_SO="${SOLANA_DEVNET_HOOK_ROLLBACK_SO_PATH:-$DEFAULT_ROLLBACK_SO}"
CANONICAL_SO="$ROOT/target/deploy/creator_share_hook.so"
if [[ "$OUTPUT_SO" == "$CANONICAL_SO" ]]; then
  echo "Surrogate artifact path must not overwrite the canonical build artifact" >&2
  exit 2
fi

resolve_payer_keypair() {
  if [[ -n "${SOLANA_KEYPAIR_PATH:-}" ]]; then
    printf '%s\n' "$SOLANA_KEYPAIR_PATH"
    return
  fi
  if [[ -n "${SOLANA_PRIVATE_KEY:-}" ]]; then
    local tmp repo_root
    tmp="$(mktemp /tmp/creator-share-hook-devnet-payer.XXXXXX.json)"
    repo_root="$(cd "$ROOT/../.." && pwd)"
    if ! pnpm -C "$repo_root/kpr" exec node - <<'NODE' "$tmp"; then
const fs = require('node:fs')
const bs58Module = require('bs58')
const bs58 = bs58Module.default ?? bs58Module
const out = process.argv[2]
const raw = String(process.env.SOLANA_PRIVATE_KEY ?? '').trim()
let secretKey
if (raw.startsWith('[')) secretKey = Uint8Array.from(JSON.parse(raw))
else if (fs.existsSync(raw)) secretKey = Uint8Array.from(JSON.parse(fs.readFileSync(raw, 'utf8')))
else secretKey = bs58.decode(raw)
if (secretKey.length !== 64) throw new Error('solana_private_key_invalid')
fs.writeFileSync(out, JSON.stringify(Array.from(secretKey)), { mode: 0o600 })
NODE
      rm -f "$tmp"
      return 1
    fi
    printf '%s\n' "$tmp"
    return
  fi
  solana config get keypair 2>/dev/null | awk '/Keypair Path/ {print $3}' || true
}

build_surrogate() {
  local work source_id built_so output_dir strings_file
  source_id="$(sed -n -E 's/^[[:space:]]*declare_id!\("([^"]+)"\);/\1/p' "$ROOT/src/lib.rs")"
  if [[ "$source_id" != "$CANONICAL_PROGRAM_ID" ]]; then
    echo "Refusing surrogate build: repository source no longer declares the verified canonical ID" >&2
    exit 2
  fi
  work="$(mktemp -d /tmp/4626-creator-share-hook-surrogate.XXXXXX)"
  trap 'rm -rf "$work"' RETURN
  cp -a "$ROOT/.cargo" "$ROOT/Cargo.toml" "$ROOT/Cargo.lock" "$ROOT/src" "$work/"
  perl -0pi -e "s/declare_id!\\(\"[^\"]+\"\\);/declare_id!(\"${PROGRAM_ID}\");/" "$work/src/lib.rs"
  if ! grep -Fq "declare_id!(\"${PROGRAM_ID}\");" "$work/src/lib.rs"; then
    echo "Surrogate program-id replacement failed" >&2
    exit 2
  fi
  CARGO_BUILD_SBF="${CARGO_BUILD_SBF:-$HOME/.local/share/solana/install/active_release/bin/cargo-build-sbf}"
  if [[ ! -x "$CARGO_BUILD_SBF" ]]; then
    echo "cargo-build-sbf not found; set CARGO_BUILD_SBF" >&2
    exit 2
  fi
  echo "Building isolated devnet surrogate for $PROGRAM_ID"
  (
    cd "$work"
    "$CARGO_BUILD_SBF" --tools-version "${SBF_TOOLS_VERSION:-v1.52}"
  )
  built_so="$work/target/deploy/creator_share_hook.so"
  if [[ ! -f "$built_so" ]]; then
    echo "Surrogate build finished without creator_share_hook.so" >&2
    exit 2
  fi
  strings_file="$work/creator_share_hook.strings"
  strings "$built_so" > "$strings_file"
  if ! rg -q 'relay_entries|RelayEntries' "$strings_file"; then
    echo "Surrogate binary is missing relay_entries" >&2
    exit 2
  fi
  if rg -q 'drain_entries|DrainEntries|flush_fees|FlushFees' "$strings_file"; then
    echo "Surrogate binary contains retired relay instructions" >&2
    exit 2
  fi
  if ! rg -q 'No Token-2022 transfer in progress' "$strings_file"; then
    echo "Surrogate binary is missing the C-01 transfer-in-progress gate" >&2
    exit 2
  fi
  if ! rg -q 'Token account mint does not match the hooked mint' "$strings_file"; then
    echo "Surrogate binary is missing the C-01 mint-binding gate" >&2
    exit 2
  fi
  output_dir="$(dirname "$OUTPUT_SO")"
  mkdir -p "$output_dir"
  install -m 0600 "$built_so" "$OUTPUT_SO"
  echo "Surrogate artifact: $OUTPUT_SO"
  echo "Program ID compiled into source: $PROGRAM_ID"
  sha256sum "$OUTPUT_SO"
}

echo "=== creator-share-hook devnet surrogate ($MODE) ==="
echo "RPC: $RPC_URL"
echo "Surrogate program ID: $PROGRAM_ID"
echo "Artifact: $OUTPUT_SO"
echo "Canonical mainnet program remains: $CANONICAL_PROGRAM_ID"

EXISTING="$(solana program show "$PROGRAM_ID" --url "$RPC_URL" 2>/dev/null || true)"

if [[ "$MODE" == "dry-run" ]]; then
  echo "DRY-RUN: build an isolated artifact with only declare_id! changed to $PROGRAM_ID"
  if [[ -n "$EXISTING" ]]; then
    echo "DRY-RUN: existing surrogate found; --upgrade-existing --execute would submit solana program deploy $OUTPUT_SO --program-id $PROGRAM_ID --url $RPC_URL"
    echo "DRY-RUN: first dump the current devnet bytes to $ROLLBACK_SO for rollback"
  else
    if [[ -z "$PROGRAM_KEYPAIR" ]]; then
      echo "A new deployment needs SOLANA_DEVNET_HOOK_PROGRAM_KEYPAIR that derives to $PROGRAM_ID" >&2
      exit 2
    fi
    echo "DRY-RUN: solana program deploy $OUTPUT_SO --program-id $PROGRAM_KEYPAIR --url $RPC_URL"
  fi
  echo "No transaction, account, keypair, or artifact was created."
  exit 0
fi

build_surrogate
if [[ "$MODE" == "build" ]]; then
  echo "Build complete; no Solana transaction was submitted."
  exit 0
fi

PAYER="$(resolve_payer_keypair || true)"
if [[ -z "$PAYER" || ! -f "$PAYER" ]]; then
  echo "Set SOLANA_PRIVATE_KEY or SOLANA_KEYPAIR_PATH to a funded devnet payer before --execute" >&2
  exit 2
fi
cleanup() {
  if [[ "$PAYER" == /tmp/creator-share-hook-devnet-payer.* ]]; then rm -f "$PAYER"; fi
  if [[ -n "${ONCHAIN_DUMP:-}" && -f "$ONCHAIN_DUMP" ]]; then rm -f "$ONCHAIN_DUMP"; fi
}
trap cleanup EXIT

PAYER_ADDRESS="$(solana address -k "$PAYER")"
if [[ -n "$EXISTING" ]]; then
  if [[ "$UPGRADE_EXISTING" -ne 1 ]]; then
    echo "Existing surrogate requires --upgrade-existing together with --execute; no transaction was submitted." >&2
    exit 2
  fi
  EXISTING_AUTHORITY="$(printf '%s\n' "$EXISTING" | awk -F': ' '/^Authority:/ {print $2}')"
  if [[ -z "$EXISTING_AUTHORITY" || "$EXISTING_AUTHORITY" != "$PAYER_ADDRESS" ]]; then
    echo "Surrogate upgrade authority does not match the configured payer" >&2
    exit 2
  fi
  if [[ -e "$ROLLBACK_SO" ]]; then
    echo "Rollback artifact already exists; choose a new SOLANA_DEVNET_HOOK_ROLLBACK_SO_PATH rather than overwrite it" >&2
    exit 2
  fi
  mkdir -p "$(dirname "$ROLLBACK_SO")"
  solana program dump "$PROGRAM_ID" "$ROLLBACK_SO" --url "$RPC_URL" >/dev/null
  if [[ ! -s "$ROLLBACK_SO" ]]; then
    echo "Pre-upgrade rollback bytecode capture failed" >&2
    exit 2
  fi
  echo "Pre-upgrade rollback artifact: $ROLLBACK_SO"
  sha256sum "$ROLLBACK_SO"
  echo "Submitting one devnet program upgrade. It creates a temporary deploy buffer; the existing Program/ProgramData accounts remain."
  solana program deploy "$OUTPUT_SO" --program-id "$PROGRAM_ID" --url "$RPC_URL" --keypair "$PAYER"
else
  if [[ -z "$PROGRAM_KEYPAIR" ]]; then
    echo "A new deployment requires SOLANA_DEVNET_HOOK_PROGRAM_KEYPAIR" >&2
    exit 2
  fi
  echo "Submitting one devnet program deployment. It creates the upgradeable Program/ProgramData accounts."
  solana program deploy "$OUTPUT_SO" --program-id "$PROGRAM_KEYPAIR" --url "$RPC_URL" --keypair "$PAYER"
fi
solana program show "$PROGRAM_ID" --url "$RPC_URL"
ONCHAIN_DUMP="$(mktemp /tmp/4626-devnet-surrogate-onchain.XXXXXX.so)"
solana program dump "$PROGRAM_ID" "$ONCHAIN_DUMP" --url "$RPC_URL" >/dev/null
node - "$OUTPUT_SO" "$ONCHAIN_DUMP" <<'NODE'
const fs = require('node:fs')
const artifact = fs.readFileSync(process.argv[2])
const deployed = fs.readFileSync(process.argv[3])
const prefixMatches = deployed.length >= artifact.length && deployed.subarray(0, artifact.length).equals(artifact)
const padding = deployed.subarray(artifact.length)
const zeroPadding = padding.every((byte) => byte === 0)
if (!prefixMatches || !zeroPadding) {
  process.stderr.write('On-chain devnet surrogate executable does not match the built artifact\n')
  process.exit(2)
}
process.stdout.write(`Exact executable match; retained zero padding bytes: ${padding.length}\n`)
NODE
echo "Devnet surrogate deployment complete. Keep all production relay/OApp/winner flags disabled."
