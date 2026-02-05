---
title: VaultGaugeVoting
sidebar_position: 2
---

# VaultGaugeVoting

Weekly voting that allocates a bounded probability budget across whitelisted vaults.

## Purpose

VaultGaugeVoting enables ve4626 holders to:
- Vote on probability allocations for vaults
- Direct a bounded weekly probability budget
- Boost lottery win chances for preferred vaults

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
FinalPPM = BasePPM × PersonalBoost + LockDurationBoostPPM + VaultGaugeBoostPPM
```

Where:
- **BasePPM**: Derived from swap size
- **PersonalBoost**: ve4626 (up to 2.5x)
- **LockDurationBoostPPM**: Additive boost from lock duration
- **VaultGaugeBoostPPM**: Additive boost from gauge voting

## Weekly Epochs

- Voting periods are weekly
- Votes persist until changed
- Probability budgets reset each epoch
