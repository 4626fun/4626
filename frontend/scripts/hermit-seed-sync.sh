#!/usr/bin/env bash
# hermit-seed-sync.sh
#
# Sync Hermit workspace content between this repo and the Pinata-hosted agent.
# Pinata reads `/home/node/clawd/workspace/`; pull/push uses the agent git remote:
#   git clone https://pinata:<gateway-token>@agents.pinata.cloud/v0/agents/x6bk3ima/git
#
# Modes:
#   list                    Four canonical seeds + full workspace paths (default).
#   bundle <out-dir>        Copy the four seeds only.
#   tar <out-file>          Tarball of the four seeds only.
#   bundle-workspace <dir>  Copy the full workspace tree (md + avatars).
#   tar-workspace <file>    Tarball of the full workspace tree.
#   verify-local            Four seeds exist and are non-empty (CI).
#   verify-workspace        Full workspace mirror exists and is non-empty (CI).
#   diff-local              sha256 summary for the four seeds.
#   diff-workspace          sha256 summary for the full workspace mirror.
#   import-pinata [clone]   Copy workspace/ from a local Pinata git clone into the repo.
#   pull-pinata [clone]     git pull in the clone, then import-pinata.
#
# This script never touches AlfaClub auth, Privy, or alfaclub_runtime_secret.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MONOREPO_ROOT="$(cd "$REPO_ROOT/.." && pwd)"
SEED_DIR="$REPO_ROOT/server/_lib/hermit/seed"
WORKSPACE_DIR="$REPO_ROOT/server/_lib/hermit/workspace"
DEFAULT_PINATA_CLONE="$MONOREPO_ROOT/agent-hermit-x6bk3ima"

SEEDS=(SOUL USER MEMORY SPANISH)
WORKSPACE_MD=(
  AGENTS HEARTBEAT IDENTITY MEMORY PERSONALITY PLATFORM SOUL SPANISH TOOLS USER
)

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

require_workspace() {
  local missing=0
  for name in "${WORKSPACE_MD[@]}"; do
    local path="$WORKSPACE_DIR/$name.md"
    if [[ ! -s "$path" ]]; then
      echo "ERROR: missing or empty workspace file: $path" >&2
      missing=1
    fi
  done
  if [[ ! -s "$WORKSPACE_DIR/avatars/pinnie.png" ]]; then
    echo "ERROR: missing or empty: $WORKSPACE_DIR/avatars/pinnie.png" >&2
    missing=1
  fi
  if [[ "$missing" -ne 0 ]]; then
    exit 1
  fi
}

sync_seeds_from_workspace() {
  for name in "${SEEDS[@]}"; do
    cp "$WORKSPACE_DIR/$name.md" "$SEED_DIR/$name.md"
  done
}

sha256_file() {
  local path="$1"
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$path" | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$path" | awk '{print $1}'
  else
    echo "(no sha256 tool)"
  fi
}

print_file_digest() {
  local label="$1"
  local path="$2"
  local size sha
  size="$(wc -c <"$path" | tr -d ' ')"
  sha="$(sha256_file "$path")"
  printf '%-24s  %8s bytes  %s\n' "$label" "$size" "$sha"
}

pinata_clone_dir() {
  local dir="${1:-$DEFAULT_PINATA_CLONE}"
  if [[ ! -d "$dir/.git" ]]; then
    echo "ERROR: Pinata clone not found at $dir (run: git clone https://pinata:\$HERMIT_PINATA_BEARER_TOKEN@agents.pinata.cloud/v0/agents/x6bk3ima/git agent-hermit-x6bk3ima)" >&2
    exit 1
  fi
  printf '%s' "$dir"
}

cmd_list() {
  for name in "${SEEDS[@]}"; do
    echo "$SEED_DIR/$name.md  ->  /home/node/clawd/workspace/$name.md"
  done
  echo "--- full workspace mirror ---"
  for name in "${WORKSPACE_MD[@]}"; do
    echo "$WORKSPACE_DIR/$name.md  ->  /home/node/clawd/workspace/$name.md"
  done
  echo "$WORKSPACE_DIR/avatars/pinnie.png  ->  /home/node/clawd/workspace/avatars/pinnie.png"
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

cmd_bundle_workspace() {
  local out="${1:-}"
  if [[ -z "$out" ]]; then
    echo "ERROR: bundle-workspace requires <out-dir>" >&2
    exit 1
  fi
  require_workspace
  mkdir -p "$out/avatars"
  for name in "${WORKSPACE_MD[@]}"; do
    cp "$WORKSPACE_DIR/$name.md" "$out/$name.md"
  done
  cp "$WORKSPACE_DIR/avatars/pinnie.png" "$out/avatars/pinnie.png"
  echo "Wrote full Hermit workspace (${#WORKSPACE_MD[@]} md + avatar) to $out"
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

cmd_tar_workspace() {
  local out="${1:-}"
  if [[ -z "$out" ]]; then
    echo "ERROR: tar-workspace requires <out-file>" >&2
    exit 1
  fi
  require_workspace
  tar -czf "$out" -C "$WORKSPACE_DIR" .
  echo "Wrote workspace tarball to $out"
}

cmd_verify_local() {
  require_seeds
  echo "OK: all ${#SEEDS[@]} Hermit seeds present and non-empty."
}

cmd_verify_workspace() {
  require_workspace
  echo "OK: full Hermit workspace mirror present and non-empty."
}

cmd_diff_local() {
  require_seeds
  for name in "${SEEDS[@]}"; do
    print_file_digest "$name.md" "$SEED_DIR/$name.md"
  done
}

cmd_diff_workspace() {
  require_workspace
  for name in "${WORKSPACE_MD[@]}"; do
    print_file_digest "$name.md" "$WORKSPACE_DIR/$name.md"
  done
  print_file_digest "avatars/pinnie.png" "$WORKSPACE_DIR/avatars/pinnie.png"
}

cmd_import_pinata() {
  local clone
  clone="$(pinata_clone_dir "${1:-$DEFAULT_PINATA_CLONE}")"
  local src="$clone/workspace"
  if [[ ! -d "$src" ]]; then
    echo "ERROR: missing workspace/ in Pinata clone: $src" >&2
    exit 1
  fi
  mkdir -p "$WORKSPACE_DIR/avatars"
  rsync -a --delete --exclude='.openclaw/' --exclude='memory/' "$src/" "$WORKSPACE_DIR/"
  sync_seeds_from_workspace
  echo "Imported workspace from $clone into $WORKSPACE_DIR (and refreshed seed/)"
}

cmd_pull_pinata() {
  local clone
  clone="$(pinata_clone_dir "${1:-$DEFAULT_PINATA_CLONE}")"
  if [[ -f "$REPO_ROOT/.env" ]]; then
    # shellcheck disable=SC1090
    set -a
    source "$REPO_ROOT/.env"
    set +a
  fi
  if [[ -n "${HERMIT_PINATA_BEARER_TOKEN:-}" ]]; then
    git -C "$clone" remote set-url origin \
      "https://pinata:${HERMIT_PINATA_BEARER_TOKEN}@agents.pinata.cloud/v0/agents/x6bk3ima/git"
  fi
  git -C "$clone" pull --ff-only
  cmd_import_pinata "$clone"
}

mode="${1:-list}"
shift || true

case "$mode" in
  list) cmd_list ;;
  bundle) cmd_bundle "${1:-}" ;;
  bundle-workspace) cmd_bundle_workspace "${1:-}" ;;
  tar) cmd_tar "${1:-}" ;;
  tar-workspace) cmd_tar_workspace "${1:-}" ;;
  verify-local) cmd_verify_local ;;
  verify-workspace) cmd_verify_workspace ;;
  diff-local) cmd_diff_local ;;
  diff-workspace) cmd_diff_workspace ;;
  import-pinata) cmd_import_pinata "${1:-}" ;;
  pull-pinata) cmd_pull_pinata "${1:-}" ;;
  *)
    echo "Usage: $0 {list|bundle|bundle-workspace|tar|tar-workspace|verify-local|verify-workspace|diff-local|diff-workspace|import-pinata|pull-pinata} ..." >&2
    exit 64
    ;;
esac
