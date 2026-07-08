#!/usr/bin/env bash
set -euo pipefail

# Print the post-broadcast checklist for greenfield doc/env cutover.
# Does not auto-edit addresses.md (requires human review of HANDOFF values).
#
# Usage:
#   ./script/post-greenfield-doc-handoff.sh tmp/base-v1.18.0-handoff.env

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

HANDOFF="${1:-}"
if [[ -z "$HANDOFF" ]]; then
  echo "Error: pass handoff env path (e.g. tmp/base-v1.18.0-handoff.env)" >&2
  exit 1
fi

if [[ ! -f "$HANDOFF" ]]; then
  echo "Error: handoff env not found: $HANDOFF" >&2
  exit 1
fi

EPOCH="$(grep -E '^DEPLOYMENT_EPOCH_TAG=' "$HANDOFF" | tail -1 | cut -d= -f2- || true)"
if [[ -z "$EPOCH" ]]; then
  EPOCH="<epoch>"
fi

echo "${EPOCH} post-broadcast handoff checklist"
echo "Source: $HANDOFF"
echo ""
echo "HANDOFF values:"
grep -E '^[A-Z_]+=' "$HANDOFF" | sort || true
echo ""
echo "Update these files with the addresses above:"
echo "  1. docs/reference/addresses.md"
echo "     - Title → ${EPOCH}-greenfield"
echo "     - Current infrastructure table ← HANDOFF addresses"
echo "     - Move v1.16.1-share-mesh table → Deprecated infrastructure"
echo "     - Environment cutover table → ${EPOCH} values + VITE_DEPLOYMENT_VERSION=${EPOCH}"
echo "  2. frontend/src/config/contracts.defaults.ts"
echo "     - SPLIT_PHASE1_DEPLOYMENT_BATCHER, helpers, registry, factory, store, create2, solana"
echo "     - Add prior live batcher to DEPRECATED_DEPLOYMENT_BATCHERS"
echo "  3. test/current-release-target-guard.sh"
echo "     - All pinned addresses + BYTECODE_MANIFEST ${EPOCH}-bytecode-manifest.json"
echo "  4. script/SeedRegistry4626.s.sol — VAULT_BATCHER / VAULT_ACT_BATCHER"
echo "  5. docs/_internal/deployment-releases-legacy/${EPOCH}-greenfield.md — Status → on-chain cutover complete"
echo "  6. deployments/README.md — canonical release → ${EPOCH}"
echo ""
echo "Vercel env (production + preview): see release packet Phase 4 table"
echo "Then: redeploy Vercel, republish AMOE roots on new router, run:"
echo "  bash test/current-release-target-guard.sh"
