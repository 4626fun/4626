# 4626 Deployment Registry

This directory tracks committed deployment artifacts and ABI snapshots used by tooling and operational docs.

## Current Canonical Release

- Base mainnet release target / deploy namespace is now `v1.9.2`.
- Last completed infra release packet: `docs/_internal/deployment-releases-legacy/v1.8.3-mainnet.md` (historical). Current line: [releases index](../docs/operations/deployment/releases/index.md).
- Last completed bytecode / codeId manifest: `deployments/base/v1.8.3-bytecode-manifest.json`
- Live Base deployment snapshots under `deployments/base/contracts/**/*.json` reflect the onchain `v1.8.3` Base epoch broadcast on `2026-04-11`; the `v1.9.2` namespace is the fresh deploy target for new creator vaults.

## Directory Map

```
deployments/
└── base/
    ├── v1.7.1-bytecode-manifest.json
    ├── v1.8.2-bytecode-manifest.json
    ├── v1.8.3-bytecode-manifest.json
    ├── archive/
    │   └── 2026-01-addresses.json
    └── contracts/
        ├── core/
        │   └── CreatorRegistry.json
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
                ├── CreatorLotteryManager.json
                └── vrf/
                    └── CreatorVRFConsumerV2_5.json
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
