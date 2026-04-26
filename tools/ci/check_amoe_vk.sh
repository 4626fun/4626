#!/usr/bin/env bash
# Fails CI if AmoeGroth16Verifier.sol is the placeholder (zero VK constants).
# Run after every contracts checkout, before forge build.
set -euo pipefail
F="contracts/utilities/lottery/zk/AmoeGroth16Verifier.sol"
if [ ! -f "$F" ]; then
  echo "[check_amoe_vk] $F missing"; exit 1
fi
# Placeholder shipped with this PR explicitly reverts in verifyProof.
if grep -q 'revert("AmoeGroth16Verifier: VK not generated' "$F"; then
  echo "[check_amoe_vk] FAIL: placeholder verifier detected"
  echo "  Run: ./tools/zk/regen_amoe_fixture.sh"
  exit 1
fi
# Real snarkjs/zkMetal output uses BN254 r constant. Sanity check it's there.
if ! grep -q '21888242871839275222246405745257275088548364400416034343698204186575808495617' "$F"; then
  echo "[check_amoe_vk] WARN: BN254 scalar field constant not found — verifier shape unfamiliar"
  exit 1
fi
echo "[check_amoe_vk] OK"
