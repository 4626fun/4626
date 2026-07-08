#!/usr/bin/env bash
set -euo pipefail

# Deprecated: v1.17.0 partial broadcast is orphaned — use v1.18.0 instead.
echo "Note: v1.17.0 greenfield was superseded. Prefer: ./script/run-v1180-greenfield-cutover.sh" >&2
exec "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/script/run-greenfield-cutover.sh" v1.17.0
