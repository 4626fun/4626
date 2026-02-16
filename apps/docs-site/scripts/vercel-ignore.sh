#!/usr/bin/env bash
set -euo pipefail

# Production-only deployments: skip all preview environment builds.
if [ "${VERCEL_ENV:-}" = "preview" ]; then
  exit 0
fi

prefix="$(git rev-parse --show-prefix 2>/dev/null || true)"
target_prefix="apps/docs-site/"
if [ -n "$prefix" ]; then
  target_prefix="$prefix"
fi

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
    "$target_prefix"*)
      exit 1
      ;;
  esac
done <<EOF
$changed
EOF

exit 0
