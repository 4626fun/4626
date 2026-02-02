---
title: Core contracts
sidebar_position: 1
---

# Core contracts

The core contracts implement the fundamental vault and token system.

---

## Contracts

| Contract | Description |
|----------|-------------|
| [CreatorOVault](./creator-ovault) | ERC-4626 tokenized vault |
| [CreatorOVaultWrapper](./creator-ovault-wrapper) | ▢TOKEN ↔ ■TOKEN converter |
| [CreatorShareOFT](./creator-share-oft) | LayerZero OFT for cross-chain |

---

## Relationships

```
                TOKEN (Creator Coin)
                        │
                        ▼
               ┌─────────────────┐
               │  CreatorOVault  │◄──── Yield Strategies
               │   (ERC-4626)    │
               │   [▢TOKEN]      │
               └─────────────────┘
                        │
                        ▼
               ┌─────────────────┐
               │     Wrapper     │
               └─────────────────┘
                        │
                        ▼
               ┌─────────────────┐
               │ CreatorShareOFT │◄──── LayerZero
               │   [■TOKEN]      │◄──── DEX Trading
               └─────────────────┘◄──── CCA Auction
```

---

## Token flow

1. User deposits TOKEN → Vault mints ▢TOKEN
2. User wraps ▢TOKEN → Wrapper mints ■TOKEN
3. ■TOKEN can be traded, bridged, or auctioned
4. User unwraps ■TOKEN → Wrapper burns, returns ▢TOKEN
5. User withdraws ▢TOKEN → Vault burns, returns TOKEN
