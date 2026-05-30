#!/usr/bin/env bash
set -euo pipefail

# Use bootstrap.ts so we have a health listener from the very first moment,
# before any of the heavy alfaclub / command / 1659 context modules are evaluated.
exec npx tsx server/agents/hermit/bootstrap.ts
