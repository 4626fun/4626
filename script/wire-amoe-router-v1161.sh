#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

: "${AMOE_ROUTER:=0x066e11d795656A2A980585a414BC0fD6BB12e057}"
: "${AMOE_MANAGER:=0xD62a8a2F4c25587FA80ED5782b50Af6654122b0b}"
: "${AMOE_PUBLISHER:=0xAb6d5C10b03300326CD7fAb7267Ae192842967b5}"

if [[ -z "${PRIVATE_KEY:-}" ]]; then
  echo "Error: PRIVATE_KEY is required" >&2
  exit 1
fi
if [[ -z "${BASE_RPC_URL:-}" ]]; then
  echo "Error: BASE_RPC_URL is required" >&2
  exit 1
fi

echo "Wiring AMOE router ${AMOE_ROUTER} -> manager ${AMOE_MANAGER}"
echo "Publisher (canonical CSW): ${AMOE_PUBLISHER}"

forge script script/WireLotteryAmoeRouterV1161.s.sol:WireLotteryAmoeRouterV1161 \
  --rpc-url "$BASE_RPC_URL" \
  --broadcast

echo "AMOE v1.16.1 router wiring broadcast complete."
echo "Next: set LOTTERY_AMOE_ROUTER=${AMOE_ROUTER} on Vercel, redeploy, then run publish-cron to republish roots."
