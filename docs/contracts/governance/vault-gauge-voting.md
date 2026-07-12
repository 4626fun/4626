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
function getVaultGaugeProbabilityBoostPPM(address vault) external view returns (uint256);
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
