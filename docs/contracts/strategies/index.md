---
title: Strategies
sidebar_position: 3
---

# Yield Strategies

Pluggable yield strategies for 4626.

## Overview

| Strategy | Purpose |
|----------|---------|
| **[BaseCreatorStrategy](/contracts/strategies/base-creator-strategy)** | Base implementation for all strategies |
| **[CCA Launch](/contracts/strategies/cca-launch)** | Uniswap CCA fair launch integration |

## Strategy Architecture

All strategies inherit from `BaseCreatorStrategy` and implement:

```solidity
interface ICreatorStrategy {
    function deposit(uint256 assets) external returns (uint256 shares);
    function withdraw(uint256 assets) external returns (uint256 shares);
    function totalAssets() external view returns (uint256);
    function report() external returns (uint256 gain, uint256 loss);
}
```
