#!/usr/bin/env bash
# Session startup: refresh dependencies after pulling latest changes.
# Runs before every cloud agent session (must be idempotent & fast).
set -euo pipefail

export PATH="$HOME/.foundry/bin:$PATH"

# Refresh submodules (fast no-op when already current)
git submodule update --init --recursive

# Refresh JS dependencies
pnpm install --frozen-lockfile
pnpm -C frontend install --frozen-lockfile
cd cre && npm ci && cd ..
