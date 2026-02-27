---
title: BaseCreatorStrategy
sidebar_position: 1
---

# BaseCreatorStrategy

Base implementation for all 4626 yield strategies.

## Purpose

BaseCreatorStrategy provides:
- Common interface for all strategies
- Integration with vault debt management
- Profit reporting framework
- Emergency withdrawal support

## Key Functions

```solidity
// Deposit assets into strategy
function deposit(uint256 assets) external returns (uint256);

// Withdraw assets from strategy
function withdraw(uint256 assets) external returns (uint256);

// Report gains/losses to vault
function report() external returns (uint256 gain, uint256 loss);

// Emergency withdrawal
function emergencyWithdraw() external onlyVault;
```

## Creating Custom Strategies

To create a custom strategy:

1. Inherit from `BaseCreatorStrategy`
2. Implement `_invest()` and `_divest()` internal functions
3. Implement `_totalAssets()` to report managed assets
4. Register with vault via `vault.addStrategy()`
