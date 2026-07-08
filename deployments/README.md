# 4626 Deployment Registry

This directory tracks committed deployment artifacts and ABI snapshots used by tooling and operational docs.

## Current Canonical Release

- **Live infra (production traffic):** **v1.18.0-greenfield** — `docs/reference/addresses.md` + `test/current-release-target-guard.sh`
- **Bytecode manifest (live store verification):** `deployments/base/v1.18.0-bytecode-manifest.json`
- **Orphan (do not cut over):** v1.17.0 partial broadcast — `tmp/base-v1.17.0-handoff.env`

Prior bytecode manifests: `v1.16.0`, `v1.15.1`, `v1.14.1`, … under `deployments/base/`.

## Directory Map

```
deployments/
└── base/
    ├── v1.7.1-bytecode-manifest.json
    ├── v1.16.1-bytecode-manifest.json   ← prior live verification target
    ├── v1.18.0-bytecode-manifest.json   ← live verification target
    ├── archive/
    │   └── 2026-01-addresses.json
    └── contracts/
        ├── core/
        │   └── Registry4626.json
        ├── factories/
        │   ├── CreatorOVaultFactory.json
        │   └── UniversalCreate2DeployerFromStore.json
        ├── helpers/
        │   ├── batchers/
        │   │   ├── DeploymentBatcher.json
        │   │   ├── DeploymentBatcherPhase3Helper.json
        │   │   └── VaultActivationBatcher.json
        │   └── infra/
        │       └── UniversalBytecodeStore.json
        └── services/
            ├── bridge/
            │   └── SolanaBridgeAdapter.json
            └── lottery/
                ├── LotteryManager4626.json
                └── vrf/
                    └── VRFConsumer4626.json
```

## File Conventions

- `base/vX.Y.Z-bytecode-manifest.json`: release-scoped bytecode hash manifest.
- `base/contracts/**/<Contract>.json`: canonical ABI + deployment metadata snapshot per contract.
- `base/archive/YYYY-MM-addresses.json`: historical address snapshots preserved for audits/runbooks.

## Maintenance Rules

1. Add a new versioned bytecode manifest for each release that changes deployable bytecode.
2. Update ABI snapshots under `base/contracts/` whenever deployed interfaces change.
3. Never overwrite archive snapshots; append a new timestamped file instead.
4. Keep this README aligned to the actual tree (no placeholder networks or pending-chain tables).
5. After v1.18.0 greenfield cutover, keep v1.16.1 addresses in **Deprecated** in `docs/reference/addresses.md`; `test/current-release-target-guard.sh` validates v1.18.0.
