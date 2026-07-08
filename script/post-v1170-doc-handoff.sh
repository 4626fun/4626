#!/usr/bin/env bash
set -euo pipefail

exec "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/script/post-greenfield-doc-handoff.sh" "${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/tmp/base-v1.17.0-handoff.env}"
