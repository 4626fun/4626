#!/usr/bin/env bash
# Set VITE_BASE_BUILDER_CODES on the two Vercel projects backing 4626.fun
# and app.4626.fun. Run from your laptop with `vercel login` already done.
#
# Usage:
#   bash scripts/set-builder-codes-vercel.sh
#
# This script is idempotent: if the env var already exists for any target
# environment, it removes it before re-adding so the new value sticks.

set -euo pipefail

WEB_PROJECT_DIR="${WEB_PROJECT_DIR:-.}"          # the repo for 4626.fun (marketing/landing)
APP_PROJECT_DIR="${APP_PROJECT_DIR:-./frontend}" # the repo for app.4626.fun (this repo's frontend)

WEB_BUILDER_CODE="bc_r0gcvt4q"   # 4626.fun
APP_BUILDER_CODE="bc_3qzrlts1"   # app.4626.fun

set_var () {
  local proj_dir="$1"
  local var_name="$2"
  local value="$3"

  pushd "$proj_dir" >/dev/null
  echo ">>> [$proj_dir] linking project (interactive on first run)"
  vercel link --yes >/dev/null 2>&1 || vercel link

  for env in production preview development; do
    echo ">>> [$proj_dir] setting $var_name on $env"
    # Remove existing first (ignore errors if it doesn't exist)
    vercel env rm "$var_name" "$env" --yes >/dev/null 2>&1 || true
    # Add the new value
    printf '%s' "$value" | vercel env add "$var_name" "$env" >/dev/null
  done
  popd >/dev/null
}

echo "=== 4626.fun (marketing site) ==="
set_var "$WEB_PROJECT_DIR" "VITE_BASE_BUILDER_CODES" "$WEB_BUILDER_CODE"

echo "=== app.4626.fun (this repo's frontend/) ==="
set_var "$APP_PROJECT_DIR" "VITE_BASE_BUILDER_CODES" "$APP_BUILDER_CODE"

echo
echo "Done. Trigger a redeploy on each project (push or 'vercel --prod')."
