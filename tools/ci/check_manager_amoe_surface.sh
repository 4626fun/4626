#!/usr/bin/env bash
# CI guard: assert a deployed CreatorLotteryManager exposes the AMOE
# admin/runtime surface.
#
# Background:
#   v1.8.x manager builds (e.g. 0xd593A8A58BDf7E7448D2dAbDE0Ae3B2BAFDA1357,
#   the v1.8.3 mainnet manager) predate PR #395 (Apr 27, 2026) and
#   therefore DO NOT carry the AMOE selectors. A router that points
#   at such a manager will silently deadlock on the first AMOE entry:
#   the router calls `processAmoeEntry(...)` -> the manager has no
#   handler at that 4-byte selector -> EVM falls through to the
#   fallback or reverts with no data, depending on the build.
#
#   This script protects v1.10.1 (and any future release that wires
#   the AMOE router to a manager) by asserting that the manager
#   address actually carries the three required AMOE entrypoints in
#   its deployed bytecode BEFORE the deploy script flips any flags.
#
# What this checks:
#   Given a manager address + RPC endpoint, fetches `eth_getCode`
#   and asserts the following 4-byte selectors all appear at least
#   once as a `PUSH4 <selector>` (0x63 <4 bytes>) opcode anywhere in
#   the runtime code:
#
#     0x565551e4   setAuthorizedAmoeRelayer(address,bool)
#     0x3d5fec31   authorizedAmoeRelayer(address)
#     0x17e184b3   processAmoeEntry((address,bytes32,bytes32,uint256,uint256))
#
#   These are the three selectors that the AMOE router and any
#   AMOE-aware operator script require. Any production manager built
#   from PR #395 or later carries all three; any pre-#395 manager is
#   missing them.
#
# Why match `63 <selector>` and not just the bare selector bytes:
#   Solidity's function dispatcher emits each selector as a `PUSH4`
#   immediately followed by the 4-byte selector. Searching for the
#   bare 4 bytes will produce false positives on calldata constants,
#   immutable inits, or arbitrary embedded data. Matching the PUSH4
#   opcode prefix is the same approach used by `cast selectors` and
#   by `whatsabi`-style ABI extractors.
#
# Usage:
#   tools/ci/check_manager_amoe_surface.sh <manager_address> [<rpc_url>]
#
# Defaults:
#   rpc_url -> https://mainnet.base.org (Base mainnet)
#
# Exit codes:
#   0  manager exposes all three AMOE selectors
#   1  one or more selectors missing (CI should block the deploy)
#   2  RPC error / address has no code / invalid input

set -euo pipefail

usage() {
  cat <<EOF >&2
usage: $0 <manager_address> [<rpc_url>]

example:
  $0 0xd593A8A58BDf7E7448D2dAbDE0Ae3B2BAFDA1357 https://mainnet.base.org
EOF
  exit 2
}

MANAGER="${1:-}"
RPC="${2:-https://mainnet.base.org}"

[ -n "$MANAGER" ] || usage

# Basic 0x... 20-byte address sanity.
if ! [[ "$MANAGER" =~ ^0x[0-9a-fA-F]{40}$ ]]; then
  echo "[FAIL] not a valid 0x-prefixed 20-byte address: $MANAGER" >&2
  exit 2
fi

ok()   { printf '\033[32m[ok]\033[0m   %s\n' "$*"; }
fail() { printf '\033[31m[FAIL]\033[0m %s\n' "$*" >&2; exit 1; }
info() { printf '\033[36m[..]\033[0m   %s\n' "$*"; }

command -v curl >/dev/null 2>&1 || { echo "curl not on PATH" >&2; exit 2; }

# AMOE selectors required for the v1.10.1+ manager.
#   0x565551e4  setAuthorizedAmoeRelayer(address,bool)
#   0x3d5fec31  authorizedAmoeRelayer(address)
#   0x17e184b3  processAmoeEntry((address,bytes32,bytes32,uint256,uint256))
#
# Each entry is "selector_hex|human_name".
SELECTORS=(
  "565551e4|setAuthorizedAmoeRelayer(address,bool)"
  "3d5fec31|authorizedAmoeRelayer(address)"
  "17e184b3|processAmoeEntry((address,bytes32,bytes32,uint256,uint256))"
)

info "fetching deployed code for $MANAGER from $RPC"

PAYLOAD="$(printf '{"jsonrpc":"2.0","id":1,"method":"eth_getCode","params":["%s","latest"]}' "$MANAGER")"

RESP="$(curl -fsS -m 20 -H 'Content-Type: application/json' -d "$PAYLOAD" "$RPC")" || {
  echo "[FAIL] eth_getCode RPC call failed against $RPC" >&2
  exit 2
}

# Extract the "result" field; tolerate the standard JSON layout
# without depending on `jq` (CI runners may not ship it).
CODE="$(printf '%s' "$RESP" | sed -nE 's/.*"result":"(0x[0-9a-fA-F]*)".*/\1/p')"

if [ -z "$CODE" ]; then
  echo "[FAIL] no result field in RPC response: $RESP" >&2
  exit 2
fi

if [ "$CODE" = "0x" ]; then
  echo "[FAIL] address $MANAGER has no deployed code on this RPC ($RPC)." >&2
  exit 2
fi

CODE_NO_PREFIX="${CODE#0x}"
CODE_LEN_BYTES=$(( ${#CODE_NO_PREFIX} / 2 ))
info "deployed code size: ${CODE_LEN_BYTES} bytes"

# Search for each selector as `PUSH4 <selector>` -> `63<selector>`.
MISSING=()
for entry in "${SELECTORS[@]}"; do
  SEL_HEX="${entry%%|*}"
  HUMAN="${entry##*|}"
  PATTERN="63${SEL_HEX}"
  # grep -i so the case difference between RPC casing and our literal
  # doesn't matter; -q because we only care about presence.
  if printf '%s' "$CODE_NO_PREFIX" | grep -qi -- "$PATTERN"; then
    ok "found 0x$SEL_HEX  ($HUMAN)"
  else
    MISSING+=("0x$SEL_HEX  $HUMAN")
  fi
done

if (( ${#MISSING[@]} > 0 )); then
  printf '\n\033[31m[FAIL]\033[0m manager %s is MISSING %d AMOE selector(s):\n' \
    "$MANAGER" "${#MISSING[@]}" >&2
  for m in "${MISSING[@]}"; do
    printf '  - %s\n' "$m" >&2
  done
  printf '\nthis manager predates the AMOE wiring (PR #395). do NOT wire it as\n' >&2
  printf 'the router target for v1.10.1; redeploy the manager from current main.\n' >&2
  exit 1
fi

printf '\n\033[32mall AMOE selectors present on %s\033[0m\n' "$MANAGER"
exit 0
