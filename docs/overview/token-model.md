---
title: Token Model
sidebar_position: 3
---

# Token Model

CreatorVault uses a layered token model that enables cross-chain liquidity while maintaining security.

## Token Layers

| Layer | Symbol | Description |
|-------|--------|-------------|
| **Creator Coin** | akita | The underlying creator token (e.g., Zora Creator Coin) |
| **Vault Shares** | ▢AKITA | ERC-4626 vault shares representing deposited creator coins |
| **OFT Shares** | ■AKITA | LayerZero OFT-wrapped vault shares for cross-chain transfers |

## Token Flow

```
Creator Coin (akita)
   ↓ Deposit
CreatorOVault (▢AKITA shares)
   ↓ Wrap
CreatorOVaultWrapper
   ↓ Mint
CreatorShareOFT (■AKITA)
   ↓ Bridge
LayerZero V2 Messaging → Arbitrum, Ethereum, BSC, etc.
   ↓ Unwrap on destination chain
▢AKITA → Redeem → akita (if available on that chain)
```

## Wrapping Ratio

The wrapping ratio is always **1:1**:

- 1 ▢AKITA vault share = 1 ■AKITA OFT token
- No dilution from wrapping/unwrapping
- Cross-chain transfers preserve exact value

## Price Per Share (PPS)

The vault's Price Per Share represents the value of vault shares:

- **Initial PPS**: 1.0 (one share = one deposited token)
- **PPS increases** when:
  - Strategies generate yield
  - Shares are burned (21.39% of trading fees)
- **PPS never decreases** (except for strategy losses)

## Trading Fee Impact

The 6.9% trading fee affects token holders:

| Allocation | Effect |
|------------|--------|
| **69% to lottery** | Prize pool grows, traders can win |
| **21.39% burned** | PPS increases for all holders |
| **9.61% voter rewards** | Incentivizes ve4626 governance participation |
