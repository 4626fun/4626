#!/usr/bin/env bash
set -euo pipefail

# This script is the absolute earliest point we can log when Railway starts the Hermit container.
# The goal is maximum visibility during the 5-minute healthcheck window.

echo "=== HERMIT CONTAINER ENTRYPOINT START ===" >&2
echo "Timestamp: $(date -Iseconds)" >&2
echo "User: $(id -u):$(id -g) ($(id -un):$(id -gn))" >&2
echo "Working dir: $(pwd)" >&2
echo "AGENT_PROCESS=${AGENT_PROCESS:-not set}" >&2
echo "PORT=${PORT:-not set}" >&2
echo "PATH=$PATH" >&2

# Show relevant env (redacted where sensitive)
env | grep -E '^(AGENT_PROCESS|PORT|HERMIT_|ALFACLUB_|DATABASE_URL|RAILWAY_)' | sed 's/=.*/=***/' || true >&2

echo "Looking for tsx..." >&2
which npx || echo "npx not in PATH" >&2
ls -l node_modules/.bin/tsx 2>/dev/null || echo "tsx binary not found in node_modules/.bin" >&2

echo "Attempting to start bootstrap with tsx..." >&2

# Use bootstrap.ts so we have a health listener from the very first moment,
# before any of the heavy alfaclub / command / 1659 context modules are evaluated.
exec npx tsx server/agents/hermit/bootstrap.ts
