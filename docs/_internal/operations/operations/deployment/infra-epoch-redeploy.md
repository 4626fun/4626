---
title: Infra Epoch Redeploy
sidebar_position: 3
---

# Infra Epoch Redeploy

Run this when contract/runtime behavior changed enough that patching in place is risky, and you want a clean infra epoch:

- new `Registry4626`
- new deterministic infra addresses (store, deployer-from-store, module contracts, `DeploymentBatcher`)
- reseeded bytecode store entries for current creation bytecode
- app/API cutover to new addresses

This path assumes legacy per-creator scripts are retired and `/deploy` is the canonical launch path.

## Required Inputs

- `PRIVATE_KEY`
- `BASE_RPC_URL`
- `ETHERSCAN_API_KEY` (or `BASESCAN_API_KEY`)
- `DEPLOYMENT_EPOCH_TAG` (current: `v1.19.1`)

Optional:

- `REGISTRY` (if you already deployed a new registry and want to pin it)
- `SOLANA_DESTINATION`, `OVAULT_HUB_COMPOSER`, and `OVAULT_SOLANA_EID`
  when configuring the LayerZero share-mesh runtime

## 1) Choose Epoch Tag

Pick an immutable epoch token and keep it in release notes. New production
launches use `v1.19.1`.

```bash
export DEPLOYMENT_EPOCH_TAG="v1.19.1"
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

## 4) Configure LayerZero Share-Mesh Runtime

The batcher shell stores only:

- `setSolanaDestination(bytes32)`
- `setOVaultRuntimeConfig(address,uint32,bool)`

Do not configure a Twin `SolanaBridgeAdapter` or batcher-global
`solanaShareOftPeer`. Those are retired grains.

Historical audit only: the named v1.19.0 Safe packet has exactly 11 operations.
Do not execute it for v1.19.1:

```bash
pnpm -C frontend exec tsx scripts/ops/execute-v1190-registration-plane-safe.ts \
  --dry-run
```

Discard and regenerate any packet containing stale adapter/global-peer
operations. Per-creator provisioning is a separate mandatory step:
provision the creator's LZ OFT store/mint, then call
`Registry4626.setRemoteOFTPeerBytes32(creatorToken, 30168, peer)` before
finalize. Follow
[Solana share-mesh creator provisioning](/operations/solana/solana-share-mesh-creator-provisioning).

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
- `CCALaunchArm`
- `CreatorOracle`
- `OFTBootstrapRegistry`

Record the release hash snapshot after regenerating deploy bytecode:

- `deployments/base/v1.19.1-bytecode-manifest.json`

## 6) App/API Cutover

Update environment/config to the new epoch addresses. Canonical current values
are in [Contract addresses](/reference/addresses#environment-for-v1190-launches).

- server env:
  - `REGISTRY_4626`
  - `OVAULT_FACTORY`
  - `VAULT_ACTIVATION_BATCHER`
  - `UNIVERSAL_BYTECODE_STORE` (chunked `UniversalBytecodeStoreV2`)
  - `UNIVERSAL_CREATE2_FROM_STORE`
  - `UNIVERSAL_CREATE2_DEPLOYER`
  - `DEPLOYMENT_BATCHER`
  - `DEPLOYMENT_BATCHER_AUTO_HANDOFF`
  - `LOTTERY_MANAGER`
- frontend env:
  - `VITE_REGISTRY`
  - `VITE_FACTORY`
  - `VITE_VAULT_ACTIVATION_BATCHER`
  - `VITE_UNIVERSAL_BYTECODE_STORE`
  - `VITE_UNIVERSAL_CREATE2_DEPLOYER`
  - `VITE_DEPLOYMENT_BATCHER`
  - `VITE_DEPLOYMENT_BATCHER_AUTO_HANDOFF`
  - `VITE_LOTTERY_MANAGER`
- bump deploy namespace:
  - `VITE_DEPLOYMENT_VERSION` (`v1.19.1` for the current CREATE2 namespace)

Apply these in both local env files (`/.env`, `frontend/.env`) and Vercel project env scopes (`production`, `preview`, `development`) before traffic cutover. **Redeploy** after Vercel env updates — bundled `VITE_*` values are baked at build time unless the route uses runtime config (`/api/deploy/config`).

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
   For the active lane this means the creator's LZ OFT store/mint exists and
   the explicit registry peer is non-zero before finalize; it does not mean
   Twin adapter registration.

## Rollback

Fast rollback is env/config rollback:

- restore previous epoch addresses for registry/store/deployer/batcher
- restore previous `VITE_DEPLOYMENT_VERSION`
- redeploy app/API

No onchain delete/reset is required.
