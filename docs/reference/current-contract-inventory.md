---
title: Current Contract Inventory
sidebar_position: 5
---

# Current Contract Inventory (Base)

Generated on: 2026-04-07  
Scope: `v1.8.1` vanity-epoch planning materials and current canonical Base defaults.

## Sources

1. Fresh epoch deterministic outputs (`INFRA_*_SALT_TAG` set to `...:v1.8.1`)
2. Frontend defaults: `frontend/src/config/contracts.defaults.ts`
3. Active manifests: `deployments/base/contracts/**/*.json`
4. Vanity planning catalog and manifest:
   - `deployments/base/shared-global-vanity-targets.json`
   - `deployments/base/v1.8.1-vanity-manifest.json`
5. Archived prior snapshot: `deployments/base/archive/2026-01-addresses.json`

## Planned v1.8.1 Vanity Infra Targets

| Contract / Field | Address |
|---|---|
| `registry` | `0x888506B92181c57A2fD06516FFFb6F375b7A4626` |
| `bytecodeStore` | `0x58071d59d2f5E61A80b3f8770B6564289acD4626` |
| `create2DeployerFromStore` | `0x1c1596090B0e0Bb35b2F7cd77e865FbeE3654626` |
| `deploymentBatcher` | `0xaE81C19c2A2E964e65cCacE89A6eb2309d6E4626` |
| `deploymentBatcherPhase3Helper` | `0x625992eAdA5942192b029c2a0DF5cBECc65509FB` |
| `creatorOVaultCoreModule` | `0x9379761d3680401f4d412048B3Ff6FE05dE04626` |
| `creatorOVaultStrategiesModule` | `0x8fd50C3695749F95801E8c867E264100c2C54626` |
| `creatorOVaultAdminModule` | `0x6De6c3F10291e87fAEB7590CE01E400571434626` |
| `vaultActivationBatcher` | `0xd17Ddf952Cc8614721b5F79E43E9c2562FaBcdeB` |
| `lotteryManager` | `0x3F7AfD93824Ab25F73Bdca59aFDaB560F865b0C3` |
| `solanaBridgeAdapter` | `0x2414b595c4f18532A5836B6e2E6d536832c572e8` |
| `permit2` | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |
| `usdc` | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |

Planning disposition for this epoch:
- Phase-1 vanity targets are precomputed in `deployments/base/v1.8.1-vanity-manifest.json`
- Constructor-derived helpers are tracked for deterministic drift but are not suffix-enforced
- Historical `v1.7.1` release evidence remains preserved in its dedicated release packet/checklist pages

## Frontend/API Defaults

From `frontend/src/config/contracts.defaults.ts`:

| Key | Address |
|---|---|
| `registry` | `0x888506B92181c57A2fD06516FFFb6F375b7A4626` |
| `creatorVaultBatcher` | `0x14435cc4A8D307b4d3979148E5AB71Af1ed19088` |
| `creatorVaultBatcherAutoHandoff` | `0x14435cc4A8D307b4d3979148E5AB71Af1ed19088` |
| `universalBytecodeStore` | `0x6A578022609cdb65C614FF28912C49FC1EC97071` |
| `universalCreate2DeployerFromStore` | `0x5ea71D4d03dEe596E93B5e6BEddA6F96BBF9d36a` |

## Active Manifests

Current live deployment manifests remain in `deployments/base/contracts/**/*.json`.
The planned vanity-epoch manifest lives in:

- `deployments/base/v1.8.1-vanity-manifest.json`
- `deployments/base/v1.8.1-bytecode-manifest.json`

The previous `2026-01` address set is archived in:

- `deployments/base/archive/2026-01-addresses.json`

## Bytecode / CodeId Evidence

Historical release bytecode manifest:

- `deployments/base/v1.7.1-bytecode-manifest.json`

For each deployment contract this includes:

- `creationBytecodeHash`
- `codeId` (`keccak256(creationCode)`)
- bytecode size in bytes

## Canonical Ajna Strategy Inventory

The canonical phase-3 Ajna sleeve remains:

1. `ERC4626StrategyAdapter`
2. `AjnaERC4626Vault`
3. `AjnaVaultAuth`

Deploy/codeId manifests must include all three entries.

## Cutover Checklist

Before broadcasting the planned `v1.8.1` vanity epoch:

1. Regenerate `deployments/base/v1.8.1-vanity-manifest.json` from `tools/vanity-salt-grinder`.
2. Regenerate `deployments/base/v1.8.1-bytecode-manifest.json` from `script/generate_bytecode_manifest.sh`.
3. Export the raw `INFRA_*_SALT` values or pass `INFRA_VANITY_MANIFEST_PATH` into the deploy script.
4. Keep `frontend/src/config/contracts.defaults.ts` and env examples aligned with the final onchain cutover values after broadcast.

Operator packet:

- `docs/operations/deployment/releases/v1.8.1-mainnet.md`
- `docs/operations/deployment/releases/v1.8.1-pre-broadcast-checklist.md`
