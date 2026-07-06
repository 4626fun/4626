#!/usr/bin/env bash
# akita-seed-sync.sh
#
# Sync Akitai workspace content between this repo and the Pinata-hosted agent.
# Pinata reads `/home/node/clawd/workspace/`; pull/push uses the agent git remote:
#   git clone https://pinata:<gateway-token>@agents.pinata.cloud/v0/agents/xpm64dc3/git
#
# Modes:
#   list                    Canonical seeds + workspace paths (default).
#   verify-local            Seeds exist and are non-empty.
#   verify-workspace        Full workspace mirror exists and is non-empty.
#   push-pinata [clone]     Copy repo workspace into clone, commit, push to Pinata.
#   pull-pinata [clone]     git pull in clone, then import into repo.
#
# Env: AKITAI_PINATA_BEARER_TOKEN (gateway token from `pinata agents get xpm64dc3`)

set -euo pipefail

AGENT_ID="${AKITAI_PINATA_AGENT_ID:-xpm64dc3}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MONOREPO_ROOT="$(cd "$REPO_ROOT/.." && pwd)"
SEED_DIR="$REPO_ROOT/server/_lib/akita/seed"
WORKSPACE_DIR="$REPO_ROOT/server/_lib/akita/workspace"
DEFAULT_PINATA_CLONE="$MONOREPO_ROOT/agent-akita-${AGENT_ID}"

SEEDS=(SOUL USER MEMORY)
WORKSPACE_MD=(AGENTS HEARTBEAT IDENTITY MEMORY PERSONALITY PLATFORM SOUL TOOLS USER)

load_env() {
  if [[ -f "$REPO_ROOT/.env" ]]; then
    # shellcheck disable=SC1090
    set -a
    source "$REPO_ROOT/.env"
    set +a
  fi
}

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
  if [[ "$missing" -ne 0 ]]; then
    exit 1
  fi
}

pinata_clone_dir() {
  local dir="${1:-$DEFAULT_PINATA_CLONE}"
  if [[ ! -d "$dir/.git" ]]; then
    load_env
    local token="${AKITAI_PINATA_BEARER_TOKEN:-}"
    if [[ -z "$token" ]]; then
      echo "ERROR: set AKITAI_PINATA_BEARER_TOKEN or clone manually to $dir" >&2
      exit 1
    fi
    git clone "https://pinata:${token}@agents.pinata.cloud/v0/agents/${AGENT_ID}/git" "$dir"
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
}

cmd_verify_local() {
  require_seeds
  echo "OK: akita seeds verified"
}

cmd_verify_workspace() {
  require_workspace
  echo "OK: akita workspace verified"
}

cmd_push_pinata() {
  require_workspace
  local clone
  clone="$(pinata_clone_dir "${1:-$DEFAULT_PINATA_CLONE}")"
  load_env
  if [[ -n "${AKITAI_PINATA_BEARER_TOKEN:-}" ]]; then
    git -C "$clone" remote set-url origin \
      "https://pinata:${AKITAI_PINATA_BEARER_TOKEN}@agents.pinata.cloud/v0/agents/${AGENT_ID}/git"
  fi
  mkdir -p "$clone/workspace"
  rsync -a --delete \
    --exclude='.openclaw/' \
    --exclude='memory/' \
    --exclude='avatars/' \
    "$WORKSPACE_DIR/" "$clone/workspace/"
  if [[ -f "$clone/manifest.json" ]]; then
    :
  elif [[ -f "$MONOREPO_ROOT/docs/_internal/operations/alfaclub/akita-pinata-manifest.json" ]]; then
    cp "$MONOREPO_ROOT/docs/_internal/operations/alfaclub/akita-pinata-manifest.json" "$clone/manifest.json"
  fi
  git -C "$clone" add workspace manifest.json 2>/dev/null || git -C "$clone" add workspace
  if git -C "$clone" diff --cached --quiet; then
    echo "No workspace changes to push"
    return 0
  fi
  git -C "$clone" -c user.email="hello@4626.fun" -c user.name="4626 ops" \
    commit -m "chore(akita): sync workspace from repo"
  git -C "$clone" push origin HEAD
  echo "Pushed workspace to Pinata agent ${AGENT_ID}"
}

cmd_import_pinata() {
  local clone="${1:-$DEFAULT_PINATA_CLONE}"
  local src="$clone/workspace"
  if [[ ! -d "$src" ]]; then
    echo "ERROR: missing workspace/ in Pinata clone: $src" >&2
    exit 1
  fi
  rsync -a --delete --exclude='.openclaw/' --exclude='memory/' "$src/" "$WORKSPACE_DIR/"
  for name in "${SEEDS[@]}"; do
    cp "$WORKSPACE_DIR/$name.md" "$SEED_DIR/$name.md"
  done
  echo "Imported workspace from $clone into $WORKSPACE_DIR"
}

cmd_pull_pinata() {
  local clone
  clone="$(pinata_clone_dir "${1:-$DEFAULT_PINATA_CLONE}")"
  load_env
  if [[ -n "${AKITAI_PINATA_BEARER_TOKEN:-}" ]]; then
    git -C "$clone" remote set-url origin \
      "https://pinata:${AKITAI_PINATA_BEARER_TOKEN}@agents.pinata.cloud/v0/agents/${AGENT_ID}/git"
  fi
  git -C "$clone" pull --ff-only
  cmd_import_pinata "$clone"
}

mode="${1:-list}"
shift || true

case "$mode" in
  list) cmd_list ;;
  verify-local) cmd_verify_local ;;
  verify-workspace) cmd_verify_workspace ;;
  push-pinata) cmd_push_pinata "${1:-}" ;;
  import-pinata) cmd_import_pinata "${1:-}" ;;
  pull-pinata) cmd_pull_pinata "${1:-}" ;;
  *)
    echo "Usage: $0 {list|verify-local|verify-workspace|push-pinata|pull-pinata|import-pinata} ..." >&2
    exit 64
    ;;
esac
