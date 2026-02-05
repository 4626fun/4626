---
title: Activate Vault
sidebar_position: 3
---

# Activate Vault

Guide to activating your vault and starting the CCA auction.

## Activation Steps

### 1. Approve Tokens

```solidity
creatorCoin.approve(vault, depositAmount);
```

### 2. Deposit to Vault

```solidity
vault.deposit(depositAmount, msg.sender);
```

### 3. Wrap Shares

```solidity
vaultShares.approve(wrapper, shareAmount);
wrapper.wrap(shareAmount);
```

### 4. Start CCA Auction

```solidity
ccaStrategy.startAuction(assets, auctionParams);
```

## Via VaultActivationBatcher

For wallets supporting batching:

```solidity
batcher.activateAndLaunch(
    vault,
    depositAmount,
    auctionParams
);
```

## Post-Activation

After activation:
- CCA auction begins
- Bidders can participate
- After auction ends, liquidity migrates to Uniswap V4
- 6.9% trading fee becomes active
- Lottery entries start triggering
