#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
workflows_root="$repo_root/kpr/kpr-workflows"

required_root_files=(
  "$workflows_root/project.yaml"
  "$workflows_root/secrets.yaml"
  "$workflows_root/package.json"
)

for path in "${required_root_files[@]}"; do
  if [[ ! -f "$path" ]]; then
    echo "[kpr-layout] missing required file: $path" >&2
    exit 1
  fi
done

workflow_count=0
for workflow_manifest in "$workflows_root"/*/workflow.yaml; do
  if [[ ! -f "$workflow_manifest" ]]; then
    continue
  fi

  workflow_dir="$(dirname "$workflow_manifest")"
  workflow_name="$(basename "$workflow_dir")"
  workflow_count=$((workflow_count + 1))

  required_workflow_files=(
    "$workflow_dir/package.json"
    "$workflow_dir/tsconfig.json"
    "$workflow_dir/main.ts"
  )

  for required_path in "${required_workflow_files[@]}"; do
    if [[ ! -f "$required_path" ]]; then
      echo "[kpr-layout] $workflow_name is missing $(basename "$required_path")" >&2
      exit 1
    fi
  done

  if [[ ! -f "$workflow_dir/config.staging.json" ]]; then
    echo "[kpr-layout] $workflow_name is missing config.staging.json" >&2
    exit 1
  fi
  if [[ ! -f "$workflow_dir/config.production.json" ]]; then
    echo "[kpr-layout] $workflow_name is missing config.production.json" >&2
    exit 1
  fi
done

if [[ "$workflow_count" -eq 0 ]]; then
  echo "[kpr-layout] no workflow manifests found under $workflows_root" >&2
  exit 1
fi

echo "[kpr-layout] validated $workflow_count workflows"
