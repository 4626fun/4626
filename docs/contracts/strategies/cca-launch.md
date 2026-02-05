---
title: CCA Launch Strategy
sidebar_position: 2
---

# CCA Launch Strategy

Uniswap Continuous Clearing Auction integration for fair launch price discovery.

## Purpose

The CCA Launch Strategy:
- Allocates vault assets to Uniswap CCA
- Manages auction lifecycle
- Migrates liquidity to AMM post-auction

## Auction Flow

```
Creator deposits tokens
   ↓
Strategy allocates to CCA
   ↓
Auction runs (24-72 hours)
   ↓
Clearing price determined
   ↓
Liquidity migrated to Uniswap V4
   ↓
Trading begins with 6.9% fee
```

## Key Functions

```solidity
// Start auction with deposited assets
function startAuction(uint256 assets, AuctionParams calldata params) external;

// Check auction status
function getAuctionStatus() external view returns (AuctionStatus);

// Trigger liquidity migration (after auction ends)
function migrate() external;
```

## Auction Parameters

| Parameter | Description |
|-----------|-------------|
| **Duration** | Auction length (24-72 hours typical) |
| **Reserve price** | Minimum acceptable price |
| **Fee tier** | Uniswap V4 pool fee (typically 3%) |
