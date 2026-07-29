#!/usr/bin/env bash
# Resolve a Foundry `out/<File>.sol/<Contract>.json` artifact.
#
# With `auto_detect_solc`, Foundry often emits only versioned artifacts
# (`Contract.0.8.35.json`) and no bare `Contract.json`. Prefer bare when present,
# otherwise the newest versioned artifact via `sort -V` (lexicographic `sort`
# wrongly ranks `0.8.9` above `0.8.34`, which can pick the wrong library initcode
# and CREATE2-link consumers to an empty address).
#
# Usage:
#   source script/lib/resolve_foundry_artifact.sh
#   path="$(resolve_foundry_artifact "$ROOT/out/Foo.sol" "Foo")" || exit 1
#
# Prints the resolved path on stdout. Exit 0 if the file exists, 1 otherwise
# (still prints the expected bare path for error messages).

resolve_foundry_artifact() {
  local dir="$1"
  local contract="$2"
  local bare="${dir}/${contract}.json"

  if [[ -f "$bare" ]]; then
    printf '%s' "$bare"
    return 0
  fi

  local newest=""
  if [[ -d "$dir" ]]; then
    newest="$(ls -1 "$dir"/"$contract".*.json 2>/dev/null | sort -V | tail -1 || true)"
  fi
  if [[ -n "$newest" && -f "$newest" ]]; then
    printf '%s' "$newest"
    return 0
  fi

  printf '%s' "$bare"
  return 1
}
