---
title: Current release (v1.19.3 / v1.19.4)
sidebar_position: 1
---

# Current release — v1.19.3 bytecode + v1.19.4 Creator-core repair

**Status:** active new-vault release.

This is the operational release note for **new vault launches** on Base mainnet (`8453`). New Creator launches use the **v1.19.1 greenfield shell**, **v1.19.3 deploy bytecode / CREATE2 namespace**, and the **v1.19.4 Phase1Module Creator-core repair**.

Historical packets:

- Shell cutover: [`v1.19.1-greenfield.md`](../../../../deployment-releases-legacy/v1.19.1-greenfield.md)
- Bytecode seal: [`v1.19.2.md`](../../../../deployment-releases-legacy/v1.19.2.md)
- Current epoch note: [`v1.19.3.md`](../../../../deployment-releases-legacy/v1.19.3.md)

## What is live

| Layer | Target |
|-------|--------|
| Greenfield shell (registry, batcher, store, CREATE2-from-store, LotteryManager) | v1.19.1 addresses below |
| Per-creator deploy bytecode / CREATE2 salt (`VITE_DEPLOYMENT_VERSION`) | **v1.19.3** |
| `DeploymentBatcherPhase1Module` | **v1.19.4** Creator-core repair `0x8C1C6C10…` |
| `DeploymentBatcherPhase2Module` | `0x1217bA07…` |

The active deployment plane is LayerZero ShareOFT. Twin `SolanaBridgeAdapter` registration and a batcher-global Solana peer are legacy grain and are not part of a new-vault launch.

| Role | Address |
|------|---------|
| Registry4626 | `0x1365e9CEfc516f8A287c51FBaeF96FB4581c6CA2` |
| OVaultFactory4626 | `0xCAb65a066A4D52DD29ffB418B319819176b89610` |
| DeploymentBatcher | `0xa18169caf37fa0347285B16aAFC2B09eCB43F145` |
| DeploymentBatcherPhase1Module | `0x8C1C6C10442F9bC7F8C50B196cF14812b2BB12F3` |
| DeploymentBatcherPhase2Module | `0x1217bA070DBf64303117939301788925030295d1` |
| VaultAuxiliaryDeployBatcher | `0xaA9229c1649a7eC6DA85a76097E0910B24F9408e` |
| Bytecode store | `0xF9622613682a12E46b914c7498716F42E44c4d36` |
| CREATE2 deployer | `0xe2a8aA094EAf0f9ED05C030E6FcB90B9d139b0e2` |
| CreatorOVaultCoreModule | `0x0513cf245EF2Cf54534416211F7B890405bF76D1` |
| LotteryManager4626 | `0xB45E68a5867935a5734E4185977F81c528006650` |

## CREATE2 namespace

`VITE_DEPLOYMENT_VERSION` is the **salt namespace** for per-creator CREATE2.
New production launches use `v1.19.3`; dry runs / retries may use an explicit
`v1.19.3-*` or `v1.19.4-retry-*` suffix when a partial Phase 1 needs a fresh salt.

Bytecode manifest: `deployments/base/v1.19.3-bytecode-manifest.json`

## Preflight / validation

```bash
forge build --skip test --skip script
./script/generate_bytecode_manifest.sh v1.19.3
./script/generate_frontend_deploy_bytecode.sh
pnpm -C frontend typecheck
BYTECODE_MANIFEST=../deployments/base/v1.19.3-bytecode-manifest.json \
  UNIVERSAL_BYTECODE_STORE=0xF9622613682a12E46b914c7498716F42E44c4d36 \
  pnpm -C frontend exec tsx scripts/ops/verify-bytecode-store-seeded.ts
bash test/current-release-target-guard.sh
pnpm -C frontend guard:registry4626-naming
```

**Solana bridge readiness** (Pipe A):

```bash
pnpm -C frontend exec tsx scripts/ops/verify-batcher-pipe-a-readiness.ts \
  --batcher 0xa18169caf37fa0347285B16aAFC2B09eCB43F145
```

The batcher shell is configured with the Solana destination and OVault runtime
only. Before each creator is finalized, provision that creator's LayerZero OFT
store/mint and seed
`Registry4626.setRemoteOFTPeerBytes32(creatorToken, 30168, peer)`.

## Post-cutover verification

1. Verify v1.19.3 deploy-consumed codeIds on `0xF9622613682a12E46b914c7498716F42E44c4d36`.
2. Verify live Phase1Module is the v1.19.4 repair `0x8C1C6C10…` (Creator core `0x0513cf24…`).
3. Verify the active DeploymentBatcher and Phase2 module use LotteryManager
   `0xB45E68a5867935a5734E4185977F81c528006650`.
4. Verify destination + OVault runtime pointers and the active environment has
   `VITE_DEPLOYMENT_VERSION=v1.19.3`.
5. For each Solana-enabled creator, provision the LZ OFT store/mint and seed
   the explicit registry peer before finalize.
6. Run a Creator greenfield lifecycle canary via `/deploy` (Agent canary separate).

## Related runbooks

- [Greenfield launch readiness](/operations/vault/greenfield-launch-readiness)
- [Infra epoch redeploy](/operations/deployment/infra-epoch-redeploy)
- [v1.19.3 epoch note](../../../../deployment-releases-legacy/v1.19.3.md)
- [v1.19.1 greenfield packet](../../../../deployment-releases-legacy/v1.19.1-greenfield.md)
- [v1.19.2 bytecode seal](../../../../deployment-releases-legacy/v1.19.2.md)
- [v1.18.0 greenfield packet](../../../../deployment-releases-legacy/v1.18.0-greenfield.md)

## Historical release packets

Prior epoch docs remain repo-only under `docs/_internal/deployment-releases-legacy/`
for audit and must not be used as the new-launch namespace.
