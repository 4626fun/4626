#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "== forge test (summary) =="
forge test --summary

echo "== KPR workflow layout + typecheck =="
bash kpr/kpr-workflows/scripts/validate-workflow-layout.sh
bash kpr/kpr-workflows/scripts/typecheck-workflows.sh

echo "== vault strategy reallocator wiring + unit tests =="
node scripts/check-vault-strategy-reallocator-wiring.mjs
pnpm -C kpr test vault-strategy-reallocator
pnpm -C kpr test vault-strategy-reallocator-pass-loop
pnpm -C kpr test strategyAllocation.fuzz

echo "== Foundry cross-strategy rebalance gate =="
forge test --match-path "test/vault/strategies/CreatorOVaultStrategies.Rebalance*"

echo "== no TODO/FIXME markers (first-party paths) =="
bash frontend/scripts/check-no-todo-markers.sh

echo "== frontend lint / typecheck / test =="
pnpm -C frontend guard:canonical-csw
pnpm -C frontend lint
pnpm -C frontend typecheck
pnpm -C frontend test --run

echo "== Semgrep (frontend API + server lib, Docker) =="
if command -v docker >/dev/null 2>&1; then
  docker run --rm -v "$ROOT:/src" semgrep/semgrep:latest semgrep scan \
    --metrics=off \
    --timeout=5 \
    --config=p/typescript \
    --config=p/javascript \
    /src/frontend/api \
    /src/frontend/server/_lib
else
  echo "(skip: docker not installed — run Semgrep in CI or install Docker)"
fi

echo "== gitleaks (incremental, last ~20 commits; skip if not installed) =="
if command -v gitleaks >/dev/null 2>&1; then
  base="$(git merge-base HEAD HEAD~20 2>/dev/null || git rev-parse HEAD~20)"
  gitleaks detect --source . --config gitleaks.toml --no-banner --redact \
    --log-opts "${base}..HEAD"
else
  echo "(skip: gitleaks not on PATH — install from https://github.com/gitleaks/gitleaks)"
fi

echo "== contracts SC hygiene (CLM size headroom + canonical lane terminology) =="
# Size: the dedicated warn-guard (non-blocking heads-up for ~126B lead time).
bash amoe/tools/ci/check_manager_size_warn.sh || true
# Canonical terminology (AGENTS.md + x-ray pass): no stray bare "payoutRecipient"
# or "externalRevenueRecipient" in contracts/ (allowed only in ABI-compat struct fields
# with explicit creatorCoinPayoutRecipient comments, or raw on-chain identifiers).
if grep -r --include="*.sol" -E '\bpayoutRecipient\b|externalRevenueRecipient|creator earnings' contracts/ 2>/dev/null \
   | grep -v 'creatorCoinPayoutRecipient\|tradeFeeCollector\|InvalidCreatorCoinPayoutRecipient\|InvalidCreatorTreasury\|payoutRecipient (external earnings lane\|legacy name .*payoutRecipient\|retained for on-chain ABI compatibility\|ABI compatibility' \
   | grep -q . ; then
  echo "[WARN] possible bare payoutRecipient / externalRevenueRecipient / unqualified 'creator earnings' in contracts/ — review per AGENTS.md canonical policy and creatorvault-business-logic-core-structure-audit.md"
else
  echo "[ok] contracts/ adhere to canonical lane terminology (tradeFeeCollector, creatorCoinPayoutRecipient, etc.)"
fi

echo "== pnpm audit (report only; does not fail script) =="
pnpm audit || true
( cd frontend && pnpm audit ) || true
( cd kpr && pnpm audit ) || true
( cd apps/docs-site && pnpm audit ) || true

echo ""
echo "OK. CI mirrors: .github/workflows/security-scanning.yml + .github/workflows/test.yml"
echo "Docs index: docs/audits/README.md (includes June 2026 x-ray contract pass + size gate)"
echo "SC hygiene added per x-ray pass recommendation (CLM headroom + canonical lanes in contracts/)."
