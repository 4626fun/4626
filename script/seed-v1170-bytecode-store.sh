#!/usr/bin/env bash
set -euo pipefail

exec "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/script/seed-greenfield-bytecode-store.sh" v1.17.0
