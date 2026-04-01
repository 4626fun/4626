# ICCALaunchStrategy
[Git Source](https://github.com/wenakita/4626/blob/main/contracts/interfaces/ICCALaunchStrategy.sol)

**Title:**
ICCALaunchStrategy

**Author:**
0xakita.eth

Interface for configuring CCALaunchStrategy.

Used by deployment and admin tooling.


## Functions
### setApprovedLauncher


```solidity
function setApprovedLauncher(address launcher, bool approved) external;
```

### setRecipients


```solidity
function setRecipients(address _fundsRecipient, address _tokensRecipient) external;
```

### setBackingVault


```solidity
function setBackingVault(address _backingVault) external;
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

### previewLaunchPricing


```solidity
function previewLaunchPricing()
    external
    view
    returns (uint256 floorPriceQ96, uint256 tickSpacingQ96, uint256 creatorUsdPrice, uint256 ethUsdPrice);
```

### migrate


```solidity
function migrate() external;
```

### finalizeFailedAuction


```solidity
function finalizeFailedAuction() external;
```

