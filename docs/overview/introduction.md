---
title: Introduction
sidebar_position: 1
---

# Introduction to 4626

4626 is a protocol for creating tokenized creator vaults on Base. It enables creators to launch ERC-4626 compliant vaults backed by their Zora Creator Coins, with integrated yield strategies, governance, and cross-chain functionality.

**Who this is for:** Developers, integrators, and operators working with the 4626 protocol.

---

## Core concepts

### Creator Vault

A Creator Vault (`CreatorOVault`) is an ERC-4626 tokenized vault that:
- Accepts creator coin deposits
- Issues vault shares (▢TOKEN)
- Deploys capital to yield strategies
- Distributes returns to shareholders

### Token notation

| Token type | Symbol | Contract |
|------------|--------|----------|
| Creator coin | TOKEN | Zora Creator Coin |
| Vault shares | ▢TOKEN | CreatorOVault |
| Wrapped shares (OFT) | ■TOKEN | CreatorShareOFT |

### Strategies

Vaults use two types of strategies:

**Launch strategy (auctions ■TOKEN wrapped shares):**
- **CCA Launch Strategy** - Continuous Clearing Auction to bootstrap liquidity

**Yield strategies (deploy TOKEN for yield):**
- **Charm Strategy** - Uniswap V3 concentrated liquidity via Charm Alpha Vaults
- **Ajna Strategy** - Lending via Ajna Protocol
- **Uniswap V4 Strategies** - Full range, concentrated, and limit order strategies

---

## Architecture overview

```
Creator Coin (TOKEN)
       |
       v
+--------------------+
|   CreatorOVault    |  <-- ERC-4626 vault
| Issues ▢TOKEN shares|
+--------------------+
       |
       +-----> CreatorShareOFT (■TOKEN) -- Cross-chain via LayerZero
       |
       v
+--------------------+
|     Strategies     |
+--------------------+
       |
       +---> CCA Strategy -----> Auctions ■TOKEN (wrapped shares)
       |
       +---> Charm Strategy ---> Deploys TOKEN (V3 LP)
       |
       +---> Ajna Strategy ----> Lends TOKEN
```

**Key insight:** CCA auctions wrapped shares (■TOKEN) for price discovery, while yield strategies deploy the underlying creator coin (TOKEN).

---

## Key contracts

| Contract | Purpose |
|----------|---------|
| `CreatorOVault` | Main ERC-4626 vault |
| `CreatorOVaultWrapper` | Wraps vault shares for OFT |
| `CreatorShareOFT` | LayerZero OFT for cross-chain |
| `CreatorGaugeController` | Fee distribution and gauge voting |
| `VaultGaugeVoting` | ve(3,3) style voting |
| `CreatorLotteryManager` | Jackpot lottery system |
| `CreatorRegistry` | Global registry of vaults and tokens |

---

## Getting started

1. **Deploy a vault** - Use `CreatorOVaultFactory` or `CreatorVaultDeployer`
2. **Add strategies** - Configure yield strategies via admin UI
3. **Activate** - Use `VaultActivationBatcher` for 1-click activation
4. **Manage** - Monitor via frontend, adjust strategies as needed

---

## Documentation structure

| Section | Contents |
|---------|----------|
| [Overview](/overview) | Architecture, strategies, naming conventions |
| [Contracts](/contracts) | Smart contract details |
| [Operations](/operations) | Deployment and automation |
| [Governance](/governance) | ve(3,3) voting and bribes |
| [Guides](/guides) | Tutorials and troubleshooting |
| [API Reference](/api) | Auto-generated contract and frontend docs |

---

## References

- [Strategy architecture](/overview/architecture/strategy-architecture)
- [Fee architecture](/overview/architecture/fee-architecture)
- [Account abstraction](/overview/account-abstraction/activation)
