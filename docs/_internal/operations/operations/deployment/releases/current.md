---
title: Current release (v1.19.0)
sidebar_position: 1
---

# Current release — v1.19.0 partial refresh

**Status:** release artifacts generated; bounded Base change window and staged traffic sign-off in progress.

This is the published release note for **new vault launches** on Base mainnet (`8453`). Live addresses and inventory live in [Contract addresses](/reference/addresses) — when anything disagrees, **that page wins**.

Release packet: `docs/_internal/deployment-releases-legacy/v1.19.0-partial-refresh.md`

## What v1.19.0 is

v1.19.0 is a fresh per-creator bytecode and CREATE2 epoch on the existing
v1.18.0 shared infrastructure. Registry, factory, batcher shell, Phase1/Phase3
helpers, store, CREATE2 deployer, VRF, and Solana adapter addresses are reused.
The replaceable Phase2 module is rotated so new gauges use remediation
LotteryManager `0xB68F359e…`.

| Role | Address |
|------|---------|
| Registry4626 | `0xDb8570Dd434b6fCb7f4463d1e7C6F01d4459A4E0` |
| RegistryBootstrap4626 | `0x5CF9E2504E679edd6828af3f5B8375C61F4D92aB` |
| OVaultFactory4626 | `0x70d0D2411D362BA50821389383Fa6B829d736232` |
| DeploymentBatcher | `0x02D7abC547F8B1e7E2D7a919D8D1005918361750` |
| Phase1Module | `0x808fC8e83629019e29df79E592237B4603F9D1b5` |
| Phase2Module | See [Contract addresses](/reference/addresses) after the bounded rotation |
| ShareMeshHelper | `0x9C965724f6B3387433D82bf67632Bf06470a8988` |
| Bytecode store | `0xfa3e3b466635DAff910057f18749B93d56F9DE50` |
| CREATE2 deployer | `0x54660E61857a652753d805aD2c7b4f759C138bD5` |
| SolanaBridgeAdapter | `0x9A61814082A26192DD9Cb201b44058506685Be60` |
| LotteryManager4626 | `0xB68F359e01626Ec5d15C624037311C70DacAba43` |

The immutable `DeploymentBatcher.lotteryManager()` shell getter remains
historical and non-authoritative. New Phase2 execution is governed by the
active module's immutable LotteryManager.

## CREATE2 namespace

`VITE_DEPLOYMENT_VERSION` is the **salt namespace** for per-creator CREATE2.
New production launches use `v1.19.0`; dry runs may use an explicit
`v1.19.0-*` suffix.

Bytecode manifest: `deployments/base/v1.19.0-bytecode-manifest.json`

## Preflight / validation

```bash
forge build --skip test --skip script
./script/generate_bytecode_manifest.sh v1.19.0
./script/generate_frontend_deploy_bytecode.sh
pnpm -C frontend typecheck
BYTECODE_MANIFEST=../../deployments/base/v1.19.0-bytecode-manifest.json \
  UNIVERSAL_BYTECODE_STORE=0xfa3e3b466635DAff910057f18749B93d56F9DE50 \
  pnpm -C frontend exec tsx scripts/ops/verify-bytecode-store-seeded.ts
bash test/current-release-target-guard.sh
pnpm -C frontend guard:registry4626-naming
```

**Solana bridge readiness** (Pipe A):

```bash
pnpm -C frontend exec tsx scripts/ops/verify-batcher-pipe-a-readiness.ts \
  --batcher 0x02D7abC547F8B1e7E2D7a919D8D1005918361750
```

## Bounded change window

1. Seed and approve v1.19 deploy-consumed codeIds on the existing store.
2. Deploy the replacement Phase2 module with explicit LM `0xB68F359e…`.
3. In one Safe transaction, approve its runtime codehash and set it active.
4. Set `SolanaBridgeAdapter.lotteryManager(0xB68F359e…)`.
5. Verify pointers and deploy with `VITE_DEPLOYMENT_VERSION=v1.19.0`.
6. Run AKITA base-odds soak, then a separate v1.19 greenfield lifecycle.

## Related runbooks

- [Greenfield launch readiness](/operations/vault/greenfield-launch-readiness)
- [Infra epoch redeploy](/operations/deployment/infra-epoch-redeploy)
- [v1.19.0 partial-refresh packet](../../deployment-releases-legacy/v1.19.0-partial-refresh.md)
- [v1.18.0 greenfield packet](../../deployment-releases-legacy/v1.18.0-greenfield.md)

## Historical release packets

Prior epoch docs remain repo-only under `docs/_internal/deployment-releases-legacy/`
for audit and must not be used as the new-launch namespace.
