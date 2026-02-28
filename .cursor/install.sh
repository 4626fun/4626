#!/usr/bin/env bash
# One-time environment setup for 4626 cloud agents.
# Run once when provisioning a new sandbox or after a clean wipe.
set -euo pipefail

# ── Foundry (Solidity toolchain) ──────────────────────────────────────────────
if ! command -v forge &>/dev/null; then
  curl -L https://foundry.paradigm.xyz | bash
  export PATH="$HOME/.foundry/bin:$PATH"
  foundryup
fi

# ── Git submodules (required for forge build / test) ──────────────────────────
git submodule update --init --recursive

# ── Root dependencies (Solidity: OpenZeppelin, LayerZero, Uniswap) ────────────
pnpm install --frozen-lockfile

# ── Frontend dependencies (Vite + React + Vercel API) ─────────────────────────
pnpm -C frontend install --frozen-lockfile

# ── CRE automation dependencies (keeper bots) ────────────────────────────────
cd cre && npm ci && cd ..

# ── Env files (copy examples if missing — never overwrite existing) ───────────
[ -f .env ]          || cp .env.example .env
[ -f frontend/.env ] || cp frontend/.env.example frontend/.env
