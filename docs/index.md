---
title: 4626 Documentation
sidebar_position: 1
slug: /
---

# 4626 Documentation

Welcome to the CreatorVault protocol documentation.

---

## Quick start

| Goal | Documentation |
|------|---------------|
| Understand the protocol | [Introduction](/overview/introduction) |
| Deploy a vault | [Pre-launch checklist](/operations/deployment/pre-launch) |
| Integrate with 4626 | [Contract overview](/contracts) |
| Use governance | [ve(3,3) system](/governance) |

---

## Documentation sections

| Section | Description |
|---------|-------------|
| [Overview](/overview) | Architecture, strategies, and core concepts |
| [Contracts](/contracts) | Smart contract documentation |
| [Operations](/operations) | Deployment and automation |
| [Governance](/governance) | ve(3,3) voting and bribes |
| [Integrations](/integrations) | Cross-chain and external systems |
| [Guides](/guides) | Tutorials and troubleshooting |
| [API Reference](/api) | Auto-generated contract and frontend docs |

---

## Key concepts

### Token notation

| Symbol | Description | Contract |
|--------|-------------|----------|
| TOKEN | Creator coin | Zora Creator Coin |
| ▢TOKEN | Vault shares | CreatorOVault |
| ■TOKEN | Wrapped shares (OFT) | CreatorShareOFT |

### Architecture

```
Creator Coin (TOKEN)
        |
        v
+-------------------+
|   CreatorOVault   |
+-------------------+
        |
        +--> Issues ▢TOKEN (vault shares)
        |           |
        |           v
        |    +------------------+
        |    | Wrap via Wrapper |
        |    +------------------+
        |           |
        |           v
        |    ■TOKEN (OFT) -----> Cross-chain transfers
        |           |
        |           v
        |    CCA Strategy -----> Auctions ■TOKEN for ETH
        |
        +--> Yield Strategies -> Deploy TOKEN for yield
                    |
                    +---> Charm (V3 LP)
                    +---> Ajna (Lending)
```

---

## Contributing

Edit files in `4626/docs/`, not `apps/docs-site/docs/`.

The docs site syncs from source documentation and auto-generates API references from:
- Contract NatSpec comments (`forge doc`)
- Frontend TypeScript types (`typedoc`)
