---
title: Approvals Checklist
sidebar_position: 3
---

# Approvals Checklist

Required token approvals for 4626 operations.

## Deployment Approvals

| Token | Spender | Purpose |
|-------|---------|---------|
| Creator Coin | Vault | Initial deposit |
| Vault Shares | Wrapper | Wrap to OFT |
| OFT | DEX Router | Trading |

## User Approvals

| Token | Spender | Purpose |
|-------|---------|---------|
| Creator Coin | Vault | Deposit |
| Vault Shares | Wrapper | Wrap |
| OFT | DEX | Trade |

## Setting Approvals

```solidity
// Approve vault to spend creator coins
IERC20(creatorCoin).approve(vault, type(uint256).max);

// Approve wrapper to spend vault shares
IERC20(vaultShares).approve(wrapper, type(uint256).max);
```
