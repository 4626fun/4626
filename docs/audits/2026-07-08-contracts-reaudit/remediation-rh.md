# Remediation — Re-audit P0 (R-H01 / R-H02 / R-H03)

**Date:** 2026-07-08  
**Status:** Shipped

## R-H01 — Strategy eject updates claim book

| | |
|--|--|
| **File** | `contracts/shared/vault/modules/OVaultStrategiesModule.sol` |
| **Change** | On impaired eject recovery: require Finalized/Resolved + `recoveryAsset == vault asset`; push → notify → **`epoch.totalRecovered += recovered`** + `ImpairmentRecoveryNotified` |

## R-H02 — Per-asset free custody

| | |
|--|--|
| **File** | `contracts/shared/vault/recovery/OVaultRecoveryEscrow.sol` |
| **Change** | `totalUnclaimedRecoveryByAsset[asset]`; free = `held(asset) - unclaimed(asset)`; global sum retained for vault-update gates |

## R-H03 — Remote lottery eligible coverage

| | |
|--|--|
| **Files** | `CreatorShareOFT.sol`, `AgentShareOFT.sol`, `LotteryManager4626.sol` |
| **Change** | Remote queue stores `balanceEligibleForLotteryCoverage(buyer)`; hub `_handleLotteryEntry` re-caps via `_coverageShareBalance` when `tokenIn` has code on hub |

## Tests

```bash
forge test --match-contract 'Audit20260708_|OVaultRecoveryEscrowTest|CreatorOVaultImpairmentV1Test'
# → 40 passed
```

| Suite | Coverage |
|-------|----------|
| `Audit20260708.Reaudit.P0.t.sol` | R-H01 invariant, R-H02 multi-asset, R-H03 eligible queue |
| `OVaultRecoveryEscrow.t.sol` | per-asset free + prior custody |
| Impairment + pass-1 P0 | no regression |

## Remaining open (not this patch)

H-04 CCA migrate · NEW-H codeId allowlist · H-06–H-08 privilege · R-H04 VRF timelock · R-H05 multi-vault jackpot design · Medium backlog  
