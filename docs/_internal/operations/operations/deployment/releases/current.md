---
title: Current release (v1.16.1-share-mesh)
sidebar_position: 1
---

# Current release — v1.16.1-share-mesh

**Status:** active target for **new vault launches** on Base mainnet (`8453`).

This is the only published release note. Live addresses and inventory live in [Contract addresses](/reference/addresses) — when anything disagrees, **that page wins**.

## What v1.16.1-share-mesh is

Infrastructure refresh for **new vault launches**: `CCALaunchArm` rename + storage fix, post-CCA share-mesh LP manager completion lane, and a fresh batcher shell with wired `shareMeshHelper()`. Phase 3 remains **45% Charm + 45% Ajna + 10% idle**; Solana allocation is **ShareOFT mesh at Phase 2 finalize** (~30% via Pipe A).

| Role | Address |
|------|---------|
| DeploymentBatcher | `0xA9024e1B89C5Be34502A275576Cc137473d65839` |
| Phase1Module | `0xc7d44c4136f10a780B93cCA901F8Fcf2cc130bD1` |
| Phase2Module | `0xD641076Ff1b1121c3cF85F5d69B386bCE91a6bb2` |
| ShareMeshHelper | `0x64aA8ba6aD4641034Ca5A1bF31609a5fa9e5dc80` |
| Bytecode store | `0x7D1029a832E2BEd2C961bC912b623b763862Ad3C` |
| CREATE2 deployer | `0xdC75A18C521f6Ae1ACa112A98E46c8231F431BC0` |
| CreatorRegistry | `0x1eb9A364a3E763dD9249ba3413Dc19E13c1F4461` |
| SolanaBridgeAdapter | `0x363662F9728A9fd12c7CA398e5A6d1d9E7De07F1` |

Superseded shell (no `shareMeshHelper()` getter): `0x17163e67dED6B45bd2A7E6a509A32fB7b0cB6D33`

## CREATE2 namespace

`VITE_DEPLOYMENT_VERSION` (and dry-run `*-dryrun` variants) is the **salt namespace** for per-creator CREATE2 — separate from the bytecode epoch label. **New vault launches** should use `v1.16.1` (or `v1.16.1-*`).

Bytecode manifest: `deployments/base/v1.16.1-bytecode-manifest.json`

## Preflight

```bash
forge build --skip test --skip script
./script/generate_bytecode_manifest.sh v1.16.1
./script/generate_frontend_deploy_bytecode.sh
pnpm -C frontend typecheck
BYTECODE_MANIFEST=../../deployments/base/v1.16.1-bytecode-manifest.json \
  UNIVERSAL_BYTECODE_STORE=0x7D1029a832E2BEd2C961bC912b623b763862Ad3C \
  pnpm -C frontend exec tsx scripts/ops/verify-bytecode-store-seeded.ts
./test/current-release-target-guard.sh
```

**Solana bridge readiness** (Pipe A):

```bash
pnpm -C frontend exec tsx scripts/ops/verify-batcher-pipe-a-readiness.ts \
  --batcher 0xA9024e1B89C5Be34502A275576Cc137473d65839
```

## Related runbooks

- [Greenfield launch readiness](/operations/vault/greenfield-launch-readiness)
- [Infra epoch redeploy](/operations/deployment/infra-epoch-redeploy)
- [v1.16.1 bytecode epoch](../../deployment-releases-legacy/v1.16.1-bytecode-epoch.md)

## Historical release packets

Prior epoch docs (v1.7–v1.16.0) are repo-only under `docs/_internal/deployment-releases-legacy/` for audit — do not use for new deploys.
