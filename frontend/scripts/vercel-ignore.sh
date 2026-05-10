#!/usr/bin/env bash
set -euo pipefail

# Only main builds. vercel.json enforces this at the platform level
# (`git.deploymentEnabled: { main: true }`), so non-main refs normally
# never reach this script — this case is a belt-and-suspenders guard for
# manual CLI deploys or config drift.
case "${VERCEL_GIT_COMMIT_REF:-}" in
  main|refs/heads/main|"")
    ;;
  *)
    exit 0
    ;;
esac

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

# Manual override for env-only rotations or operational rebuilds.
# Usage: include "[force-vercel]" in the commit message.
commit_message="${VERCEL_GIT_COMMIT_MESSAGE:-}"
if [ -z "$commit_message" ]; then
  commit_message="$(git log -1 --pretty=%B "$to" 2>/dev/null || true)"
fi
if printf '%s' "$commit_message" | grep -Fq '[force-vercel]'; then
  exit 1
fi

changed="$(git diff --name-only "$from" "$to")"
if [ -z "$changed" ]; then
  exit 0
fi

while IFS= read -r path; do
  [ -z "$path" ] && continue
  case "$path" in
    # Build only when the frontend deploy surface changes.
    frontend/*|.vercelignore)
      exit 1
      ;;
    *)
      ;;
  esac
done <<EOF
$changed
EOF

exit 0
