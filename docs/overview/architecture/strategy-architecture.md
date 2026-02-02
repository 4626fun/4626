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
Creator Token deposits
        |
        v
+------------------+
|  CreatorOVault   |  <-- ERC-4626 vault
+------------------+
        |
        +---> Idle buffer (9.61% default)
        |
        +---> Strategy allocation (weighted)
              |
              +---> CCALaunchStrategy (launch phase)
              +---> CreatorCharmStrategy (V3 LP)
              +---> AjnaStrategy (lending)
              +---> V4 Strategies (coming)
```

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

Used during token launch phase:

1. Accepts creator token deposits
2. Runs continuous clearing auction for 7 days
3. Graduates to LP position after auction
4. Configures tax hook on V4 pool

### LBP Strategy (alternative)

Liquidity Bootstrapping Pool approach:

1. Initial weighted pool (80/20)
2. Weight shifts over time
3. Migrates to V4 after launch

---

## Yield strategies

### Charm Strategy (Uniswap V3)

Automated LP management via Charm Alpha Vaults:

| Parameter | Typical value |
|-----------|---------------|
| Fee tier | 0.3% or 1% |
| Rebalance threshold | 3000 ticks |
| TWAP duration | 1800 seconds |

### Ajna Strategy

Permissionless lending:

| Parameter | Typical value |
|-----------|---------------|
| Quote token | WETH or USDC |
| Bucket placement | Derived from oracle price |
| Expected APY | 5-15% |

### V4 Strategies (planned)

| Strategy | Description |
|----------|-------------|
| Full Range | Classic LP across all prices |
| Concentrated | Targeted price ranges |
| Limit Order | Single-sided limit positions |

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
