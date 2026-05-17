#!/usr/bin/env bash
set -euo pipefail

exec npx tsx server/agents/hermit/index.ts
