#!/usr/bin/env bash
# Fail if banned developer task markers appear in first-party paths.
#
# Intentionally NOT scanned (upstream / frozen / generated):
#   lib/, design/audit-source-snapshots/, docs/_generated/, node_modules/
#
# Parser code may still contain the substring "todo" inside regex sources
# (e.g. user message patterns); this script targets comment markers and
# literal TODO:/FIXME: tokens, not every occurrence of those letters.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

PATHS=(frontend/src frontend/api frontend/server contracts programs cre docs apps/docs-site .cursor)
EXISTING=()
for p in "${PATHS[@]}"; do
  [[ -e "$p" ]] && EXISTING+=("$p")
done
[[ ${#EXISTING[@]} -eq 0 ]] && exit 0

GLOBS=(--glob '!**/node_modules/**' --glob '!**/.git/**')

# PCRE2: line-start comment styles, inline markers, markdown "To do" headings (case-insensitive).
# Do not use (?x): in PCRE2 extended mode, # starts a comment and would break # headings / # line comments.
PATTERN_RG='(?mi)(^\s*//+\s*(TODO|FIXME)\b|^\s*#\s*(TODO|FIXME)\b|^\s*\*\s*(TODO|FIXME)\b|^\s*/\*\s*(TODO|FIXME)\b|TODO:|FIXME:|^#{1,6}\s+to\s+do\b)'
PATTERN_GREP='(^[[:space:]]*//+[[:space:]]*(TODO|FIXME)\b|^[[:space:]]*#[[:space:]]*(TODO|FIXME)\b|^[[:space:]]*\*[[:space:]]*(TODO|FIXME)\b|^[[:space:]]*/\*[[:space:]]*(TODO|FIXME)\b|TODO:|FIXME:|^#{1,6}[[:space:]]+to[[:space:]]+do\b)'

if command -v rg >/dev/null 2>&1; then
  set +e
  OUT=$(rg --pcre2 -n -i --color never "$PATTERN_RG" "${EXISTING[@]}" "${GLOBS[@]}" 2>/dev/null)
  CODE=$?
  set -e
else
  set +e
  OUT=$(grep -RInE -i --binary-files=without-match \
    --exclude-dir=node_modules --exclude-dir=.git \
    "$PATTERN_GREP" "${EXISTING[@]}" 2>/dev/null)
  CODE=$?
  set -e
fi

if [[ "$CODE" -eq 0 ]]; then
  echo "Forbidden TODO/FIXME-style markers in first-party paths:" >&2
  echo "$OUT" >&2
  exit 1
fi

if [[ "$CODE" -ne 1 ]]; then
  echo "check-no-todo-markers.sh: scan command exited with code $CODE" >&2
  exit "$CODE"
fi

echo "OK: no banned TODO/FIXME markers in scoped paths."
