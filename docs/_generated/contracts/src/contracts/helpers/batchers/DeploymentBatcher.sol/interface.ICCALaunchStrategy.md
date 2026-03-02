# ICCALaunchStrategy
[Git Source](https://github.com/wenakita/4626/blob/e241310837fd2472040c12df9be8240c28719e34/contracts/helpers/batchers/DeploymentBatcher.sol)


## Functions
### setApprovedLauncher


```solidity
function setApprovedLauncher(address launcher, bool approved) external;
```

### setOracleConfig


```solidity
function setOracleConfig(address _oracle, address _poolManager, address _taxHook, address _feeRecipient) external;
```

### setDefaultTickSpacing


```solidity
function setDefaultTickSpacing(uint256 _spacing) external;
```

### launchAuction


```solidity
function launchAuction(uint256 amount, uint256 floorPrice, uint128 requiredRaise, bytes calldata auctionSteps)
    external
    returns (address auction);
```

### transferOwnership


```solidity
function transferOwnership(address newOwner) external;
```

