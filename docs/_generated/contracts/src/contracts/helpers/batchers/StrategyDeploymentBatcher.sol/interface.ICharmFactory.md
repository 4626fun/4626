# ICharmFactory
[Git Source](https://github.com/wenakita/4626/blob/2951e17122326ff4a23b28e80356c44121ebf59c/contracts/helpers/batchers/StrategyDeploymentBatcher.sol)

Charm Finance Alpha Vault Factory

Base: 0x5B7B8b487D05F77977b7ABEec5F922925B9b2aFa
Vaults created via this factory appear on alpha.charm.fi UI


## Functions
### createVault


```solidity
function createVault(VaultParams calldata params) external returns (address vault);
```

### governance


```solidity
function governance() external view returns (address);
```

### protocolFee


```solidity
function protocolFee() external view returns (uint24);
```

## Structs
### VaultParams

```solidity
struct VaultParams {
    address pool;
    address manager;
    uint24 managerFee;
    address rebalanceDelegate;
    uint256 maxTotalSupply;
    int24 baseThreshold;
    int24 limitThreshold;
    uint24 fullRangeWeight;
    uint32 period;
    int24 minTickMove;
    int24 maxTwapDeviation;
    uint32 twapDuration;
    string name;
    string symbol;
}
```

