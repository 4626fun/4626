---
title: Contracts
sidebar_position: 3
---

# Smart Contracts

Technical documentation for 4626 smart contracts.

## Contract Categories

| Category | Description |
|----------|-------------|
| **[Core](/contracts/core)** | Registry, Vault, Wrapper, ShareOFT |
| **[Governance](/contracts/governance)** | GaugeController, Voting, ve4626 |
| **[Strategies](/contracts/strategies)** | Yield strategies, CCA launch |
| **[Utilities](/contracts/utilities)** | Lottery, Oracle |

## Architecture

4626 consists of:
- **Shared infrastructure** - Deployed once per chain
- **Per-creator stack** - Deployed per creator coin
- **Optional incentives** - ve(3,3) layer

## Deployment Addresses

See [Reference > Addresses](/reference/addresses) for all deployed contract addresses.

## API Reference

Auto-generated contract API documentation is not yet published. For now, consult the Solidity NatSpec in `contracts/` directly, or browse the source on [GitHub](https://github.com/wenakita/4626/tree/main/contracts).
