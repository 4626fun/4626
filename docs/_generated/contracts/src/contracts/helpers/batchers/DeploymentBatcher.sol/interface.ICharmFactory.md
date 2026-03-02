# ICharmFactory
[Git Source](https://github.com/wenakita/4626/blob/e241310837fd2472040c12df9be8240c28719e34/contracts/helpers/batchers/DeploymentBatcher.sol)

Charm Finance Alpha Vault Factory

Base: 0x5B7B8b487D05F77977b7ABEec5F922925B9b2aFa
Vaults created via this factory appear on alpha.charm.fi UI


## Functions
### createVault


```solidity
function createVault(
    address pool,
    address manager,
    uint256 maxTotalSupply,
    int24 baseThreshold,
    int24 limitThreshold,
    uint24 fullRangeWeight,
    uint32 period,
    string memory name,
    string memory symbol
) external returns (address vault);
```

