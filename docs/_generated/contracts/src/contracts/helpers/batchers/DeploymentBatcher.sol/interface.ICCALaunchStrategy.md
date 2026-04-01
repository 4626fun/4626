# ICCALaunchStrategy
[Git Source](https://github.com/wenakita/4626/blob/main/contracts/helpers/batchers/DeploymentBatcher.sol)


## Functions
### setApprovedLauncher


```solidity
function setApprovedLauncher(address launcher, bool approved) external;
```

### setOracleConfig


```solidity
function setOracleConfig(address _oracle, address _poolManager, address _taxHook, address _feeRecipient) external;
```

### setLaunchDiscountBps


```solidity
function setLaunchDiscountBps(uint16 _discountBps) external;
```

### setLaunchTickSpacingBps


```solidity
function setLaunchTickSpacingBps(uint16 _tickSpacingBps) external;
```

### setLaunchBlockTimeSeconds


```solidity
function setLaunchBlockTimeSeconds(uint64 _secondsPerBlock) external;
```

### setRecipients


```solidity
function setRecipients(address _fundsRecipient, address _tokensRecipient) external;
```

### setBackingVault


```solidity
function setBackingVault(address _backingVault) external;
```

### setMigrationConfig


```solidity
function setMigrationConfig(
    address _positionManager,
    address _positionRecipient,
    address _operator,
    uint64 _migrationDelayBlocks,
    uint64 _sweepDelayBlocks
) external;
```

### launchAuction


```solidity
function launchAuction(uint256 amount, uint256 floorPrice, uint128 requiredRaise, bytes calldata auctionSteps)
    external
    returns (address auction);
```

### launchAuctionWithReserve


```solidity
function launchAuctionWithReserve(
    uint256 amount,
    uint256 lpReserveAmount,
    uint256 floorPrice,
    uint128 requiredRaise,
    bytes calldata auctionSteps
) external returns (address auction);
```

### transferOwnership


```solidity
function transferOwnership(address newOwner) external;
```

