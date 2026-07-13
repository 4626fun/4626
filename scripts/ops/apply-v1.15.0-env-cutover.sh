#!/usr/bin/env bash
set -euo pipefail

echo "ERROR: v1.15.0 env cutover tooling is retired and will not modify local env files." >&2
echo "Use ./script/run-greenfield-cutover.sh <epoch> for a current cutover." >&2
echo "Use ./script/sync-greenfield-env-from-handoff.sh <handoff-env-path> to sync current epoch env files." >&2
exit 1
