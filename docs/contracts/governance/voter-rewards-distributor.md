---
title: VoterRewardsDistributor
sidebar_position: 4
---

# VoterRewardsDistributor

Distributes the 9.61% voter rewards slice to ve4626 voters.

## Purpose

The VoterRewardsDistributor:
- Receives voter rewards from GaugeController
- Tracks rewards per epoch and vault
- Enables pro-rata claims for voters

## Key Functions

### Receiving Rewards

```solidity
// Called by GaugeController when distributing fees
function notifyRewards(
    address vault,
    address token,
    uint256 amount
) external;
```

### Claiming

```solidity
// Claim rewards for an epoch
function claim(address vault, uint256 epoch) external;

// Claim all pending rewards
function claimAll() external;
```

### View Functions

```solidity
// Get claimable rewards for user
function getClaimable(
    address user,
    address vault,
    uint256 epoch
) external view returns (uint256);

// Get total rewards for epoch
function getTotalRewards(address vault, uint256 epoch) external view returns (uint256);
```

## Reward Flow

```
GaugeController distributes fees
   ↓
9.61% sent to VoterRewardsDistributor
   ↓
notifyRewards() tracks per vault/epoch
   ↓
Voters claim pro-rata based on:
   - Their ve4626 balance at epoch
   - Their votes for the vault
```

## Epoch-Based Distribution

- Rewards accumulate per epoch (weekly)
- Claims available after epoch ends
- Pro-rata based on voting weight
