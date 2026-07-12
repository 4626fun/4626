---
title: ve4626GaugeVoting
sidebar_position: 2
---

# ve4626GaugeVoting

Weekly voting that allocates a bounded probability budget across whitelisted vaults.

## Purpose

ve4626GaugeVoting consumes **ve33** (from `ve4626Utility`) so holders can:
- Vote on probability allocations for vaults (gauge / fees / bribes lane)
- Direct a bounded weekly probability budget to preferred vaults
- **Not** the personal lottery multiplier — that is **veLottery** → `ve4626BoostManager`

Canonical naming: [ve-naming.md](./ve-naming.md).

## Key Functions

### Voting

```solidity
// Cast votes for vaults
function vote(address[] calldata vaults, uint256[] calldata weights) external;

// Reset all votes
function resetVotes() external;
```

### View Functions

```solidity
// Get vault's current weight
function getVaultWeight(address vault) external view returns (uint256);

// Get vault's weight in basis points
function getVaultWeightBps(address vault) external view returns (uint256);

// Get total voting weight
function getTotalWeight() external view returns (uint256);

// Get current epoch
function currentEpoch() external view returns (uint256);

// Get vault's probability boost (PPM)
function getVaultProbabilityBoostPPM(address vault) external view returns (uint256);
```

## ve(3,3) Probability Model

The lottery uses this model:

```
FinalPPM = BasePPM × CoveredPersonalBoost + VaultGaugeBoostPPM
```

Where:
- **BasePPM**: Derived from swap size
- **CoveredPersonalBoost**: veLottery Curve multiplier (1×–2.5×), blended by Share coverage
- **VaultGaugeBoostPPM**: Additive boost from gauge voting

## Weekly Epochs

- Voting periods are weekly
- Votes persist until changed
- Probability budgets reset each epoch

## Eligibility (whitelist vs surface registry)

By default, vaults must be **manually whitelisted** (`setVaultWhitelist`) and optionally checked against `Registry4626` when `useRegistryWhitelist` is on.

**Optional Hermes-style surface mode:**

```solidity
setSurfaceRegistry(address gaugeSurfaceRegistry);
setUseSurfaceRegistry(true);
```

When enabled, `canReceiveVotes` / `canReceiveBribes` / `canReceiveStreams` read
[GaugeSurfaceRegistry4626](./gauge-surface-registry.md) instead of the local whitelist.
Vote **weights** still live only on this contract.

### Mid-epoch delist / pause (boost budget)

If a vault loses vote eligibility mid-epoch (surface pause, capability off, whitelist remove
while surface mode is off):

| Path | Behavior |
|------|----------|
| New votes to that vault | Revert (`VaultNotWhitelisted`) |
| New bribes / streams | Revert (`canReceiveBribes` / `canReceiveStreams`) |
| `getVaultProbabilityBoostPPM` | **0** for the ineligible vault |
| Other vaults’ boost | Still divided by **full** `_epochTotalVotes` (orphaned weight stays in the denominator) |

So the share of the fixed **69,420 PPM** budget that sat on the delisted vault is
**burned for the rest of the epoch**, not redistributed. That is intentional: ops cannot
concentrate the full budget onto remaining gauges by delisting peers. Users can re-vote to
reallocate; past-epoch bribe/stream claims still use frozen weights and ignore live eligibility.

`emergencyResetAllVotes` zeros every vault that received weight this epoch (including
surface-only gauges), not only the local whitelist.
