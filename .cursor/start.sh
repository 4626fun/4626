#!/usr/bin/env bash
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

if command -v docker >/dev/null 2>&1; then
  echo "==> Starting Docker service (if available)"
  sudo service docker start || true
fi

echo "==> start complete"
