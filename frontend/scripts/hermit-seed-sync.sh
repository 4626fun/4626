#!/usr/bin/env bash
# hermit-seed-sync.sh
#
# Helper for syncing Hermit workspace seed files onto the Pinata-hosted
# Open Claw / Hermit agent. The Pinata side reads files from
# `/home/node/clawd/workspace/`, but this repo has no direct deploy hook
# to that host — the seed files are content-only and shipped manually.
#
# Modes:
#   list                    Print the four canonical seed paths (default).
#   bundle <out-dir>        Copy the four seeds into <out-dir> with
#                           Pinata-target filenames (SOUL.md, USER.md,
#                           MEMORY.md, SPANISH.md). Useful for tarballing
#                           and uploading via Pinata's UI.
#   tar <out-file>          Same as `bundle` but emits a tarball directly.
#   verify-local            Sanity-check that all four files exist and are
#                           non-empty in the repo. Intended for CI.
#   diff-local              Print a per-file size + sha256 summary so a
#                           reviewer can confirm what is about to be shipped.
#
# This script never touches AlfaClub auth, never calls Privy, never writes
# the alfaclub_runtime_secret table. Hermit creative lane only.
#
# Usage:
#   bash frontend/scripts/hermit-seed-sync.sh list
#   bash frontend/scripts/hermit-seed-sync.sh bundle /tmp/hermit-seed/
#   bash frontend/scripts/hermit-seed-sync.sh tar /tmp/hermit-seed.tar.gz
#   bash frontend/scripts/hermit-seed-sync.sh verify-local
#   bash frontend/scripts/hermit-seed-sync.sh diff-local

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SEED_DIR="$REPO_ROOT/server/_lib/hermit/seed"

SEEDS=(SOUL USER MEMORY SPANISH)

require_seeds() {
  local missing=0
  for name in "${SEEDS[@]}"; do
    local path="$SEED_DIR/$name.md"
    if [[ ! -s "$path" ]]; then
      echo "ERROR: missing or empty seed: $path" >&2
      missing=1
    fi
  done
  if [[ "$missing" -ne 0 ]]; then
    exit 1
  fi
}

cmd_list() {
  for name in "${SEEDS[@]}"; do
    echo "$SEED_DIR/$name.md  ->  /home/node/clawd/workspace/$name.md"
  done
}

cmd_bundle() {
  local out="${1:-}"
  if [[ -z "$out" ]]; then
    echo "ERROR: bundle requires <out-dir>" >&2
    exit 1
  fi
  require_seeds
  mkdir -p "$out"
  for name in "${SEEDS[@]}"; do
    cp "$SEED_DIR/$name.md" "$out/$name.md"
  done
  echo "Wrote ${#SEEDS[@]} seeds to $out"
}

cmd_tar() {
  local out="${1:-}"
  if [[ -z "$out" ]]; then
    echo "ERROR: tar requires <out-file>" >&2
    exit 1
  fi
  require_seeds
  local stage
  stage="$(mktemp -d)"
  trap 'rm -rf "$stage"' EXIT
  for name in "${SEEDS[@]}"; do
    cp "$SEED_DIR/$name.md" "$stage/$name.md"
  done
  tar -czf "$out" -C "$stage" .
  echo "Wrote tarball to $out"
}

cmd_verify_local() {
  require_seeds
  echo "OK: all ${#SEEDS[@]} Hermit seeds present and non-empty."
}

cmd_diff_local() {
  require_seeds
  for name in "${SEEDS[@]}"; do
    local path="$SEED_DIR/$name.md"
    local size sha
    size="$(wc -c <"$path" | tr -d ' ')"
    if command -v sha256sum >/dev/null 2>&1; then
      sha="$(sha256sum "$path" | awk '{print $1}')"
    elif command -v shasum >/dev/null 2>&1; then
      sha="$(shasum -a 256 "$path" | awk '{print $1}')"
    else
      sha="(no sha256 tool)"
    fi
    printf '%-12s  %8s bytes  %s\n' "$name.md" "$size" "$sha"
  done
}

mode="${1:-list}"
shift || true

case "$mode" in
  list) cmd_list ;;
  bundle) cmd_bundle "${1:-}" ;;
  tar) cmd_tar "${1:-}" ;;
  verify-local) cmd_verify_local ;;
  diff-local) cmd_diff_local ;;
  *)
    echo "Usage: $0 {list|bundle <out-dir>|tar <out-file>|verify-local|diff-local}" >&2
    exit 64
    ;;
esac
