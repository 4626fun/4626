---
title: Activate Vault
sidebar_position: 3
---

# Activate Vault

Guide to activating your vault and starting the CCA auction.

## Preferred Path: Permit2

The preferred activation flow is a single Permit2 signature plus one batcher transaction.

```solidity
batchActivateWithPermit2For(
    owner,
    creatorCoin,
    vault,
    wrapper,
    ccaStrategy,
    depositAmount,
    auctionPercent,
    requiredRaise,
    permit,
    signature
);
```

This path:

- Pulls creator tokens with Permit2 signature transfer
- Deposits into the vault
- Wraps vault shares to `ShareOFT`
- Sends the auction allocation to the CCA strategy
- Returns the non-auction allocation to the owner

## Compatibility Fallback

If the wallet cannot produce the required typed-data signature, the product falls back to the approval-based path.

### 1. Approve Tokens

```solidity
creatorCoin.approve(batcher, depositAmount);
```

### 2. Activate Through The Batcher

```solidity
batchActivate(
    creatorCoin,
    vault,
    wrapper,
    ccaStrategy,
    depositAmount,
    auctionPercent,
    requiredRaise
);
```

## Post-Activation

After activation:
- CCA auction begins
- Bidders can participate
- After auction ends, liquidity migrates to Uniswap V4
- 6.9% trading fee becomes active
- Lottery entries start triggering
