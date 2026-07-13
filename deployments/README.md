# 4626 Deployment Registry

This directory tracks committed deployment artifacts and ABI snapshots used by tooling and operational docs.

## V1 greenfield posture

Treat **`deployments/base/contracts/**` as the V1 interface registry**:

- **ABI** = current `contracts/` source (export via `node scripts/export-v1-deployment-abis.mjs` after `forge build --skip test`).
- **`address` / `deployedAt` / `deploymentTx`** = `null` until the first Base broadcast of that bytecode.
- **`release`**: `v1-greenfield` on exported snapshots.

Do **not** mix historical on-chain addresses with V1 ABIs. Versioned bytecode manifests under `deployments/base/v*.json` remain for prior epochs / audits only.

### Export command

```bash
forge build --skip test
node scripts/export-v1-deployment-abis.mjs
node scripts/check-abi-source-naming-parity.mjs --fail
```

## Directory map

```
deployments/
└── base/
    ├── v1.*.json                     ← historical bytecode manifests (audit)
    ├── archive/                      ← immutable historical address / ABI snapshots
    └── contracts/                    ← V1 ABI + deploy metadata
        ├── core/Registry4626.json
        ├── creator/                    ← full creator vault stack ABIs
        │   ├── CreatorOVault.json
        │   ├── CreatorOVaultWrapper.json
        │   ├── CreatorShareOFT.json
        │   ├── CreatorOVaultCoreModule.json
        │   ├── CreatorOracle.json
        │   ├── CreatorGaugeController.json
        │   ├── CreatorPayoutRouter.json
        │   └── CreatorCoinPolicyController.json
        ├── agent/                      ← full agent (AgentTokenV4) vault stack ABIs
        │   ├── AgentOVault.json
        │   ├── AgentOVaultWrapper.json
        │   ├── AgentShareOFT.json
        │   ├── AgentOVaultCoreModule.json
        │   ├── AgentOracle.json
        │   ├── AgentGaugeController.json
        │   ├── AgentRevenueRouter.json
        │   ├── AgentRevenuePolicyController.json
        │   └── AgentOVaultTaxAdapter.json
        ├── factories/
        │   ├── OVaultFactory4626.json      ← lane router + legacy registrar
        │   ├── CreatorOVaultFactory.json   ← alias path → OVaultFactory4626 ABI
        │   ├── lanes/
        │   │   ├── CreatorOvaultLane.json
        │   │   └── AgentOvaultLane.json
        │   └── UniversalCreate2DeployerFromStore.json
        ├── governance/
        │   ├── ve4626.json
        │   ├── ve4626GaugeVoting.json
        │   ├── ve4626BoostManager.json
        │   ├── ve4626VoterRewardsDistributor.json
        │   ├── BribeDepot4626.json
        │   ├── BribesFactory4626.json
        │   ├── RewardStream4626.json
        │   ├── RewardStreamFactory4626.json
        │   └── GaugeSurfaceRegistry4626.json
        ├── helpers/
        └── services/
            └── lottery/
                ├── LotteryManager4626.json
                └── vrf/VRFConsumer4626.json
```

The removed Twin `SolanaBridgeAdapter` snapshot is preserved at
`base/archive/SolanaBridgeAdapter.retired.json` for on-chain archaeology only.
It is not part of the V1 interface registry or the active LayerZero ShareOFT
deployment plane.

Lane ABIs are **templates** for per-vault deploys: V1 export sets `address: null`. After each creator/agent vault broadcast, either record the instance address in ops tooling or keep these as interface-only snapshots.


## File conventions

| Path | Role |
|------|------|
| `base/contracts/**/<Contract>.json` | V1 ABI + optional deploy metadata (`address` null pre-broadcast) |
| `base/vX.Y.Z-bytecode-manifest.json` | Historical release bytecode hashes |
| `base/archive/*` | Frozen address archaeology |

## Maintenance

1. After any ABI-affecting Solidity change: rebuild + `export-v1-deployment-abis.mjs`.
2. After first broadcast of a contract: fill `address`, `deployedAt`, `deploymentTx`, `deployedBy` on that JSON only.
3. Never rewrite archive snapshots; append new archive files if needed.
4. Naming policy: `docs/contracts/governance/contract-naming.md` + `ve-naming.md`.
