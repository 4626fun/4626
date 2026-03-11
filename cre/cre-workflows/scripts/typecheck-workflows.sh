#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
workflows_root="$repo_root/cre/cre-workflows"

cleanup() {
  rm -rf "$workflows_root/node_modules"
}
trap cleanup EXIT

pnpm -C "$workflows_root" install --ignore-scripts --lockfile=false

for cfg in "$workflows_root"/*/tsconfig.json; do
  if [[ ! -f "$cfg" ]]; then
    continue
  fi
  rel_cfg="${cfg#"$workflows_root"/}"
  echo "[cre-typecheck] $rel_cfg"
  pnpm -C "$workflows_root" exec tsc --noEmit -p "$rel_cfg"
done
