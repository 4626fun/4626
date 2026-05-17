#!/usr/bin/env bash
set -euo pipefail

# Suppress a known non-fatal SQLCipher/libxmtp startup warning emitted directly
# by the native bindings. Our JS-level stderr filter cannot intercept writes
# that bypass Node's process streams.
exec npx tsx server/agents/eliza/index.ts 2> >(
  awk '
    BEGIN { IGNORECASE = 1 }
    /sqlcipherCodecAttach:[[:space:]]*no codec attached to db/ { next }
    { print > "/dev/stderr"; fflush("/dev/stderr") }
  '
)
