#!/usr/bin/env bash
# Unit checks for resolve_foundry_artifact.sh (no forge build required).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck source=script/lib/resolve_foundry_artifact.sh
source "$ROOT_DIR/script/lib/resolve_foundry_artifact.sh"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

dir="$TMP/CreatorOracle.sol"
mkdir -p "$dir"

# Prefer bare when present.
touch "$dir/CreatorOracle.json" "$dir/CreatorOracle.0.8.35.json"
got="$(resolve_foundry_artifact "$dir" "CreatorOracle")" || fail "bare should resolve"
[[ "$got" == "$dir/CreatorOracle.json" ]] || fail "expected bare, got $got"
rm -f "$dir/CreatorOracle.json"

# Semver newest (not lex): 0.8.9 must not beat 0.8.35.
touch "$dir/CreatorOracle.0.8.9.json" "$dir/CreatorOracle.0.8.35.json" "$dir/CreatorOracle.0.8.30.json"
got="$(resolve_foundry_artifact "$dir" "CreatorOracle")" || fail "versioned should resolve"
[[ "$got" == "$dir/CreatorOracle.0.8.35.json" ]] || fail "expected 0.8.35 via sort -V, got $got"

# Missing → exit 1, still prints expected bare path.
rm -f "$dir"/CreatorOracle.*.json
set +e
got="$(resolve_foundry_artifact "$dir" "CreatorOracle")"
rc=$?
set -e
[[ "$rc" -eq 1 ]] || fail "expected exit 1 for missing artifact"
[[ "$got" == "$dir/CreatorOracle.json" ]] || fail "expected bare path on miss, got $got"

# Simulate the frontend generator footgun: printf "$(exit 1)" must not be the
# only failure mode — callers must assign then check.
empty_hex=""
if [[ -z "$empty_hex" || ! "$empty_hex" =~ ^[0-9a-fA-F]+$ ]]; then
  :
else
  fail "empty hex should fail the hex guard"
fi

echo "OK: resolve_foundry_artifact checks passed"
