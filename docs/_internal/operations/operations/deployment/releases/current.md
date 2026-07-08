---
title: Current release (v1.18.0-greenfield)
sidebar_position: 1
---

# Current release — v1.18.0-greenfield

**Status:** on-chain cutover complete (2026-07-08). **Pending:** treasury Safe wiring, fresh AMOE router, Vercel env push.

This is the published release note for **new vault launches** on Base mainnet (`8453`). Live addresses and inventory live in [Contract addresses](/reference/addresses) — when anything disagrees, **that page wins**.

Release packet: `docs/_internal/deployment-releases-legacy/v1.18.0-greenfield.md`  
Handoff: `tmp/base-v1.18.0-handoff.env`

## What v1.18.0-greenfield is

Full greenfield infra epoch: fresh `Registry4626`, `LotteryManager4626`, `VRFConsumer4626`, `SolanaBridgeAdapter`, bytecode store, CREATE2 deployer, and batcher shell under epoch tag `v1.18.0`. Phase 3 remains **45% Charm + 45% Ajna + 10% idle**; Solana allocation is **ShareOFT mesh at Phase 2 finalize** (~30% via Pipe A).

| Role | Address |
|------|---------|
| Registry4626 | `0xDb8570Dd434b6fCb7f4463d1e7C6F01d4459A4E0` |
| OVaultFactory4626 | `0x70d0D2411D362BA50821389383Fa6B829d736232` |
| DeploymentBatcher | `0x02D7abC547F8B1e7E2D7a919D8D1005918361750` |
| Phase1Module | `0x808fC8e83629019e29df79E592237B4603F9D1b5` |
| Phase2Module | `0x9845D8d412DA4686FE8b1886F314Ef8b288b8D71` |
| ShareMeshHelper | `0x9C965724f6B3387433D82bf67632Bf06470a8988` |
| Bytecode store | `0xfa3e3b466635DAff910057f18749B93d56F9DE50` |
| CREATE2 deployer | `0x54660E61857a652753d805aD2c7b4f759C138bD5` |
| SolanaBridgeAdapter | `0x9A61814082A26192DD9Cb201b44058506685Be60` |
| LotteryManager4626 | `0xbE87AD917bE7f6a9AE1F9c9dd0A7Ec7550F3F8C1` |

Superseded live stack (v1.16.1-share-mesh): batcher `0xA9024e1B89C5Be34502A275576Cc137473d65839` — existing vaults may still reference; do not use for new launches.

## CREATE2 namespace

`VITE_DEPLOYMENT_VERSION` (and dry-run `*-dryrun` variants) is the **salt namespace** for per-creator CREATE2 — separate from the bytecode epoch label. **New vault launches** should use `v1.18.0` (or `v1.18.0-*`).

Bytecode manifest: `deployments/base/v1.18.0-bytecode-manifest.json`

## Preflight / validation

```bash
forge build --skip test --skip script
./script/generate_bytecode_manifest.sh v1.18.0
./script/generate_frontend_deploy_bytecode.sh
pnpm -C frontend typecheck
BYTECODE_MANIFEST=../../deployments/base/v1.18.0-bytecode-manifest.json \
  UNIVERSAL_BYTECODE_STORE=0xfa3e3b466635DAff910057f18749B93d56F9DE50 \
  pnpm -C frontend exec tsx scripts/ops/verify-bytecode-store-seeded.ts
./script/validate-greenfield-handoff.sh tmp/base-v1.18.0-handoff.env
bash test/current-release-target-guard.sh
pnpm -C frontend guard:registry4626-naming
```

**Solana bridge readiness** (Pipe A):

```bash
pnpm -C frontend exec tsx scripts/ops/verify-batcher-pipe-a-readiness.ts \
  --batcher 0x02D7abC547F8B1e7E2D7a919D8D1005918361750
```

## Post-broadcast operator steps

1. Treasury Safe: `wireDeploymentHelpers` + `setPhase1Module(0x808fC8…)` on batcher `0x02D7ab…`
2. Registry4626: `setAuthorizedFactory(batcher, true)` for Pipe A finalize
3. Deploy fresh `LotteryAmoeRouter` + wire to manager `0xbE87AD…`
4. Sync env: `./script/sync-greenfield-env-from-handoff.sh tmp/base-v1.18.0-handoff.env` (local done; **Vercel still manual**)
5. Redeploy Vercel production after env push

## Related runbooks

- [Greenfield launch readiness](/operations/vault/greenfield-launch-readiness)
- [Infra epoch redeploy](/operations/deployment/infra-epoch-redeploy)
- [v1.18.0 greenfield packet](../../deployment-releases-legacy/v1.18.0-greenfield.md)

## Historical release packets

Prior epoch docs (v1.7–v1.16.1) are repo-only under `docs/_internal/deployment-releases-legacy/` for audit — do not use for new deploys.
