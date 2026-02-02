# ICCALaunchStrategy
[Git Source](https://github.com/creatorvault/4626/blob/d2887a577bbbcd8195e2d76fc50368643edd1f1a/contracts/helpers/batchers/CreatorVaultDeployer.sol)


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

