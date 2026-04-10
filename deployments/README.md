# 4626 Deployment Registry

This directory tracks committed deployment artifacts and ABI snapshots used by tooling and operational docs.

## Current Canonical Release

- Base mainnet release target / deploy namespace is now `v1.8.3`.
- Release packet: `docs/operations/deployment/releases/v1.8.3-mainnet.md`
- Bytecode / codeId manifest: `deployments/base/v1.8.3-bytecode-manifest.json`
- Live Base deployment snapshots under `deployments/base/contracts/**/*.json` still reflect the current onchain Base epoch until the `v1.8.3` broadcast completes.

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
