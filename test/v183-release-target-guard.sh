#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "test/v183-release-target-guard.sh is deprecated; use test/current-release-target-guard.sh" >&2
exec bash "$ROOT_DIR/test/current-release-target-guard.sh" "$@"
