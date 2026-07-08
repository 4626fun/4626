#!/usr/bin/env bash
set -euo pipefail

# Print the post-broadcast checklist for v1.17.0 doc/env cutover.
# Does not auto-edit addresses.md (requires human review of HANDOFF values).
#
# Usage:
#   ./script/post-v1170-doc-handoff.sh tmp/base-v1.17.0-handoff.env

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

HANDOFF="${1:-${ROOT_DIR}/tmp/base-v1.17.0-handoff.env}"

if [[ ! -f "$HANDOFF" ]]; then
  echo "Error: handoff env not found: $HANDOFF" >&2
  exit 1
fi

echo "v1.17.0 post-broadcast handoff checklist"
echo "Source: $HANDOFF"
echo ""
echo "HANDOFF values:"
grep -E '^[A-Z_]+=' "$HANDOFF" | sort || true
echo ""
echo "Update these files with the addresses above:"
echo "  1. docs/reference/addresses.md"
echo "     - Title → v1.17.0-greenfield"
echo "     - Current infrastructure table ← HANDOFF addresses"
echo "     - Move v1.16.1-share-mesh table → Deprecated infrastructure"
echo "     - Environment cutover table → v1.17.0 values + VITE_DEPLOYMENT_VERSION=v1.17.0"
echo "  2. frontend/src/config/contracts.defaults.ts"
echo "     - SPLIT_PHASE1_DEPLOYMENT_BATCHER, helpers, registry, factory, store, create2, solana"
echo "     - Add PRE_V1161_SPLIT_PHASE1_DEPLOYMENT_BATCHER = 0xA9024e… to DEPRECATED_CREATOR_VAULT_BATCHERS"
echo "  3. test/current-release-target-guard.sh"
echo "     - All pinned addresses + BYTECODE_MANIFEST v1.17.0-bytecode-manifest.json"
echo "  4. script/SeedCreatorRegistry.s.sol — VAULT_BATCHER / VAULT_ACT_BATCHER"
echo "  5. docs/_internal/deployment-releases-legacy/v1.17.0-greenfield.md — Status → on-chain cutover complete"
echo "  6. deployments/README.md — canonical release → v1.17.0"
echo ""
echo "Vercel env (production + preview): see release packet Phase 4 table"
echo "Then: redeploy Vercel, republish AMOE roots on new router, run:"
echo "  bash test/current-release-target-guard.sh"
