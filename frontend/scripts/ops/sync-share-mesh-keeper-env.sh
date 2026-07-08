#!/usr/bin/env bash
set -euo pipefail

# Sync v1.16.1 share-mesh keeper env to Vercel production.
# Reads codeIds from deployments/base/v1.16.1-bytecode-manifest.json.
#
# Usage (from repo root):
#   ./frontend/scripts/ops/sync-share-mesh-keeper-env.sh
#
# Requires: vercel CLI logged in (`vercel whoami`), frontend linked to akita-llc/4626.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$ROOT_DIR/../../.." && pwd)"
MANIFEST="$REPO_ROOT/deployments/base/v1.16.1-bytecode-manifest.json"
FRONTEND_DIR="$(cd "$ROOT_DIR/../.." && pwd)"

if [[ ! -f "$MANIFEST" ]]; then
  echo "Missing $MANIFEST — run ./script/generate_bytecode_manifest.sh v1.16.1 first" >&2
  exit 1
fi

HOOK_ID="$(python3 -c "import json; print(json.load(open('$MANIFEST'))['contracts']['ApprovedV4HooksRegistry']['codeId'])")"
LP_ID="$(python3 -c "import json; print(json.load(open('$MANIFEST'))['contracts']['OVaultLPManager']['codeId'])")"

# Defaults aligned with frontend/.env + Base mainnet infra.
: "${DEPLOYMENT_BATCHER:=0xA9024e1B89C5Be34502A275576Cc137473d65839}"
: "${V4_POSITION_MANAGER:=0x7c5f5a4bbd8fd63184577525326123b519429bdc}"
: "${V4_TAX_HOOK:=0xca975B9dAF772C71161f3648437c3616E5Be0088}"
: "${PROTOCOL_TREASURY:=0x7d429eCbdcE5ff516D6e0a93299cbBa97203f2d3}"

pushd "$FRONTEND_DIR" >/dev/null

set_var() {
  local name="$1" value="$2"
  echo "→ $name"
  timeout 60 vercel env add "$name" production --value "$value" --force --yes --sensitive
}

set_var DEPLOYMENT_BATCHER "$DEPLOYMENT_BATCHER"
set_var KEEPER_SHARE_MESH_ENABLED 1
set_var KEEPER_SHARE_MESH_DEPLOY_VERSION production
set_var KEEPER_SHARE_MESH_HOOK_REGISTRY_CODE_ID "$HOOK_ID"
set_var KEEPER_SHARE_MESH_LP_MANAGER_CODE_ID "$LP_ID"
set_var V4_POSITION_MANAGER "$V4_POSITION_MANAGER"
set_var V4_TAX_HOOK "$V4_TAX_HOOK"
set_var PROTOCOL_TREASURY "$PROTOCOL_TREASURY"

popd >/dev/null
echo "Share-mesh keeper env synced to Vercel production."
