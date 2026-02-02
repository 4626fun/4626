---
title: Reference
sidebar_position: 7
---

# Reference

Technical reference material for the 4626 protocol.

---

## Contents

| Document | Description |
|----------|-------------|
| [Addresses](./addresses) | Contract addresses by chain |
| [Glossary](./glossary) | Key terms and definitions |
| [ERC-4337 Debugging](./erc4337-debugging) | Account abstraction troubleshooting |

---

## Quick reference

### Token symbols

| Symbol | Meaning |
|--------|---------|
| TOKEN | Creator Coin (underlying asset) |
| ▢TOKEN | Vault shares (ERC-4626) |
| ■TOKEN | Wrapped shares (LayerZero OFT) |

### Fee allocation

| Recipient | Percentage |
|-----------|------------|
| Lottery | 69% |
| Burn | 21.39% |
| Voters | 9.61% |

### Key constants

| Constant | Value | Purpose |
|----------|-------|---------|
| Buy fee | 6.9% (690 bps) | DEX purchase fee |
| Performance fee | 10% (1000 bps) | Vault profit fee |
| Min first deposit | 5M tokens | Security threshold |
| Decimals offset | 10^3 | Inflation protection |
| Max lock | 4 years | ve4626 maximum |
| Epoch duration | 7 days | Voting cycle |

---

## External resources

- [LayerZero docs](https://docs.layerzero.network/) - OFT standard
- [Uniswap docs](https://docs.uniswap.org/) - V4 and CCA
- [ERC-4626 spec](https://eips.ethereum.org/EIPS/eip-4626) - Vault standard
- [Charm docs](https://docs.charm.fi/) - Alpha Vaults
- [Ajna docs](https://docs.ajna.finance/) - Lending protocol
