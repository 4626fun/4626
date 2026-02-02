---
title: Strategies
sidebar_position: 2
---

# Strategy contracts

Strategies deploy vault capital to generate yield or facilitate token launches.

---

## Strategy types

### Launch strategies

Deploy ■TOKEN (wrapped shares) for price discovery:

| Strategy | Purpose |
|----------|---------|
| [CCA Launch](./cca-launch) | Continuous Clearing Auction |

### Yield strategies

Deploy TOKEN (creator coin) for returns:

| Strategy | Purpose |
|----------|---------|
| Charm | Uniswap V3 LP via Charm Alpha |
| Ajna | Lending to Ajna pools |
| V4 Full Range | Uniswap V4 full range LP |
| V4 Concentrated | Uniswap V4 targeted ranges |
| V4 Limit Order | Uniswap V4 limit orders |

---

## Strategy interface

All strategies implement `IStrategy`:

```solidity
interface IStrategy {
    // State
    function isActive() external view returns (bool);
    function asset() external view returns (address);
    function getTotalAssets() external view returns (uint256);
    
    // Operations
    function deposit(uint256 amount) external returns (uint256);
    function withdraw(uint256 amount) external returns (uint256);
    function emergencyWithdraw() external returns (uint256);
    function harvest() external returns (uint256);
    function rebalance() external;
}
```

---

## Allocation

Strategies receive capital based on weights:

```solidity
// Add strategies with weights (basis points)
vault.addStrategy(charmStrategy, 6900);   // 69%
vault.addStrategy(ajnaStrategy, 2139);    // 21.39%
// Remaining 9.61% stays idle
```

### Deployment flow

```
Keeper calls deployToStrategies()
        │
        ▼
Calculate deployable = coinBalance - minimumTotalIdle
        │
        ▼
For each active strategy:
├─► amount = deployable × weight / totalWeight
└─► strategy.deposit(amount)
```

---

## Key distinction

| Type | Asset | Purpose |
|------|-------|---------|
| CCA Launch | ■TOKEN | Price discovery, liquidity bootstrap |
| Yield | TOKEN | Generate returns on underlying |

The CCA strategy auctions wrapped shares to bootstrap liquidity. Yield strategies deploy the underlying creator coin to earn yield.

---

## Related

- [Architecture](/overview/architecture) - System design
- [Vault](/concepts/vault) - Strategy management
