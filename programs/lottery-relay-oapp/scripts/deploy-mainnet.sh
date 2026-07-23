#!/usr/bin/env bash
# Build, quote, and explicitly deploy the production Solana lottery OApp.
#
# This helper never chooses or generates a program identity. It needs the
# reviewed program identity supplied as LOTTERY_RELAY_OAPP_PROGRAM_ID, and
# defaults to a read-only/compile-only plan. An initial deployment additionally
# needs that identity's keypair; an upgrade needs only the existing program ID
# and its current upgrade-authority signer.
#
# Usage (quote only):
#   LOTTERY_RELAY_OAPP_PROGRAM_ID=<reviewed-new-program-id> \
#   LOTTERY_RELAY_OAPP_PROGRAM_KEYPAIR=/secure/path/program-id.json \
#   SOLANA_KEYPAIR_PATH=/secure/path/payer.json \
#   SOLANA_MAINNET_RPC_URL=<paid-mainnet-rpc> \
#     bash scripts/deploy-mainnet.sh
#
# Omit LOTTERY_RELAY_OAPP_PROGRAM_KEYPAIR when upgrading an existing program.
# A hardened deployment host that does not have Anchor/Rust may use a reviewed
# prebuilt artifact instead:
#   LOTTERY_RELAY_OAPP_SO_PATH=/secure/artifacts/lottery_relay_oapp.so \
#   LOTTERY_RELAY_OAPP_ARTIFACT_SHA256=<reviewed-sha256> \
#     bash scripts/deploy-mainnet.sh
#
# Execute only at the separately announced mainnet mutation boundary:
#   LOTTERY_RELAY_OAPP_DEPLOYMENT_APPROVAL_REF=<durable-approval-reference> \
#     bash scripts/deploy-mainnet.sh --execute

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# A deploy-only host can retain this helper alongside a reviewed artifact
# rather than a complete `programs/lottery-relay-oapp` checkout. Its operator
# must then name the repository root explicitly so temporary signer handling
# can use the existing `kpr` Node dependency without guessing `/`.
REPO_ROOT="${LOTTERY_RELAY_OAPP_REPO_ROOT:-$(cd "$ROOT/../.." && pwd)}"
MAINNET_GENESIS_HASH="5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d"
TEST_ONLY_OAPP_ID="AfLeqn4UzPVeedCTijMcdx7Skb6fbyuYpBEzqGMQUveG"
EXECUTE=0

for arg in "$@"; do
  case "$arg" in
    --execute) EXECUTE=1 ;;
    --help|-h)
      sed -n '2,18p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      exit 1
      ;;
  esac
done

require_env() {
  local name="$1"
  local value="${!name:-}"
  if [[ -z "$value" ]]; then
    echo "Missing required $name" >&2
    exit 1
  fi
  printf '%s' "$value"
}

if ! command -v solana >/dev/null || ! command -v node >/dev/null; then
  echo "solana CLI and node are required" >&2
  exit 1
fi

PROGRAM_ID="$(require_env LOTTERY_RELAY_OAPP_PROGRAM_ID)"
PROGRAM_KEYPAIR="${LOTTERY_RELAY_OAPP_PROGRAM_KEYPAIR:-}"
RPC_URL="${SOLANA_MAINNET_RPC_URL:-${SOLANA_RPC_URL:-}}"
if [[ -z "$RPC_URL" ]]; then
  echo "Missing SOLANA_MAINNET_RPC_URL or SOLANA_RPC_URL" >&2
  exit 1
fi
if [[ -n "$PROGRAM_KEYPAIR" && ! -f "$PROGRAM_KEYPAIR" ]]; then
  echo "LOTTERY_RELAY_OAPP_PROGRAM_KEYPAIR is not a file" >&2
  exit 1
fi
if [[ "$PROGRAM_ID" == "$TEST_ONLY_OAPP_ID" ]]; then
  echo "The Devnet test-only OApp ID is forbidden for mainnet" >&2
  exit 1
fi

if [[ -n "$PROGRAM_KEYPAIR" ]]; then
  DERIVED_PROGRAM_ID="$(solana address -k "$PROGRAM_KEYPAIR")"
  if [[ "$DERIVED_PROGRAM_ID" != "$PROGRAM_ID" ]]; then
    echo "Program keypair derives to $DERIVED_PROGRAM_ID, expected $PROGRAM_ID" >&2
    exit 1
  fi
fi
if [[ "$(solana genesis-hash --url "$RPC_URL")" != "$MAINNET_GENESIS_HASH" ]]; then
  echo "Refusing non-mainnet RPC" >&2
  exit 1
fi

TEMP_PAYER=""
TEMP_BUILD_DIR=""
cleanup() {
  if [[ -n "$TEMP_PAYER" && -f "$TEMP_PAYER" ]]; then rm -f "$TEMP_PAYER"; fi
  if [[ "$TEMP_BUILD_DIR" == /tmp/lottery-relay-oapp-build.* && -d "$TEMP_BUILD_DIR" ]]; then
    rm -rf -- "$TEMP_BUILD_DIR"
  fi
}
trap cleanup EXIT

if [[ -n "${SOLANA_KEYPAIR_PATH:-}" ]]; then
  PAYER="$SOLANA_KEYPAIR_PATH"
elif [[ -n "${SOLANA_PRIVATE_KEY:-}" ]]; then
  TEMP_PAYER="$(mktemp /tmp/lottery-relay-oapp-payer.XXXXXX.json)"
  pnpm -C "$REPO_ROOT/kpr" exec node - <<'NODE' "$TEMP_PAYER"
const fs = require('node:fs')
const bs58Module = require('bs58')
const bs58 = bs58Module.default ?? bs58Module
const output = process.argv[2]
const raw = String(process.env.SOLANA_PRIVATE_KEY ?? '').trim()
let bytes
if (raw.startsWith('[')) bytes = Uint8Array.from(JSON.parse(raw))
else if (fs.existsSync(raw)) bytes = Uint8Array.from(JSON.parse(fs.readFileSync(raw, 'utf8')))
else bytes = bs58.decode(raw)
if (bytes.length !== 64) throw new Error('invalid_solana_private_key')
fs.writeFileSync(output, JSON.stringify(Array.from(bytes)))
NODE
  PAYER="$TEMP_PAYER"
else
  echo "Set SOLANA_KEYPAIR_PATH or SOLANA_PRIVATE_KEY for the deploy payer" >&2
  exit 1
fi
if [[ ! -f "$PAYER" ]]; then
  echo "Deploy payer keypair is not a file" >&2
  exit 1
fi

PAYER_PUBKEY="$(solana address -k "$PAYER")"
if [[ -n "${SOLANA_LOTTERY_OAPP_OPERATOR_PUBKEY:-}" && "$PAYER_PUBKEY" != "$SOLANA_LOTTERY_OAPP_OPERATOR_PUBKEY" ]]; then
  echo "Payer does not match the reviewed SOLANA_LOTTERY_OAPP_OPERATOR_PUBKEY" >&2
  exit 1
fi

# The declared program ID is a compile-time invariant. When this host is the
# build host, produce the production artifact here: no Cargo test-route feature
# is accepted or forwarded. A deploy-only host may instead consume a reviewed,
# hash-pinned prebuilt SBF artifact; it never builds a replacement itself.
echo "=== production lottery OApp deployment plan ($([[ $EXECUTE -eq 1 ]] && echo EXECUTE || echo DRY-RUN)) ==="
echo "RPC: mainnet (genesis verified)"
echo "Program: $PROGRAM_ID"
echo "Payer / proposed upgrade authority: $PAYER_PUBKEY"
PREBUILT_SO="${LOTTERY_RELAY_OAPP_SO_PATH:-}"
if [[ -n "$PREBUILT_SO" ]]; then
  SO="$PREBUILT_SO"
  if [[ ! -f "$SO" ]]; then
    echo "LOTTERY_RELAY_OAPP_SO_PATH is not a file" >&2
    exit 1
  fi
  echo "Using reviewed prebuilt production artifact: $SO"
else
  if ! command -v anchor >/dev/null; then
    echo "anchor is required when LOTTERY_RELAY_OAPP_SO_PATH is not set" >&2
    exit 1
  fi
  echo "Building production artifact (test-route feature is not enabled)…"
  # The program ID comes from a proc macro whose environment is not tracked by
  # Cargo fingerprints. A fresh target directory prevents a cached binary for
  # another ID from being reused; the embedded-byte check below remains the
  # independent enforcement boundary.
  TEMP_BUILD_DIR="$(mktemp -d /tmp/lottery-relay-oapp-build.XXXXXX)"
  (
    cd "$ROOT"
    CARGO_TARGET_DIR="$TEMP_BUILD_DIR" LOTTERY_RELAY_OAPP_ID="$PROGRAM_ID" \
      anchor build --no-idl -p lottery_relay_oapp
  )
  SO="$TEMP_BUILD_DIR/deploy/lottery_relay_oapp.so"
fi
if [[ ! -f "$SO" ]]; then
  echo "Production artifact missing after build: $SO" >&2
  exit 1
fi
SO_BYTES="$(wc -c <"$SO" | tr -d ' ')"
SO_SHA256="$(sha256sum "$SO" | awk '{print $1}')"
if [[ -n "$PREBUILT_SO" ]]; then
  REVIEWED_SO_SHA256="$(require_env LOTTERY_RELAY_OAPP_ARTIFACT_SHA256)"
  if [[ ! "$REVIEWED_SO_SHA256" =~ ^[0-9a-fA-F]{64}$ ]]; then
    echo "LOTTERY_RELAY_OAPP_ARTIFACT_SHA256 must be a SHA-256 hex digest" >&2
    exit 1
  fi
  if [[ "${SO_SHA256,,}" != "${REVIEWED_SO_SHA256,,}" ]]; then
    echo "Prebuilt artifact SHA-256 does not match LOTTERY_RELAY_OAPP_ARTIFACT_SHA256" >&2
    exit 1
  fi
fi

# Anchor bakes `declare_id!` into the ELF.  Do not rely solely on the build
# environment having been set correctly: reject a stale artifact that does not
# contain the exact reviewed program ID before we quote or submit anything.
node - "$SO" "$PROGRAM_ID" <<'NODE'
const fs = require('node:fs')

const [artifactPath, programId] = process.argv.slice(2)
const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
let value = 0n
for (const char of programId) {
  const digit = alphabet.indexOf(char)
  if (digit < 0) throw new Error('program_id_is_not_base58')
  value = value * 58n + BigInt(digit)
}
const bytes = []
while (value > 0n) {
  bytes.push(Number(value & 0xffn))
  value >>= 8n
}
bytes.reverse()
const leadingZeroes = programId.length - programId.replace(/^1+/, '').length
const programIdBytes = Buffer.from([...new Array(leadingZeroes).fill(0), ...bytes])
if (programIdBytes.length !== 32) throw new Error('program_id_decodes_to_wrong_length')
if (fs.readFileSync(artifactPath).indexOf(programIdBytes) < 0) {
  throw new Error('compiled_artifact_does_not_embed_reviewed_program_id')
}
NODE

read_rpc_number() {
  local method="$1"
  local params="$2"
  node - "$RPC_URL" "$method" "$params" <<'NODE'
const [rpc, method, params] = process.argv.slice(2)
fetch(rpc, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: JSON.parse(params) }),
}).then(async (response) => {
  const body = await response.json()
  if (!response.ok || body.error || body.result == null) throw new Error(body.error?.message ?? `rpc_http_${response.status}`)
  process.stdout.write(JSON.stringify(body.result))
}).catch((error) => { process.stderr.write(`RPC quote failed: ${error.message}\n`); process.exit(1) })
NODE
}

# Upgradeable-loader accounts prepend serialized state metadata to the ELF.
# Quote the actual allocated lengths, not just the raw artifact bytes:
# Program = enum tag + ProgramData pubkey (36), ProgramData = tag + slot +
# optional authority (45), Buffer = tag + optional authority (37).
PROGRAM_ACCOUNT_BYTES=36
PROGRAM_DATA_BYTES="$((SO_BYTES + 45))"
BUFFER_BYTES="$((SO_BYTES + 37))"
PROGRAM_ACCOUNT_RENT="$(read_rpc_number getMinimumBalanceForRentExemption "[$PROGRAM_ACCOUNT_BYTES]")"
PROGRAM_DATA_RENT="$(read_rpc_number getMinimumBalanceForRentExemption "[$PROGRAM_DATA_BYTES]")"
BUFFER_RENT="$(read_rpc_number getMinimumBalanceForRentExemption "[$BUFFER_BYTES]")"
PAYER_LAMPORTS="$(read_rpc_number getBalance "[\"$PAYER_PUBKEY\",{\"commitment\":\"finalized\"}]")"
# getBalance returns an object, unlike the rent request.
PAYER_LAMPORTS="$(node -e "const value=JSON.parse(process.argv[1]); if (!Number.isSafeInteger(value.value)) process.exit(1); process.stdout.write(String(value.value))" "$PAYER_LAMPORTS")"

# Do not treat a transient RPC failure (or an occupied non-program address) as
# permission to perform an initial deploy.  The account probe distinguishes a
# genuinely vacant program address from every other error before we decide the
# irreversible deployment mode.
ACCOUNT_PROBE="$(read_rpc_number getAccountInfo "[\"$PROGRAM_ID\",{\"encoding\":\"base64\",\"commitment\":\"finalized\"}]")"
ACCOUNT_EXISTS="$(node -e "const result=JSON.parse(process.argv[1]); if (!Object.hasOwn(result, 'value')) process.exit(1); process.stdout.write(result.value ? '1' : '0')" "$ACCOUNT_PROBE")"
EXISTING="$(solana program show "$PROGRAM_ID" --url "$RPC_URL" 2>/dev/null || true)"
if [[ "$ACCOUNT_EXISTS" == 1 && -z "$EXISTING" ]]; then
  echo "Program address is occupied but is not an upgradeable program; refusing deployment" >&2
  exit 1
fi
if [[ -n "$EXISTING" ]]; then
  MODE="upgrade"
  EXISTING_AUTHORITY="$(printf '%s\n' "$EXISTING" | awk -F: '/Authority:/ {gsub(/^[[:space:]]+/, "", $2); print $2; exit}')"
  if [[ -z "$EXISTING_AUTHORITY" || "$EXISTING_AUTHORITY" != "$PAYER_PUBKEY" ]]; then
    echo "Existing program upgrade authority does not match the deploy payer" >&2
    exit 1
  fi
  EXISTING_PROGRAM_DATA="$(printf '%s\n' "$EXISTING" | awk -F: '/ProgramData Address:/ {gsub(/^[[:space:]]+/, "", $2); print $2; exit}')"
  if [[ -z "$EXISTING_PROGRAM_DATA" ]]; then
    echo "Existing upgradeable program did not report a ProgramData address" >&2
    exit 1
  fi
  PROGRAM_DATA_PROBE="$(read_rpc_number getAccountInfo "[\"$EXISTING_PROGRAM_DATA\",{\"encoding\":\"base64\",\"dataSlice\":{\"offset\":0,\"length\":0},\"commitment\":\"finalized\"}]")"
  PROGRAM_DATA_SNAPSHOT="$(node -e '
const result = JSON.parse(process.argv[1])
const value = result.value
if (!value || !Number.isSafeInteger(value.lamports)) process.exit(1)
const encoded = Array.isArray(value.data) ? value.data[0] : ""
const bytes = Number.isSafeInteger(value.space) ? value.space : Buffer.from(encoded, "base64").length
if (!Number.isSafeInteger(bytes) || bytes <= 0) process.exit(1)
process.stdout.write(`${value.lamports} ${bytes}`)
' "$PROGRAM_DATA_PROBE")"
  read -r EXISTING_PROGRAM_DATA_LAMPORTS EXISTING_PROGRAM_DATA_BYTES <<<"$PROGRAM_DATA_SNAPSHOT"
  echo "Existing program detected; this is an upgrade plan."
  echo "$EXISTING"
else
  MODE="initial-deploy"
  if [[ -z "$PROGRAM_KEYPAIR" ]]; then
    echo "Initial deployment requires LOTTERY_RELAY_OAPP_PROGRAM_KEYPAIR; an existing upgrade does not" >&2
    exit 1
  fi
  echo "No program account exists; this is an initial-deploy plan."
fi

if [[ "$MODE" == initial-deploy ]]; then
  PERSISTENT_RENT_INCREASE="$((PROGRAM_ACCOUNT_RENT + PROGRAM_DATA_RENT))"
else
  if [[ "$EXISTING_PROGRAM_DATA_BYTES" -ge "$PROGRAM_DATA_BYTES" ]]; then
    PERSISTENT_RENT_INCREASE=0
  elif [[ "$PROGRAM_DATA_RENT" -gt "$EXISTING_PROGRAM_DATA_LAMPORTS" ]]; then
    PERSISTENT_RENT_INCREASE="$((PROGRAM_DATA_RENT - EXISTING_PROGRAM_DATA_LAMPORTS))"
  else
    PERSISTENT_RENT_INCREASE=0
  fi
fi
FEE_BUFFER_LAMPORTS="${LOTTERY_RELAY_OAPP_FEE_BUFFER_LAMPORTS:-50000000}"
if [[ ! "$FEE_BUFFER_LAMPORTS" =~ ^[0-9]+$ ]]; then
  echo "LOTTERY_RELAY_OAPP_FEE_BUFFER_LAMPORTS must be a non-negative integer" >&2
  exit 1
fi
REQUIRED_LIQUIDITY="$((PERSISTENT_RENT_INCREASE + BUFFER_RENT + FEE_BUFFER_LAMPORTS))"

cat <<EOF
Artifact: $SO
Artifact bytes: $SO_BYTES
Artifact SHA-256: $SO_SHA256
Program account bytes: $PROGRAM_ACCOUNT_BYTES
Program account rent estimate (lamports): $PROGRAM_ACCOUNT_RENT
ProgramData account bytes: $PROGRAM_DATA_BYTES
ProgramData rent estimate (lamports): $PROGRAM_DATA_RENT
Temporary buffer account bytes: $BUFFER_BYTES
Temporary buffer rent bound (lamports): $BUFFER_RENT
Existing ProgramData bytes: ${EXISTING_PROGRAM_DATA_BYTES:-0}
Existing ProgramData lamports: ${EXISTING_PROGRAM_DATA_LAMPORTS:-0}
Persistent rent increase bound (lamports): $PERSISTENT_RENT_INCREASE
Transaction fee reserve (lamports): $FEE_BUFFER_LAMPORTS
Required payer liquidity bound (lamports): $REQUIRED_LIQUIDITY
Expected post-success refund: the temporary buffer rent returns to the deploy payer when the CLI closes the buffer; persistent Program/ProgramData rent and transaction fees do not
Payer finalized balance (lamports): $PAYER_LAMPORTS
Mode: $MODE
Rollback: $([[ "$MODE" == upgrade ]] && echo "retain a dumped prior .so and perform a separately approved upgrade" || echo "a separately approved permanent solana program close can withdraw program lamports, but irreversibly closes this program ID; leave Store/peer/ULN uninitialized and keep all B2 flags off")
EOF

if [[ "$PAYER_LAMPORTS" -lt "$REQUIRED_LIQUIDITY" ]]; then
  echo "Payer balance is below the persistent rent + temporary buffer + fee liquidity bound" >&2
  exit 1
fi
if [[ "$EXECUTE" -ne 1 ]]; then
  echo "DRY-RUN complete. No Solana transaction was submitted."
  exit 0
fi

APPROVAL_REF="$(require_env LOTTERY_RELAY_OAPP_DEPLOYMENT_APPROVAL_REF)"
if [[ -z "${SOLANA_LOTTERY_OAPP_OPERATOR_PUBKEY:-}" ]]; then
  echo "SOLANA_LOTTERY_OAPP_OPERATOR_PUBKEY is required before execute" >&2
  exit 1
fi
echo "Executing reviewed approval reference: $APPROVAL_REF"
if [[ "$MODE" == initial-deploy ]]; then
  solana program deploy "$SO" --program-id "$PROGRAM_KEYPAIR" --url "$RPC_URL" --keypair "$PAYER"
else
  mkdir -p "$ROOT/artifacts"
  solana program dump "$PROGRAM_ID" "$ROOT/artifacts/pre-upgrade-$(date +%s).so" --url "$RPC_URL"
  solana program deploy "$SO" --program-id "$PROGRAM_ID" --url "$RPC_URL" --keypair "$PAYER"
fi
solana program show "$PROGRAM_ID" --url "$RPC_URL"
echo "Program deployment submitted. Do not initialize Store, peer, nonce, ULN, Base authorization, or any relay flag until separately quoted and approved."
