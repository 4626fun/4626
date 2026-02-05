---
title: Supported Chains
sidebar_position: 6
---

# Supported Chains

CreatorVault uses LayerZero V2 for omnichain share tokens. All chains share the same OFT token.

## Chain Configuration

| Network | Chain ID | LZ Endpoint ID | Status | Explorer |
|---------|----------|----------------|--------|----------|
| **Base** | 8453 | 30184 | Hub chain | [BaseScan](https://basescan.org) |
| **Ethereum** | 1 | 30101 | Configured | [Etherscan](https://etherscan.io) |
| **Arbitrum** | 42161 | 30110 | Configured | [Arbiscan](https://arbiscan.io) |
| **BSC** | 56 | 30102 | Configured | [BscScan](https://bscscan.com) |
| **Avalanche** | 43114 | 30106 | Configured | [SnowTrace](https://snowtrace.io) |
| **Monad** | 10143 | 30390 | Configured | [MonadExplorer](https://monadexplorer.com) |
| **Sonic** | 146 | 30332 | Configured | [SonicScan](https://sonicscan.org) |
| **HyperEVM** | 999 | 30275 | Configured | [Hyperliquid](https://hyperliquid.xyz) |

## Hub Chain

**Base is the hub chain** - all deployments start on Base, then OFT can be bridged to other chains.

### Why Base?

- Native support for Coinbase Smart Wallet
- Strong Creator Coin ecosystem (Zora)
- Low gas fees
- Growing DeFi infrastructure

## Cross-Chain Flow

```
Base (Hub)
   ├── Deploy vault, wrapper, OFT
   ├── Configure lottery and gauge controller
   └── Start CCA auction

User bridges ■TOKEN to Arbitrum
   ├── LayerZero V2 message sent
   ├── OFT minted on destination
   └── Same token, same features

Trading on any chain
   ├── 6.9% fee collected locally
   ├── Lottery entries created
   └── Cross-chain winner notification via LayerZero
```

## Adding New Chains

To add support for a new chain:

1. Deploy shared infrastructure (Registry, LotteryManager) on new chain
2. Configure LayerZero endpoint and peer connections
3. Set up DEX infrastructure (pools, aggregators)
4. Configure Chainlink VRF for lottery
5. Register chain in CreatorRegistry

Contact the team for deployment assistance on new chains.
