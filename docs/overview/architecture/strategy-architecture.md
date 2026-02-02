---
title: Strategy architecture
sidebar_position: 2
---

# Strategy architecture

This document describes how CreatorVault allocates deposited tokens across multiple yield strategies.

**Who this is for:** Protocol engineers, vault operators, and anyone evaluating CreatorVault yield strategies.

---

## Overview

CreatorVault uses a multi-strategy approach to maximize yield while maintaining liquidity:

| Strategy type | Contract | Purpose |
|--------------|----------|---------|
| CCA Launch | `CCALaunchStrategy` | Token launch via continuous clearing auction |
| Charm V3 | `CreatorCharmStrategy` | Automated Uniswap V3 LP via Charm |
| Ajna Lending | `AjnaStrategy` | Permissionless lending pools |
| V4 Full Range | `FullRangeStrategy` | Uniswap V4 full range liquidity |
| V4 Concentrated | `ConcentratedStrategy` | Uniswap V4 concentrated positions |
| V4 Limit Order | `LimitOrderStrategy` | Uniswap V4 limit orders |

---

## Architecture

```
Creator Coin (TOKEN) deposits
        |
        v
+--------------------+
|   CreatorOVault    |  <-- ERC-4626 vault
| Issues ▢TOKEN shares|
+--------------------+
        |
        +---> Idle buffer (9.61% TOKEN)
        |
        +---> Strategy allocation
              |
              +---> CCALaunchStrategy -----> Auctions ■TOKEN (wrapped shares)
              |                              for price discovery
              |
              +---> CreatorCharmStrategy --> Deploys TOKEN to V3 LP
              +---> AjnaStrategy ----------> Lends TOKEN to Ajna pools
              +---> V4 Strategies ---------> Deploys TOKEN to V4 pools
```

**Important:** The CCA strategy is unique - it auctions wrapped share tokens (■TOKEN) to bootstrap liquidity and establish price. Other strategies deploy the underlying creator coin (TOKEN) directly for yield generation.

---

## Strategy allocation

### Weight-based distribution

Each strategy has a weight determining its share of deployed capital:

```solidity
vault.addStrategy(charmStrategy, 6900);  // 69%
vault.addStrategy(ajnaStrategy, 2139);   // 21.39%
// Remaining 9.61% stays idle
```

### Idle buffer

`minimumTotalIdle` keeps assets liquid for withdrawals:

```solidity
vault.setMinimumTotalIdle(4_805_000e18);  // 9.61% of 50M
```

---

## Launch strategies

### CCA Launch Strategy

The CCA strategy operates differently from yield strategies - it auctions **wrapped share tokens (■TOKEN)**, not the underlying creator coin.

**How it works:**

1. Creator deposits TOKEN into vault, receives ▢TOKEN shares
2. ▢TOKEN shares are wrapped into ■TOKEN (OFT)
3. CCA strategy auctions ■TOKEN via continuous clearing auction
4. Buyers pay ETH for ■TOKEN
5. After 7 days, auction graduates to V4 LP position
6. Tax hook is configured on the resulting pool

**Why auction wrapped shares:**
- ■TOKEN is cross-chain compatible (LayerZero OFT)
- Represents a claim on diversified vault yield
- Price discovery for the vault itself, not just the coin
- Raised ETH bootstraps LP liquidity

### LBP Strategy (alternative)

Liquidity Bootstrapping Pool approach:

1. Initial weighted pool (80/20) with ■TOKEN
2. Weight shifts over time
3. Migrates to V4 after launch

---

## Yield strategies

Unlike the CCA launch strategy, yield strategies deploy the **underlying creator coin (TOKEN)** to generate returns.

### Charm Strategy (Uniswap V3)

Deploys TOKEN to automated LP positions via Charm Alpha Vaults:

| Parameter | Typical value |
|-----------|---------------|
| Asset deployed | TOKEN (creator coin) |
| Pair | TOKEN/USDC or TOKEN/WETH |
| Fee tier | 0.3% or 1% |
| Rebalance threshold | 3000 ticks |

### Ajna Strategy

Lends TOKEN to permissionless lending pools:

| Parameter | Typical value |
|-----------|---------------|
| Asset deployed | TOKEN (creator coin) |
| Quote token | WETH or USDC |
| Bucket placement | Derived from oracle price |
| Expected APY | 5-15% |

### V4 Strategies (planned)

Deploys TOKEN to Uniswap V4 pools:

| Strategy | Description |
|----------|-------------|
| Full Range | TOKEN LP across all prices |
| Concentrated | TOKEN in targeted price ranges |
| Limit Order | Single-sided TOKEN positions |

---

## Fee flow

Strategies interact with the fee system:

```
Swap fees from V3/V4 pools
        |
        v
CreatorGaugeController
        |
        +---> 9.61% voter rewards
        +---> Protocol treasury
        +---> Jackpot reserve
```

---

## Configuration

### Adding a strategy

```solidity
// 1. Deploy strategy
CreatorCharmStrategy strategy = new CreatorCharmStrategy(vault, pool);

// 2. Add to vault with weight
vault.addStrategy(address(strategy), 6900);

// 3. Set idle buffer
vault.setMinimumTotalIdle(4_805_000e18);

// 4. Deploy capital
vault.deployToStrategies();
```

### Rebalancing

```solidity
// Manual rebalance
vault.tend();

// Or via keeper
vault.deployToStrategies();
```

---

## Implementation status

| Strategy | Status | Contract |
|----------|--------|----------|
| CCA Launch | Production | `CCALaunchStrategy.sol` |
| Charm V3 | Production | `CreatorCharmStrategy.sol` |
| Ajna | Production | `AjnaStrategy.sol` |
| V4 Full Range | Development | `FullRangeStrategy.sol` |
| V4 Concentrated | Development | `ConcentratedStrategy.sol` |
| V4 Limit Order | Development | `LimitOrderStrategy.sol` |

---

## References

- [Fee architecture](./fee-architecture.md)
- [Pre-launch checklist](/operations/deployment/pre-launch)
- [Strategy deployment](/operations/automation/full-automation)
