---
title: CreatorOVault
sidebar_position: 2
---

# CreatorOVault

**Product role:** Holds your Zora **creator coin**, mints **▢ vault shares**, and routes TVL to paid strategies (Charm, Ajna). Holders deposit creator coin and redeem by burning shares — one ERC-4626 vault per creator.

ERC-4626 compliant vault based on Yearn V3 architecture.

## Purpose

The CreatorOVault:
- Holds deposited Creator Coins
- Mints vault shares (▢TOKEN) representing ownership
- Allocates deposits across yield strategies
- Tracks Price Per Share (PPS)

## Key Functions

### User Operations

```solidity
// Deposit creator coins, receive vault shares
function deposit(uint256 assets, address receiver) external returns (uint256 shares);

// Withdraw creator coins by burning shares
function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares);

// Redeem shares for creator coins
function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets);
```

### View Functions

```solidity
// Get current price per share
function pricePerShare() external view returns (uint256);

// Get total assets under management
function totalAssets() external view returns (uint256);

// Preview deposit result
function previewDeposit(uint256 assets) external view returns (uint256 shares);

// Preview withdrawal result
function previewWithdraw(uint256 assets) external view returns (uint256 shares);
```

### Strategy Management

```solidity
// Add a new yield strategy
function addStrategy(address strategy, uint256 debtRatio) external onlyManagement;

// Remove a strategy
function removeStrategy(address strategy) external onlyManagement;

// Report strategy profits
function report(uint256 gain, uint256 loss) external onlyKeeper;
```

## Security Features

| Feature | Description |
|---------|-------------|
| **Virtual shares** | 1e3 offset prevents inflation attacks |
| **Minimum deposit** | 5M tokens on first deposit |
| **Price limits** | 10% max change per transaction |
| **Block delay** | Prevents flash loan attacks |
| **Strict transfer accounting** | Reverts if vault does not receive the exact requested amount |

## Token Compatibility (Important)

`CreatorOVault` assumes the creator coin behaves like a standard ERC-20 where `transfer`/`transferFrom` move the exact amount requested.

The vault will revert deposits/mints/capital injections/debt purchases if the vault's token balance increases by less than the requested amount. This intentionally rejects:

- Fee-on-transfer / transfer-tax tokens
- Deflationary tokens (burn-on-transfer)
- Rebasing tokens (supply/balance changes not tied to transfers)

## Access Control

| Role | Permissions |
|------|-------------|
| **Owner** | Full control, emergency shutdown |
| **Management** | Strategy configuration |
| **Keeper** | Profit reporting, tending |
| **EmergencyAdmin** | Emergency shutdown only |

## Events

```solidity
event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares);
event Withdraw(address indexed sender, address indexed receiver, address indexed owner, uint256 assets, uint256 shares);
event StrategyAdded(address indexed strategy, uint256 debtRatio);
```
