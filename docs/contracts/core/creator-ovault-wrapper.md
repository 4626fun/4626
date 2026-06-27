---
title: CreatorOVaultWrapper
sidebar_position: 3
---

# CreatorOVaultWrapper

**Product role:** Converts **▢ vault shares** into **■ Share OFT** 1:1 so shares can bridge via LayerZero without diluting vault ownership.

Wraps vault shares into LayerZero OFT tokens for cross-chain transfers.

## Purpose

The CreatorOVaultWrapper:
- Wraps vault shares (▢TOKEN) into OFT tokens (■TOKEN)
- Enables cross-chain transfers via LayerZero V2
- Maintains 1:1 wrapping ratio (no dilution)

## Key Functions

### Wrapping

```solidity
// Wrap vault shares into OFT tokens
function wrap(uint256 shares) external returns (uint256 oftAmount);

// Unwrap OFT tokens back to vault shares
function unwrap(uint256 oftAmount) external returns (uint256 shares);
```

### View Functions

```solidity
// Get the vault shares token address
function vaultShares() external view returns (address);

// Get the OFT token address
function shareOFT() external view returns (address);
```

## Wrapping Flow

```
User has ▢AKITA vault shares
   ↓
wrapper.wrap(shares)
   ↓
Vault shares locked in wrapper
   ↓
■AKITA OFT minted to user
   ↓
User can bridge via LayerZero
```

## Unwrapping Flow

```
User has ■AKITA OFT tokens
   ↓
wrapper.unwrap(oftAmount)
   ↓
OFT tokens burned
   ↓
Vault shares released to user
   ↓
User can redeem from vault
```

## 1:1 Ratio

The wrapping ratio is always 1:1:
- 1 ▢AKITA = 1 ■AKITA
- No fees on wrap/unwrap
- No dilution from cross-chain transfers

## Integration with GaugeController

When trading fees are collected:
1. ShareOFT sends fees to GaugeController
2. GaugeController calls `wrapper.unwrap()`
3. Vault shares distributed according to split
