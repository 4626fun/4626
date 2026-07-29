---
title: CreatorOVault
sidebar_position: 2
---

# CreatorOVault

**Product role:** Holds the creator's Zora **creator coin**, mints **▢ vault shares**, and routes TVL to paid strategies (Charm, Ajna). Holders deposit creator coin and redeem by burning shares — one ERC-4626 vault per creator.

ERC-4626 vault (Yearn V3 architecture). Holds deposited creator coins, mints ▢ shares, allocates across yield strategies, and tracks price per share (PPS).

## Key Functions

### User Operations

```solidity
function deposit(uint256 assets, address receiver) external returns (uint256 shares);
function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares);
function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets);
```

### View Functions

```solidity
function pricePerShare() external view returns (uint256);
function totalAssets() external view returns (uint256);
function previewDeposit(uint256 assets) external view returns (uint256 shares);
function previewWithdraw(uint256 assets) external view returns (uint256 shares);
```

### Strategy Management

```solidity
function addStrategy(address strategy, uint256 debtRatio) external onlyManagement;
function removeStrategy(address strategy) external onlyManagement;
function report(uint256 gain, uint256 loss) external onlyKeeper;
```

## Security Features

| Feature | Description |
|---------|-------------|
| **Virtual shares** | 1e3 offset prevents inflation attacks |
| **Minimum deposit** | 50M tokens on first deposit (activation finalize enforces 50M–100M via batcher) |
| **Price limits** | 10% max change per transaction |
| **Block delay** | Prevents flash loan attacks |
| **Strict transfer accounting** | Reverts if vault does not receive the exact requested amount |

## Token compatibility

Assumes standard ERC-20 behavior where `transfer`/`transferFrom` move the exact amount requested. Reverts on fee-on-transfer, deflationary, or rebasing tokens.

## Access Control

| Role | Permissions |
|------|-------------|
| **Owner** | Full control, emergency shutdown |
| **Management** | Strategy configuration |
| **Keeper** | Profit reporting, tending |
| **EmergencyAdmin** | Emergency shutdown only |

Risk report: [CreatorOVault risk report](/audits/creator-ovault-report)

Prev: [Registry4626](/contracts/core/creator-registry) · Next: [CreatorShareOFT](/contracts/core/creator-share-oft)
