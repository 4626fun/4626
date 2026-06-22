# CCALaunchStrategyEncodingHelper
[Git Source](https://github.com/wenakita/4626/blob/main/contracts/vault/strategies/CCALaunchStrategyEncodingHelper.sol)


## Constants
### MPS

```solidity
uint24 public constant MPS = 1e7
```


### Q96

```solidity
uint256 public constant Q96 = 2 ** 96
```


### BPS_DENOMINATOR

```solidity
uint256 public constant BPS_DENOMINATOR = 10_000
```


### THURSDAY_EPOCH_SECONDS

```solidity
uint256 internal constant THURSDAY_EPOCH_SECONDS = 7 days
```


## Functions
### taxHookCalldata


```solidity
function taxHookCalldata(
    address taxHook,
    address auctionToken,
    address currency,
    address feeRecipient,
    uint256 taxRateBps
) external pure returns (address target, bytes memory data);
```

### completeAuctionCalldata


```solidity
function completeAuctionCalldata(
    address strategy,
    address taxHook,
    address auctionToken,
    address currency,
    address feeRecipient,
    uint256 taxRateBps
) external pure returns (address[] memory targets, bytes[] memory calldatas);
```

### encodeAuctionParams


```solidity
function encodeAuctionParams(
    address currency,
    address tokensRecipient,
    address fundsRecipient,
    uint256 floorPrice,
    uint256 tickSpacingQ96,
    uint128 requiredRaise,
    uint64 startBlock,
    uint64 endBlock,
    uint64 claimBlock,
    bytes calldata auctionSteps
) external pure returns (bytes memory);
```

### createLinearSteps


```solidity
function createLinearSteps(uint64 duration) external pure returns (bytes memory);
```

### createUniswapSafeDefaultSteps


```solidity
function createUniswapSafeDefaultSteps(uint64 duration) external pure returns (bytes memory);
```

### deriveScheduledStartBlock


```solidity
function deriveScheduledStartBlock(uint256 blockNumber, uint256 blockTimestamp, uint64 launchBlockTimeSeconds)
    external
    pure
    returns (uint64 startBlock);
```

### deriveLaunchPricing


```solidity
function deriveLaunchPricing(
    address oracle,
    address currency,
    uint64 launchOracleMaxAge,
    uint16 launchDiscountBps,
    uint16 launchTickSpacingBps,
    uint256 blockTimestamp
)
    external
    view
    returns (uint256 floorPriceQ96, uint256 tickSpacingQ96, uint256 creatorUsdPrice, uint256 ethUsdPrice);
```

### _createLinearSteps


```solidity
function _createLinearSteps(uint64 duration) internal pure returns (bytes memory);
```

### _nextThursdayStartTimestamp


```solidity
function _nextThursdayStartTimestamp(uint256 currentTimestamp) internal pure returns (uint256);
```

## Errors
### LaunchOracleNotConfigured

```solidity
error LaunchOracleNotConfigured();
```

### UnsupportedLaunchCurrency

```solidity
error UnsupportedLaunchCurrency(address currency);
```

### LaunchOracleInvalidPrice

```solidity
error LaunchOracleInvalidPrice(int256 creatorUsdPrice, int256 ethUsdPrice);
```

### LaunchOracleStale

```solidity
error LaunchOracleStale(uint256 creatorTimestamp, uint256 ethTimestamp, uint64 maxAge, uint256 currentTimestamp);
```

### LaunchFloorTooLow

```solidity
error LaunchFloorTooLow(uint256 rawFloorPriceQ96, uint256 tickSpacingQ96);
```

