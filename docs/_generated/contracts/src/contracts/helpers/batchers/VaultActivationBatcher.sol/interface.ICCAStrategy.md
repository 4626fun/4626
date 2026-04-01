# ICCAStrategy
[Git Source](https://github.com/wenakita/4626/blob/main/contracts/helpers/batchers/VaultActivationBatcher.sol)


## Functions
### launchAuctionSimple


```solidity
function launchAuctionSimple(uint256 amount, uint128 requiredRaise) external returns (address auction);
```

### launchAuction


```solidity
function launchAuction(uint256 amount, uint256 floorPrice, uint128 requiredRaise, bytes calldata auctionSteps)
    external
    returns (address auction);
```

### defaultFloorPrice


```solidity
function defaultFloorPrice() external view returns (uint256);
```

