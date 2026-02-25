#!/usr/bin/env bash
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

echo "==> Installing dependencies for project-4626"

if ! command -v pnpm >/dev/null 2>&1 && command -v corepack >/dev/null 2>&1; then
  echo "==> Enabling corepack for pnpm"
  corepack enable
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "ERROR: pnpm is required for root/frontend/docs installs." >&2
  exit 1
fi

echo "==> Installing root dependencies"
pnpm install --frozen-lockfile || pnpm install

echo "==> Installing frontend dependencies"
pnpm -C frontend install --frozen-lockfile || pnpm -C frontend install

echo "==> Installing docs dependencies"
pnpm -C apps/docs-site install --frozen-lockfile || pnpm -C apps/docs-site install

echo "==> Installing CRE dependencies"
npm --prefix cre ci || npm --prefix cre install

echo "==> install complete"
