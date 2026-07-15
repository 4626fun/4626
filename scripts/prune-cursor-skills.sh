#!/usr/bin/env bash
# Disable global Cursor/Codex skills outside the 4626 allowlist.
# Cursor only discovers files named exactly SKILL.md — rename to SKILL.md.disabled.
# Reversible: bash scripts/prune-cursor-skills.sh --restore
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Global skills to keep enabled (name = parent folder of SKILL.md)
ALLOWLIST=(
  gh-fix-ci
  gh-address-comments
  supabase
  supabase-postgres-best-practices
  use-railway
)

GLOBAL_ROOTS=(
  "$HOME/.codex/skills"
  "$HOME/.agents/skills"
  "$HOME/.cursor/skills"
  "$HOME/.claude/skills"
)

is_allowed() {
  local name="$1"
  for allowed in "${ALLOWLIST[@]}"; do
    if [[ "$name" == "$allowed" ]]; then
      return 0
    fi
  done
  return 1
}

skill_name_from_path() {
  local skill_file="$1"
  basename "$(dirname "$skill_file")"
}

disable_skill() {
  local skill_file="$1"
  if [[ -f "$skill_file" ]]; then
    mv "$skill_file" "${skill_file}.disabled"
    echo "  disabled: $skill_file"
  fi
}

enable_skill() {
  local disabled_file="$1"
  if [[ -f "$disabled_file" ]]; then
    mv "$disabled_file" "${disabled_file%.disabled}"
    echo "  restored: ${disabled_file%.disabled}"
  fi
}

if [[ "${1:-}" == "--restore" ]]; then
  echo "== Restoring all global SKILL.md.disabled files =="
  for root in "${GLOBAL_ROOTS[@]}"; do
    [[ -d "$root" ]] || continue
    while IFS= read -r -d '' f; do
      enable_skill "$f"
    done < <(find "$root" -name 'SKILL.md.disabled' -print0 2>/dev/null)
  done
  echo "Done. Reload Cursor window."
  exit 0
fi

echo "== Pruning global skills to 4626 allowlist =="
echo "Allowlist: ${ALLOWLIST[*]}"
echo "Project skills under $ROOT/.cursor/skills/ are unchanged."
echo

disabled_count=0
for root in "${GLOBAL_ROOTS[@]}"; do
  [[ -d "$root" ]] || continue
  echo "Scanning $root ..."
  while IFS= read -r -d '' skill_file; do
    # Skip Codex system skills
    if [[ "$skill_file" == *"/.system/"* ]]; then
      continue
    fi
    name="$(skill_name_from_path "$skill_file")"
    if is_allowed "$name"; then
      echo "  keep: $name"
      continue
    fi
    disable_skill "$skill_file"
    disabled_count=$((disabled_count + 1))
  done < <(find "$root" -name 'SKILL.md' -print0 2>/dev/null)
done

echo
echo "Disabled $disabled_count global skill(s)."
echo "Reload Cursor window (Developer: Reload Window) to apply."
echo "Restore all: bash scripts/prune-cursor-skills.sh --restore"
