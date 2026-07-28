---
title: Current release (v1.20.0)
sidebar_position: 1
---

# Current release — v1.20.0 greenfield

**Status:** active new-vault release (infra live; Creator + Agent paid canaries still outstanding).

This is the operational release note for **new vault launches** on Base mainnet (`8453`). New launches use the **v1.20.0 greenfield shell** and **v1.20.0 deploy bytecode / CREATE2 namespace** only. Prior v1.19.x addresses remain onchain for already-deployed vaults (incl. AKITA) but are **not** supported launch or ops targets.

Authoritative address table: [`docs/reference/addresses.md`](../../../../../reference/addresses.md).

Historical packets:

- Current epoch packet: [`v1.20.0-greenfield.md`](../../../../deployment-releases-legacy/v1.20.0-greenfield.md)
- Prior shell: [`v1.19.1-greenfield.md`](../../../../deployment-releases-legacy/v1.19.1-greenfield.md)
- Prior bytecode epoch: [`v1.19.3.md`](../../../../deployment-releases-legacy/v1.19.3.md)

## What is live

| Layer | Target |
|-------|--------|
| Greenfield shell (registry, batcher, store, CREATE2-from-store, LotteryManager, AMOE) | v1.20.0 addresses below |
| Per-creator deploy bytecode / CREATE2 salt (`VITE_DEPLOYMENT_VERSION`) | **v1.20.0** |
| `DeploymentBatcherPhase1Module` | `0x416FA15e…` |
| `DeploymentBatcherPhase2Module` | `0xf1334BE9…` |

The active deployment plane is LayerZero ShareOFT. Twin `SolanaBridgeAdapter` registration and a batcher-global Solana peer are legacy grain and are not part of a new-vault launch.

| Role | Address |
|------|---------|
| Registry4626 | `0xF60a1490C4129f2b6ae540734D3C2C8C6111824e` |
| OVaultFactory4626 | `0x29AB55092F4009aa3F3603f32b11A6B02e6F0eb5` |
| DeploymentBatcher | `0x83A9b2481E3e6d3a8fA12F6eB072253AAc518032` |
| DeploymentBatcherPhase1Module | `0x416FA15e40caA51C20d1795db946c6806C946aC5` |
| DeploymentBatcherPhase2Module | `0xf1334BE96B3530BBF17506DED98E50D917A45B41` |
| VaultAuxiliaryDeployBatcher | `0x15eE1D03a5556C28E5079E68763F8231ad68dAdD` |
| Bytecode store | `0x8599CA87b28320158941C59CB3cd9a3f12083530` |
| CREATE2 deployer | `0xdffB25505F5050E15B3602296330Ef352127d1Ef` |
| CreatorOVaultCoreModule | `0xD6B862783Fd362ccF0d39d86E6384D8770e78833` |
| LotteryManager4626 | `0x0fC6f30adFD9e82097895Bb166536FdFD8EaC97b` |
| LotteryAmoeRouter | `0xf07D4811C55DAB360D4aF802FA9756EBca241DAC` |

## CREATE2 namespace

`VITE_DEPLOYMENT_VERSION` is the **salt namespace** for per-creator CREATE2.
New production launches use `v1.20.0`; dry runs / retries may use an explicit
`v1.20.0-*` suffix when a partial Phase 1 needs a fresh salt.

Bytecode manifest: `deployments/base/v1.20.0-bytecode-manifest.json`

## Preflight / validation

```bash
forge build --skip test --skip script
./script/generate_bytecode_manifest.sh v1.20.0
./script/generate_frontend_deploy_bytecode.sh
pnpm -C frontend typecheck
BYTECODE_MANIFEST=../deployments/base/v1.20.0-bytecode-manifest.json \
  UNIVERSAL_BYTECODE_STORE=0x8599CA87b28320158941C59CB3cd9a3f12083530 \
  pnpm -C frontend exec tsx scripts/ops/verify-bytecode-store-seeded.ts
bash test/current-release-target-guard.sh
pnpm -C frontend guard:registry4626-naming
```

**Solana bridge readiness** (Pipe A):

```bash
pnpm -C frontend exec tsx scripts/ops/verify-batcher-pipe-a-readiness.ts \
  --batcher 0x83A9b2481E3e6d3a8fA12F6eB072253AAc518032
```

The batcher shell is configured with the Solana destination and OVault runtime
only. Before each creator is finalized, provision that creator's LayerZero OFT
store/mint and seed
`Registry4626.setRemoteOFTPeerBytes32(creatorToken, 30168, peer)`.

## Post-cutover verification

1. Verify v1.20.0 deploy-consumed codeIds on `0x8599CA87…`.
2. Verify live Phase1Module `0x416FA15e…` and Creator core `0xD6B86278…`.
3. Verify the active DeploymentBatcher and Phase2 module use LotteryManager
   `0x0fC6f30a…` and AMOE router `0xf07D4811…`.
4. Verify destination + OVault runtime pointers and the active environment has
   `VITE_DEPLOYMENT_VERSION=v1.20.0`.
5. For each Solana-enabled creator, provision the LZ OFT store/mint and seed
   the explicit registry peer before finalize.
6. Run a Creator greenfield lifecycle canary via `/deploy` (Agent canary separate).

## Related runbooks

- [Greenfield launch readiness](/operations/vault/greenfield-launch-readiness)
- [Infra epoch redeploy](/operations/deployment/infra-epoch-redeploy)
- [v1.20.0 greenfield packet](../../../../deployment-releases-legacy/v1.20.0-greenfield.md)
- [v1.19.3 epoch note](../../../../deployment-releases-legacy/v1.19.3.md)
- [v1.19.1 greenfield packet](../../../../deployment-releases-legacy/v1.19.1-greenfield.md)

## Historical release packets

Prior epoch docs remain repo-only under `docs/_internal/deployment-releases-legacy/`
for audit and must not be used as the new-launch namespace.
