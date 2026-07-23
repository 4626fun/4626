#!/usr/bin/env bash
# Drop privileges only after ensuring mounted ACP state is writable by `node`.
# Live Hermit uses ARENA_ACP_HOME (default /data/acp-home) outside /app; files
# created by the previous root-running image are often mode 0600 root-owned.
set -euo pipefail

ACP_HOME="${ARENA_ACP_HOME:-/data/acp-home}"
mkdir -p "${ACP_HOME}"
# Best-effort: volume may already be correctly owned or read-only in some envs.
chown -R node:node "${ACP_HOME}" 2>/dev/null || true
chmod -R u+rwX "${ACP_HOME}" 2>/dev/null || true

if [[ "$(id -u)" -eq 0 ]]; then
  exec gosu node "$@"
fi
exec "$@"
