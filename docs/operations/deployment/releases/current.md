---
title: Current release (v1.14.1)
sidebar_position: 1
---

# Current release — v1.14.1

**Status:** active greenfield deploy target on Base mainnet (`8453`).

This is the only published release note. Live addresses and inventory live in [Contract addresses](/reference/addresses) — when anything disagrees, **that page wins**.

## What v1.14.1 is

Full shared/global + split Phase-1 refresh on `CreatorOVaultModuleStorage.v3` (impairment-capable modules). Rotates batcher shell, helper modules, registry, and store/deployer pair. Pre-v1.14.1 batchers (including `0xa99058…`) are **deprecated** for new greenfield deploys.

| Role | Address |
|------|---------|
| DeploymentBatcher | `0x660B251F2feB28f61A8e23e65C66F9b917Ee61c1` |
| Phase1Module | `0x0fac3F8040879eF1ca6cc4572cc27f0908a8f266` |
| Bytecode store | `0xb3712E84F123e7C5390913E30FC6BBD5AEd2a314` |
| CREATE2 deployer | `0x2fA570Cb17925Da86b303D4651f06b83057a10c4` |
| SolanaBridgeAdapter | `0x8e99bb0270bbdf2d64ff6854509CD2410A28fBae` |

Full infra table: [addresses.md](/reference/addresses#current-live-infrastructure-v1141-greenfield-deploy-target).

## CREATE2 namespace

`VITE_DEPLOYMENT_VERSION` (and dry-run `*-dryrun` variants) is the **salt namespace** for per-creator CREATE2 — separate from the bytecode epoch label. New greenfield deploys should use a fresh namespace under `v1.14.1` (e.g. `v1.14.1` or `v1.14.1-*`).

Bytecode manifest: `deployments/base/v1.14.1-bytecode-manifest.json`

## Preflight

```bash
forge build --skip test --skip script
./script/generate_bytecode_manifest.sh v1.14.1
./script/generate_frontend_deploy_bytecode.sh
pnpm -C frontend typecheck
BYTECODE_MANIFEST=../../deployments/base/v1.14.1-bytecode-manifest.json \
  pnpm -C frontend exec tsx scripts/ops/verify-bytecode-store-seeded.ts
./test/current-release-target-guard.sh
```

Pipe A readiness (payable finalize + ShareOFT peer):

```bash
pnpm -C frontend exec tsx scripts/ops/verify-batcher-pipe-a-readiness.ts \
  --batcher 0x660B251F2feB28f61A8e23e65C66F9b917Ee61c1
```

## Related runbooks

- [Greenfield launch readiness](/operations/vault/greenfield-launch-readiness)
- [Deploy dry-run (local fork)](/operations/deployment/deploy-dry-run-local-fork-invariants)
- [Infra epoch redeploy](/operations/deployment/infra-epoch-redeploy)

## Historical release packets

Prior epoch docs (v1.7–v1.14.0) are repo-only under `docs/_internal/deployment-releases-legacy/` for audit — do not use for new deploys.
