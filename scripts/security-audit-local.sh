#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "== forge test (summary) =="
forge test --summary

echo "== CRE workflow layout + typecheck =="
bash cre/cre-workflows/scripts/validate-workflow-layout.sh
bash cre/cre-workflows/scripts/typecheck-workflows.sh

echo "== no TODO/FIXME markers (first-party paths) =="
bash frontend/scripts/check-no-todo-markers.sh

echo "== frontend lint / typecheck / test =="
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

echo "== pnpm audit (report only; does not fail script) =="
pnpm audit || true
( cd frontend && pnpm audit ) || true
( cd cre && pnpm audit ) || true
( cd apps/docs-site && pnpm audit ) || true

echo ""
echo "OK. CI mirrors: .github/workflows/security-scanning.yml + .github/workflows/test.yml"
echo "Docs index: docs/audits/README.md"
