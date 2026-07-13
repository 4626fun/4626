#!/usr/bin/env bash
set -euo pipefail

# Sync canonical infra env keys from a greenfield handoff file into root + frontend .env.
#
# Usage:
#   ./script/sync-greenfield-env-from-handoff.sh tmp/base-v1.18.0-handoff.env

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HANDOFF="${1:-}"

if [[ -z "$HANDOFF" || ! -f "$HANDOFF" ]]; then
  echo "Usage: $0 <handoff-env-path>" >&2
  exit 1
fi

python3 - "$HANDOFF" "$ROOT_DIR/.env" "$ROOT_DIR/frontend/.env" <<'PY'
import re
import sys
from pathlib import Path

handoff_path = Path(sys.argv[1])
env_paths = [Path(p) for p in sys.argv[2:]]

values: dict[str, str] = {}
for raw in handoff_path.read_text(encoding="utf-8").splitlines():
    line = raw.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    key, value = line.split("=", 1)
    key = key.strip()
    value = value.strip()
    if key and value:
        values[key] = value

if "DEPLOYMENT_EPOCH_TAG" not in values:
    raise SystemExit(f"missing DEPLOYMENT_EPOCH_TAG in {handoff_path}")

epoch = values["DEPLOYMENT_EPOCH_TAG"]

canonical_keys = [
    "DEPLOYMENT_EPOCH_TAG",
    "REGISTRY",
    "REGISTRY_4626",
    "OVAULT_FACTORY",
    "LOTTERY_MANAGER",
    "VRF_CONSUMER",
    "VAULT_ACTIVATION_BATCHER",
    "SOLANA_DESTINATION",
    "OVAULT_HUB_COMPOSER",
    "OVAULT_SOLANA_EID",
    "UNIVERSAL_BYTECODE_STORE",
    "UNIVERSAL_CREATE2_DEPLOYER",
    "UNIVERSAL_CREATE2_FROM_STORE",
    "DEPLOYMENT_BATCHER",
    "DEPLOYMENT_BATCHER_AUTO_HANDOFF",
    "WIRE_BATCHER_HELPERS_BATCHER",
    "DEPLOYMENT_BATCHER_PHASE1_MODULE",
    "DEPLOYMENT_BATCHER_PHASE2_MODULE",
    "DEPLOYMENT_BATCHER_PHASE3_HELPER",
    "DEPLOYMENT_BATCHER_SHARE_MESH_HELPER",
    "DEPLOYMENT_BATCHER_UTILS_HELPER",
    "OVAULT_CORE_MODULE",
    "OVAULT_STRATEGIES_MODULE",
    "OVAULT_ADMIN_MODULE",
]

vite_keys = {
    "VITE_REGISTRY": "REGISTRY",
    "VITE_FACTORY": "OVAULT_FACTORY",
    "VITE_LOTTERY_MANAGER": "LOTTERY_MANAGER",
    "VITE_VRF_CONSUMER": "VRF_CONSUMER",
    "VITE_VAULT_ACTIVATION_BATCHER": "VAULT_ACTIVATION_BATCHER",
    "VITE_UNIVERSAL_BYTECODE_STORE": "UNIVERSAL_BYTECODE_STORE",
    "VITE_UNIVERSAL_CREATE2_DEPLOYER": "UNIVERSAL_CREATE2_DEPLOYER",
    "VITE_DEPLOYMENT_BATCHER": "DEPLOYMENT_BATCHER",
    "VITE_DEPLOYMENT_BATCHER_AUTO_HANDOFF": "DEPLOYMENT_BATCHER_AUTO_HANDOFF",
    "VITE_DEPLOYMENT_VERSION": "DEPLOYMENT_EPOCH_TAG",
}

legacy_remove_prefixes = (
    "CREATOR_REGISTRY",
    "CREATOR_FACTORY",
    "CREATOR_VAULT_BATCHER",
    "CREATOR_LOTTERY_MANAGER",
    "CREATOR_VRF_CONSUMER",
    "VITE_CREATOR_VAULT_BATCHER",
    "SOLANA_BRIDGE_ADAPTER",
    "VITE_SOLANA_BRIDGE_ADAPTER",
)

def upsert(lines: list[str], key: str, value: str) -> None:
    pattern = re.compile(rf"^\s*{re.escape(key)}=")
    replaced = False
    for i, line in enumerate(lines):
        if pattern.match(line):
            lines[i] = f"{key}={value}"
            replaced = True
            break
    if not replaced:
        lines.append(f"{key}={value}")

for env_path in env_paths:
    if not env_path.exists():
        print(f"skip missing {env_path}")
        continue

    lines = env_path.read_text(encoding="utf-8").splitlines()
    filtered: list[str] = []
    for line in lines:
        if any(line.startswith(f"{prefix}=") for prefix in legacy_remove_prefixes):
            continue
        filtered.append(line)
    lines = filtered

    for key in canonical_keys:
        if key in values:
            upsert(lines, key, values[key])
        elif key == "REGISTRY_4626" and "REGISTRY" in values:
            upsert(lines, key, values["REGISTRY"])

    for vite_key, source_key in vite_keys.items():
        if vite_key == "VITE_DEPLOYMENT_VERSION":
            upsert(lines, vite_key, epoch)
        elif source_key in values:
            upsert(lines, vite_key, values[source_key])

    env_path.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")
    print(f"synced {env_path}")
PY

echo "Done. Removed legacy CREATOR_* / Twin adapter keys; wrote canonical v${epoch:-?} infra pins (destination + OVault runtime)."
