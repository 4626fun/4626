#!/usr/bin/env bash
set -euo pipefail

if [ -n "${VERCEL_GIT_PREVIOUS_SHA:-}" ] && [ -n "${VERCEL_GIT_COMMIT_SHA:-}" ] \
  && git cat-file -e "${VERCEL_GIT_PREVIOUS_SHA}^{commit}" 2>/dev/null \
  && git cat-file -e "${VERCEL_GIT_COMMIT_SHA}^{commit}" 2>/dev/null; then
  from="$VERCEL_GIT_PREVIOUS_SHA"
  to="$VERCEL_GIT_COMMIT_SHA"
elif git rev-parse --verify HEAD^ >/dev/null 2>&1; then
  from="HEAD^"
  to="HEAD"
else
  # Build on first commit to stay safe.
  exit 1
fi

changed="$(git diff --name-only "$from" "$to")"
if [ -z "$changed" ]; then
  exit 0
fi

while IFS= read -r path; do
  [ -z "$path" ] && continue
  case "$path" in
    docs/*|apps/docs-site/*)
      ;;
    *)
      # Non-docs change found, run the build.
      exit 1
      ;;
  esac
done <<EOF
$changed
EOF

exit 0
