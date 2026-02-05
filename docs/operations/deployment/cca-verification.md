---
title: CCA Verification
sidebar_position: 2
---

# CCA Verification

Verify your Continuous Clearing Auction deployment.

## Verification Steps

### 1. Check Auction Status

```solidity
AuctionStatus status = ccaStrategy.getAuctionStatus();
```

### 2. Verify Parameters

- Auction duration correct
- Reserve price set (if applicable)
- Fee tier configured

### 3. Test Bidding

- Submit test bid
- Verify bid recorded
- Check clearing price calculation

## Post-Auction

### 1. Verify Migration

```solidity
// Check liquidity migrated
address pool = ccaStrategy.getPool();
```

### 2. Verify Trading

- Execute test trade
- Confirm 6.9% fee collected
- Verify lottery entry created
