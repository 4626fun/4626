#!/usr/bin/env bash
set -euo pipefail

echo "ERROR: v1.15.0 Vercel env tooling is retired and will not write remote env values." >&2
echo "Use ./script/run-greenfield-cutover.sh <epoch> and the current epoch release runbook." >&2
echo "Validate the handoff with ./script/validate-greenfield-handoff.sh <handoff-env-path> before syncing deployment env." >&2
exit 1
