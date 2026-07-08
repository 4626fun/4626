#!/usr/bin/env bash
set -euo pipefail

# v1.18.0 greenfield cutover — canonical target release (supersedes v1.17.0 orphan broadcast).
exec "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/script/run-greenfield-cutover.sh" v1.18.0
