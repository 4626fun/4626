---
title: Infra Epoch Redeploy
sidebar_position: 3
---

# Infra Epoch Redeploy

Run this when contract/runtime behavior changed enough that patching in place is risky, and you want a clean infra epoch:

- new `CreatorRegistry`
- new deterministic infra addresses (store, deployer-from-store, module contracts, `DeploymentBatcher`)
- reseeded bytecode store entries for current creation bytecode
- app/API cutover to new addresses

This path assumes legacy per-creator scripts are retired and `/deploy` is the canonical launch path.

## Required Inputs

- `PRIVATE_KEY`
- `BASE_RPC_URL`
- `ETHERSCAN_API_KEY` (or `BASESCAN_API_KEY`)
- `DEPLOYMENT_EPOCH_TAG` (recommended, example: `v1.9.1`)

Optional:

- `REGISTRY` (if you already deployed a new registry and want to pin it)
- `SOLANA_BRIDGE_ADAPTER`, `SOLANA_DESTINATION` (+ `CONFIGURE_SOLANA=1`)

## 1) Choose Epoch Tag

Pick an immutable epoch token (example: `v1.9.1`) and keep it in release notes.

```bash
export DEPLOYMENT_EPOCH_TAG="v1.9.1"
```

Deployment scripts derive `base-release:*` salt tags from this epoch automatically unless raw `INFRA_*_SALT` values are provided.

## 2) Deploy Core Infra (Registry, factory, shared services)

The canonical full-release path is:

```bash
./script/deploy-base-full-release.sh
```

This broadcasts the fresh shared/global layer, hands those addresses into the deterministic v2 deployment pass, and seeds the bytecode store automatically.

If you need the lower-level shared/global deployment only, `./script/deploy.sh infrastructure` remains available for direct operator use.

## 3) Deploy Deterministic Phase Infra + Seed Bytecode Store

```bash
BASE_RPC_URL="$BASE_RPC_URL" \
DEPLOYMENT_EPOCH_TAG="$DEPLOYMENT_EPOCH_TAG" \
./script/deploy-infra-v2.sh
```

This deploys (or predicts and reuses if already present):

- `UniversalBytecodeStoreV2`
- `UniversalCreate2DeployerFromStore`
- `CreatorOVault*Module` contracts
- `DeploymentBatcher`
- then runs `SeedUniversalBytecodeStore` (idempotent)

## 4) (Optional) Configure Solana Routing

If this epoch should have Solana route config set on the batcher:

```bash
export CONFIGURE_SOLANA=1
export SOLANA_BRIDGE_ADAPTER="0x..."
export SOLANA_DESTINATION="0x..."

forge script script/ConfigureDeploymentBatcherSolana.s.sol:ConfigureDeploymentBatcherSolana \
  --rpc-url "$BASE_RPC_URL" \
  --broadcast
```

Note: Solana provisioning/registration is out-of-band and strategy-stage orchestrated; it is not a phase-2 finalize gate.

## 5) Verify Bytecode Store Coverage

Check that key creation bytecode IDs resolve to non-zero pointers in the new store:

```bash
export STORE_ADDR="0x..."
CODE_ID=$(cast keccak "$(forge inspect contracts/vault/CreatorOVault.sol:CreatorOVault bytecode)")
cast call "$STORE_ADDR" "pointers(bytes32)(address)" "$CODE_ID"
```

Repeat for:

- `CreatorOVaultWrapper`
- `CreatorShareOFT`
- `CreatorGaugeController`
- `CCALaunchStrategy`
- `CreatorOracle`
- `OFTBootstrapRegistry`

Record the release hash snapshot after regenerating deploy bytecode:

- `deployments/base/v1.7.1-bytecode-manifest.json`
- `deployments/base/v1.8.2-bytecode-manifest.json`
- `deployments/base/v1.8.3-bytecode-manifest.json`

## 6) App/API Cutover

Update environment/config to the new epoch addresses:

- server env:
  - `CREATOR_REGISTRY`
  - `UNIVERSAL_BYTECODE_STORE`
  - `UNIVERSAL_CREATE2_FROM_STORE`
  - `CREATOR_VAULT_BATCHER`
  - `CREATOR_VAULT_BATCHER_AUTO_HANDOFF`
  - `DEPLOYMENT_BATCHER`
  - `CREATOR_LOTTERY_MANAGER`
  - `LOTTERY_MANAGER`
  - `SOLANA_BRIDGE_ADAPTER`
- frontend env:
  - `VITE_REGISTRY`
  - `VITE_UNIVERSAL_BYTECODE_STORE`
  - `VITE_UNIVERSAL_CREATE2_DEPLOYER`
  - `VITE_CREATOR_VAULT_BATCHER`
  - `VITE_CREATOR_VAULT_BATCHER_AUTO_HANDOFF`
  - `VITE_LOTTERY_MANAGER`
- bump deploy namespace:
  - `VITE_DEPLOYMENT_VERSION` (new value for this epoch)

Apply these in both local env files and Vercel project env scopes (`production`, `preview`, `development`) before traffic cutover.

If running with repo defaults in production, also update:

- `frontend/src/config/contracts.defaults.ts`

## 7) Canary + Go/No-Go

Before full traffic cutover:

1. Run one creator deploy via `/deploy` (full Phase1->Phase3 flow).
2. Confirm:
   - no `batcher_selector_not_allowed`
   - no `InvalidCodeId`
   - expected stage transitions complete
3. Confirm strategy-stage Solana registration path executes (when configured).

## Rollback

Fast rollback is env/config rollback:

- restore previous epoch addresses for registry/store/deployer/batcher
- restore previous `VITE_DEPLOYMENT_VERSION`
- redeploy app/API

No onchain delete/reset is required.
