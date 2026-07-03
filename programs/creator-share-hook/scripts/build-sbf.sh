#!/usr/bin/env bash
# Build creator-share-hook for Solana deploy (relay_entries / settle_fees bytecode).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

CARGO_BUILD_SBF="${CARGO_BUILD_SBF:-$HOME/.local/share/solana/install/active_release/bin/cargo-build-sbf}"
TOOLS_VERSION="${SBF_TOOLS_VERSION:-v1.52}"

if [[ ! -x "$CARGO_BUILD_SBF" ]]; then
  echo "cargo-build-sbf not found at $CARGO_BUILD_SBF" >&2
  echo "Install Agave/Solana CLI or set CARGO_BUILD_SBF." >&2
  exit 1
fi

if [[ ! -f Cargo.lock ]]; then
  bash "$ROOT/scripts/pin-sbf-deps.sh"
fi

echo "Building creator-share-hook (platform-tools ${TOOLS_VERSION})…"
"$CARGO_BUILD_SBF" --tools-version "$TOOLS_VERSION" "$@"

SO="$ROOT/target/deploy/creator_share_hook.so"
if [[ ! -f "$SO" ]]; then
  echo "Build finished but $SO missing" >&2
  exit 1
fi

if strings "$SO" | rg -q 'relay_entries|RelayEntries'; then
  echo "OK: $SO contains relay_entries bytecode"
else
  echo "WARN: $SO missing relay_entries strings — verify source checkout" >&2
  exit 1
fi

if strings "$SO" | rg -q 'drain_entries|DrainEntries|flush_fees|FlushFees'; then
  echo "WARN: legacy drain/flush strings still present in $SO" >&2
  exit 1
fi

# C-01/H2-06 hardening (July 2026): mid-transfer + mint binding gate
if ! strings "$SO" | rg -q 'No Token-2022 transfer in progress'; then
  echo "WARN: $SO missing C-01 transfer-in-progress gate strings — verify execute_hook.rs checkout" >&2
  exit 1
fi
if ! strings "$SO" | rg -q 'Token account mint does not match the hooked mint'; then
  echo "WARN: $SO missing C-01 mint-mismatch gate strings — verify execute_hook.rs checkout" >&2
  exit 1
fi
echo "OK: C-01 transfer/mint hardening strings present"

ls -la "$SO"
