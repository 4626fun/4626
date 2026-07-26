---
name: lottery-vrf-ops
description: Chainlink VRF 2.5 + LayerZero lottery randomness operations on 4626.
paths: contracts/**/Lottery**, contracts/**/VRF**, kpr/**, frontend/**/lottery**
---

# Lottery / VRF ops (4626)

**Archive:** `docs/agent-context/archives/lottery-vrf-ops.md`  
**Docs:** `docs/primitives/game-loop/lottery.md`

Read-only `cast call` health checks before any config changes. Hub on Base; cross-chain via `ChainlinkVRFIntegratorV2_5`.
