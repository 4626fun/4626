#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

declare -a violations=()

is_forbidden_path() {
  local path="$1"
  if [[ "$path" =~ ^scripts/.*/\.env[^/]*$ ]]; then
    return 0
  fi
  if [[ "$path" =~ ^scripts/.*/keys(/|$) ]]; then
    return 0
  fi
  if [[ "$path" =~ (^|/)[^/]+\.keypair\.json$ ]]; then
    return 0
  fi
  return 1
}

while IFS= read -r -d '' path; do
  if is_forbidden_path "$path"; then
    violations+=("$path")
  fi
done < <(git ls-files -z)

if ((${#violations[@]} > 0)); then
  echo "ERROR: forbidden tracked files detected."
  echo "Do not commit secrets or key material."
  echo ""
  for path in "${violations[@]}"; do
    echo "- $path"
  done
  echo ""
  echo "Disallowed patterns:"
  echo "- scripts/**/.env*"
  echo "- scripts/**/keys/**"
  echo "- *.keypair.json"
  exit 1
fi

echo "OK: no forbidden tracked secrets/key files detected."

