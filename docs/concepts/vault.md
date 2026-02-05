---
title: Vault
sidebar_position: 1
---

# ERC-4626 Vault

The CreatorOVault is an ERC-4626 compliant vault based on Yearn V3 architecture.

## What is a Vault?

A vault is a smart contract that:
- Holds deposited creator coins (e.g., akita)
- Mints vault shares (▢AKITA) representing ownership
- Allocates deposits across yield strategies
- Tracks Price Per Share (PPS) for all holders

## Key Features

### Based on Yearn V3

The vault inherits battle-tested features:
- **Profit unlocking** - Smooth yield distribution
- **Strategy queues** - Multiple yield sources
- **Debt purchasing** - Efficient capital allocation

### Security Features

| Feature | Description |
|---------|-------------|
| **Virtual shares offset** (1e3) | Prevents inflation attacks |
| **Minimum first deposit** | 50M tokens required |
| **Price change limits** | 10% max per transaction |
| **Block delay** | Prevents flash loan attacks |

## Vault Operations

### Deposit

```solidity
// Approve vault to spend creator coins
IERC20(creatorCoin).approve(vault, amount);

// Deposit and receive vault shares
uint256 shares = vault.deposit(amount, recipient);
```

### Withdraw

```solidity
// Withdraw creator coins by burning shares
uint256 assets = vault.withdraw(shares, recipient, owner);
```

### Check Price Per Share

```solidity
uint256 pps = vault.pricePerShare();
```

## PPS Mechanics

The Price Per Share represents vault share value:

| Event | PPS Effect |
|-------|------------|
| Initial deposit | PPS = 1.0 |
| Strategy yield | PPS increases |
| Fee burn (21.39%) | PPS increases |
| Strategy loss | PPS decreases |

## Access Control

| Role | Permissions |
|------|-------------|
| **Owner** | Full control, emergency shutdown |
| **Management** | Add/remove strategies |
| **Keeper** | Report profits, tend strategies |
| **EmergencyAdmin** | Shutdown only (can't steal funds) |
