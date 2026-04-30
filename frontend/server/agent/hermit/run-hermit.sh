#!/usr/bin/env bash
set -euo pipefail

exec npx tsx server/agent/hermit/index.ts
