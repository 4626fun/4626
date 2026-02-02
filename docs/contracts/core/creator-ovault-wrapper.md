---
title: CreatorOVaultWrapper
sidebar_position: 2
---

# CreatorOVaultWrapper

Converts between vault shares (▢TOKEN) and wrapped OFT shares (■TOKEN) with normalization.

**Source:** `contracts/vault/CreatorOVaultWrapper.sol`

---

## Overview

The wrapper provides bidirectional conversion between ▢TOKEN and ■TOKEN, normalizing the vault's 1000x decimals offset so users see intuitive amounts.

---

## Normalization

The vault uses a `10^3` decimals offset for security. The wrapper normalizes this:

| Direction | Conversion |
|-----------|------------|
| Wrap | ▢TOKEN / 1000 = ■TOKEN |
| Unwrap | ■TOKEN × 1000 = ▢TOKEN |

**Example:**
- Deposit 100 AKITA → 100,000 ▢AKITA → Wrap → 100 ■AKITA
- Unwrap 100 ■AKITA → 100,000 ▢AKITA → Withdraw → 100 AKITA

**Result:** 1 TOKEN ≈ 1 ■TOKEN (clean UX)

---

## Functions

### One-step operations

For users who want TOKEN ↔ ■TOKEN directly:

```solidity
// TOKEN → ■TOKEN (deposit + wrap)
function deposit(uint256 assets, address receiver) 
    external returns (uint256 oftAmount);

// ■TOKEN → TOKEN (unwrap + withdraw)
function withdraw(uint256 oftAmount, address receiver) 
    external returns (uint256 assets);
```

### Core conversion

For integrations working with vault shares:

```solidity
// ▢TOKEN → ■TOKEN
function wrap(uint256 vaultShares, address receiver) 
    external returns (uint256 oftAmount);

// ■TOKEN → ▢TOKEN
function unwrap(uint256 oftAmount) 
    external returns (uint256 vaultShares);
```

### View functions

```solidity
// Preview wrap output
function previewWrap(uint256 vaultShares) 
    public pure returns (uint256 oftAmount);

// Preview unwrap output
function previewUnwrap(uint256 oftAmount) 
    public pure returns (uint256 vaultShares);

// Preview deposit output
function previewDeposit(uint256 assets) 
    public view returns (uint256 oftAmount);

// Preview withdraw output
function previewWithdraw(uint256 oftAmount) 
    public view returns (uint256 assets);
```

---

## State

```solidity
// Immutables
IERC20 public immutable creatorCoin;    // TOKEN
IERC4626 public immutable vault;         // ▢TOKEN

// Mutable
IMintableBurnableOFT public shareOFT;    // ■TOKEN

// Accounting
uint256 public totalLocked;              // ▢TOKEN held
uint256 public totalMinted;              // ■TOKEN minted

// Configuration
uint256 public constant NORMALIZATION_FACTOR = 1000;
```

---

## Flow diagrams

### Wrap flow

```
User has ▢TOKEN
      │
      ▼
┌─────────────────┐
│     Wrapper     │
│                 │
│  1. Transfer    │
│     ▢TOKEN in   │
│                 │
│  2. Calculate   │
│     ■TOKEN      │
│     = ▢TOKEN    │
│       / 1000    │
│                 │
│  3. Mint        │
│     ■TOKEN out  │
└─────────────────┘
      │
      ▼
User receives ■TOKEN
```

### Unwrap flow

```
User has ■TOKEN
      │
      ▼
┌─────────────────┐
│     Wrapper     │
│                 │
│  1. Burn        │
│     ■TOKEN in   │
│                 │
│  2. Calculate   │
│     ▢TOKEN      │
│     = ■TOKEN    │
│       × 1000    │
│                 │
│  3. Transfer    │
│     ▢TOKEN out  │
└─────────────────┘
      │
      ▼
User receives ▢TOKEN
```

---

## Integration

### Wrapping vault shares

```solidity
// User has ▢AKITA from vault deposit

// Approve wrapper
vault.approve(address(wrapper), vaultShares);

// Wrap to ■AKITA
uint256 oftAmount = wrapper.wrap(vaultShares, receiver);
```

### One-step deposit

```solidity
// User has AKITA, wants ■AKITA

// Approve wrapper for TOKEN
creatorCoin.approve(address(wrapper), assets);

// Deposit and wrap in one call
uint256 oftAmount = wrapper.deposit(assets, receiver);
```

### One-step withdrawal

```solidity
// User has ■AKITA, wants AKITA

// Approve wrapper for ■TOKEN
shareOFT.approve(address(wrapper), oftAmount);

// Unwrap and withdraw in one call
uint256 assets = wrapper.withdraw(oftAmount, receiver);
```

---

## Events

```solidity
event Wrapped(address indexed from, uint256 vaultShares, uint256 oftAmount);
event Unwrapped(address indexed from, uint256 oftAmount, uint256 vaultShares);
event Deposited(address indexed from, uint256 assets, uint256 oftAmount);
event Withdrawn(address indexed from, uint256 oftAmount, uint256 assets);
```

---

## Related

- [Token Model](/overview/token-model) - Token relationships
- [CreatorOVault](./creator-ovault) - Vault contract
- [CreatorShareOFT](./creator-share-oft) - OFT contract
