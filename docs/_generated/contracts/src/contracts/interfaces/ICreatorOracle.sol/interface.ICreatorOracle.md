# ICreatorOracle
[Git Source](https://github.com/creatorvault/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/contracts/interfaces/ICreatorOracle.sol)

**Title:**
ICreatorOracle

**Author:**
0xakita.eth

Interface for CreatorOracle price feeds and helpers.

Used by vaults, gauges, and deployment tooling.


## Functions
### setV4Pool


```solidity
function setV4Pool(address _poolManager, PoolKey calldata _poolKey, bool _creatorIsToken0) external;
```

### setV3Pool


```solidity
function setV3Pool(address _pool, address _creatorToken, address _usdToken, uint32 _twapDuration) external;
```

### getEthPrice


```solidity
function getEthPrice() external view returns (int256 price, uint256 timestamp);
```

### getCreatorPrice


```solidity
function getCreatorPrice() external view returns (int256 price, uint256 timestamp);
```

### getCreatorEthTWAP


```solidity
function getCreatorEthTWAP(uint32 duration) external view returns (uint256 price);
```

### getTWAPTick


```solidity
function getTWAPTick(uint32 duration) external view returns (int24 twapTick);
```

### tickToPrice


```solidity
function tickToPrice(int24 tick) external view returns (uint256 price);
```

### getCurrentTick


```solidity
function getCurrentTick() external view returns (int24 tick);
```

### isPriceFresh


```solidity
function isPriceFresh() external view returns (bool);
```

### tickToAjnaBucket

Convert a Uniswap tick to an Ajna bucket index (approx)


```solidity
function tickToAjnaBucket(int24 tick) external pure returns (uint256 bucketIndex);
```

### getAjnaBucketFromV3TWAP

Suggested Ajna bucket from the configured CREATOR/USDC V3 TWAP tick


```solidity
function getAjnaBucketFromV3TWAP(uint32 duration) external view returns (uint256 bucketIndex);
```

### updateCreatorPrice


```solidity
function updateCreatorPrice(int256 _price) external;
```

### updateCreatorPriceFromTWAP

Chainlink-style update: V4 TWAP (Creator/ETH) × Chainlink (ETH/USD)


```solidity
function updateCreatorPriceFromTWAP(uint32 twapDuration) external;
```

### updateCreatorPriceFromV3TWAP

Optional: direct stablecoin update (CREATOR/USDC V3 TWAP)


```solidity
function updateCreatorPriceFromV3TWAP(uint32 twapDuration) external;
```

### recordSwapObservation


```solidity
function recordSwapObservation() external;
```

### getObservationState


```solidity
function getObservationState()
    external
    view
    returns (uint16 index, uint16 cardinality, uint16 cardinalityNext, uint32 lastTimestamp);
```

### getTickCapState


```solidity
function getTickCapState() external view returns (int24 currentCap, uint64 capFrequency, bool autoTunePaused);
```

### creatorSymbol


```solidity
function creatorSymbol() external view returns (string memory);
```

### creatorPriceUSD


```solidity
function creatorPriceUSD() external view returns (int256);
```

### creatorPriceTimestamp


```solidity
function creatorPriceTimestamp() external view returns (uint256);
```

### v4PoolConfigured


```solidity
function v4PoolConfigured() external view returns (bool);
```

### maxTicksPerObservation


```solidity
function maxTicksPerObservation() external view returns (int24);
```

