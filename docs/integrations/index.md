---
title: Integrations
sidebar_position: 4
---

# Integrations

This section documents external systems and cross-chain integrations.

**Who this is for:** Developers integrating 4626 with external protocols, chains, or platforms.

---

## Cross-chain

### LayerZero OFT

CreatorShareOFT (■TOKEN) implements LayerZero's OFT standard for cross-chain vault share transfers.

| Feature | Description |
|---------|-------------|
| Standard | LayerZero OFT V2 |
| Token | ■TOKEN (wrapped vault shares) |
| Contract | `CreatorShareOFT.sol` |

### Solana bridge

Experimental integration with Solana via bridge adapters.

- [Solana integration](./solana-integration.md) - Bridge architecture and implementation

---

## Social integrations

### Farcaster

4626 integrates with Farcaster for:
- Mini App distribution
- Social identity verification
- Creator discovery

### Zora

Creator coins are sourced from Zora's Creator Coin system.

---

## Oracles and data

### Creator Oracle

`CreatorOracle.sol` provides price feeds for creator coins.

### DEX integrations

- Uniswap V3 via Charm Alpha Vaults
- Uniswap V4 via native strategies
- DEXScreener API for market data

---

## Documentation

- [Solana integration](./solana-integration.md) - Cross-chain bridge details
