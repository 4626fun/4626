---
title: Smart Contracts
sidebar_position: 2
---

# Smart Contracts

This section documents the public-facing smart contracts in the 4626 protocol.

**Who this is for:** Protocol engineers, auditors, and integrators.

---

## Contract overview

### Core

| Contract | Description |
|----------|-------------|
| `CreatorOVault` | ERC-4626 compliant vault for creator coins |
| `CreatorOVaultWrapper` | Wraps vault shares for OFT functionality |
| `CreatorRegistry` | Global registry mapping tokens, vaults, and OFTs |

### Strategies

| Contract | Description |
|----------|-------------|
| `CCALaunchStrategy` | Continuous Clearing Auction for token launches |
| `CreatorCharmStrategy` | Uniswap V3 via Charm Alpha Vaults |
| `AjnaStrategy` | Lending via Ajna Protocol |
| `FullRangeStrategy` | Uniswap V4 full range liquidity |
| `ConcentratedStrategy` | Uniswap V4 concentrated positions |
| `LimitOrderStrategy` | Uniswap V4 limit orders |

### Governance

| Contract | Description |
|----------|-------------|
| `ve4626` | Vote-escrowed 4626 token |
| `VaultGaugeVoting` | Weekly epoch voting for vault gauges |
| `VoterRewardsDistributor` | Distributes fees to voters |
| `CreatorGaugeController` | Fee routing and gauge management |
| `BribeDepot` | External bribes for votes |

### Services

| Contract | Description |
|----------|-------------|
| `CreatorShareOFT` | LayerZero OFT for cross-chain transfers |
| `CreatorLotteryManager` | Jackpot lottery mechanics |
| `CreatorOracle` | Price oracle for creator coins |
| `SolanaBridgeAdapter` | Solana cross-chain bridge |

### Helpers

| Contract | Description |
|----------|-------------|
| `VaultActivationBatcher` | 1-click vault activation |
| `StrategyDeploymentBatcher` | Batch strategy deployment |
| `CreatorVaultDeployer` | Full vault deployment helper |
| `Create2Deployer` | Deterministic deployment |

---

## Deployment addresses

See the frontend config at `frontend/src/config/contracts.ts` for current mainnet addresses.

---

## Subsections

- [Keepers](/contracts/keepers) - Automated keeper agents
- [Lottery](/contracts/lottery) - Jackpot lottery mechanics

---

## Auto-generated API

For complete function signatures and NatSpec documentation, see the [Contract API Reference](/api/contracts).
