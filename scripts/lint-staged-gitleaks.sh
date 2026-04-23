#!/usr/bin/env bash
# L-22: lint-staged wrapper around `gitleaks protect --staged`.
#
# lint-staged passes the list of matched staged files as positional
# arguments, but gitleaks works on the repo index, not on a file list.
# This wrapper therefore ignores the arguments and invokes gitleaks
# once over the staged diff. Exits with gitleaks' exit code so a
# finding blocks the commit.
#
# Falls back to a soft warn+pass when the gitleaks binary is missing,
# because not every developer has gitleaks installed locally; CI
# (.github/workflows/security-scanning.yml) still enforces the scan
# on every PR. Developers who want the local block should install
# gitleaks (see scripts/security-audit-local.sh for the pinned
# version already used by the repo).

set -eu

if ! command -v gitleaks >/dev/null 2>&1; then
  echo "[lint-staged-gitleaks] gitleaks not found on PATH; skipping local pre-commit scan."
  echo "[lint-staged-gitleaks] Install: https://github.com/gitleaks/gitleaks#installing  (CI will still run the scan on PR)."
  exit 0
fi

echo "[lint-staged-gitleaks] scanning staged changes"
gitleaks protect --staged --no-banner --redact --exit-code 1
