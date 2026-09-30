#!/usr/bin/env bash
# Empty-workspace bootstrap for the Phase 1 batcher finalize snapshot.
# Decoded ZIP SHA-256 is pinned. Do not clone the private repo.
set -euo pipefail

EXPECTED_ZIP_SHA256=e4c8a01de9717bed7f19ee2239a6868d4122e21455b9dd865ea2aae845032947
FORGE_STD_PIN=7117c90c8cf6c68e5acce4f09a6b24715cea4de6
ARCHIVE_B64="${1:-IMD_BATCHER_ARCHIVE.b64}"

if [[ ! -f "$ARCHIVE_B64" ]]; then
  echo "missing $ARCHIVE_B64" >&2
  exit 1
fi

base64 -d "$ARCHIVE_B64" > imd-batcher-finalize.zip
echo "$EXPECTED_ZIP_SHA256  imd-batcher-finalize.zip" | sha256sum -c -

rm -rf imd-batcher
unzip -q imd-batcher-finalize.zip
cd imd-batcher
sha256sum -c MANIFEST.sha256

npm ci --ignore-scripts

if [[ ! -d lib/forge-std/.git ]]; then
  rm -rf lib/forge-std
  git clone https://github.com/foundry-rs/forge-std.git lib/forge-std
fi
git -C lib/forge-std checkout "$FORGE_STD_PIN"

echo "bootstrap ok"
echo "next: cd .. && forge test --match-contract 'DeploymentBatcher(ThreeWaySplitTest|Phase1EndpointPoisoningTest|OVaultRuntimeConfigTest)' --summary"
