# CreatorOVaultLiquidityLib
[Git Source](https://github.com/wenakita/4626/blob/2951e17122326ff4a23b28e80356c44121ebf59c/contracts/vault/libraries/CreatorOVaultLiquidityLib.sol)

Read-only liquidity transparency for CreatorOVault (P0 / P2 integrator surface).


## Constants
### MAX_BPS

```solidity
uint256 internal constant MAX_BPS = 10_000
```


## Functions
### snapshot


```solidity
function snapshot(address vault) internal view returns (LiquiditySnapshot memory snap);
```

### _valuationReady


```solidity
function _valuationReady(address strategy) private view returns (bool);
```

### _reportedAssets


```solidity
function _reportedAssets(address vault, address strategy, IVaultLiquidityReader reader)
    private
    view
    returns (uint256 assets);
```

## Structs
### StrategyLiquidity

```solidity
struct StrategyLiquidity {
    address strategy;
    bool active;
    bool valuationReady;
    uint256 reportedAssets;
    uint256 strategyDebt;
}
```

### LiquiditySnapshot

```solidity
struct LiquiditySnapshot {
    uint256 totalAssets;
    uint256 idleAssets;
    uint256 minIdleReserve;
    /// @notice Creator Coin redeemable from vault idle without pulling strategies.
    uint256 instantIdleAssets;
    /// @notice `instantIdleAssets * MAX_BPS / totalAssets` (0 when totalAssets == 0).
    uint256 instantIdleBps;
    /// @notice Vault shares reserved for queued large withdrawals.
    uint256 queuedWithdrawalShares;
    /// @notice Profit-unlock shares not yet matured on the vault balance.
    uint256 lockedProfitShares;
    /// @notice Largest synchronous redeem per ERC-4626 `maxWithdraw` policy (0 = unlimited).
    uint256 maxSyncWithdrawAssets;
    StrategyLiquidity[] strategies;
}
```

