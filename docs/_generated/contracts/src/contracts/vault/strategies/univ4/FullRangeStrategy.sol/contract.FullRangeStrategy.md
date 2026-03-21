# FullRangeStrategy
[Git Source](https://github.com/wenakita/4626/blob/main/contracts/vault/strategies/univ4/FullRangeStrategy.sol)

**Inherits:**
Ownable, ReentrancyGuard


## State Variables
### MIN_TICK
Full range tick bounds (Uniswap V4 max)


```solidity
int24 public constant MIN_TICK = -887272
```


### MAX_TICK

```solidity
int24 public constant MAX_TICK = 887272
```


### CREATOR_COIN
Creator Coin token


```solidity
IERC20 public immutable CREATOR_COIN
```


### PAIRED_TOKEN
Paired token (WETH)


```solidity
IERC20 public immutable PAIRED_TOKEN
```


### lpManager
LP Manager that controls this strategy


```solidity
address public lpManager
```


### poolManager
Uniswap V4 PoolManager (holds all pools)


```solidity
IPoolManager public poolManager
```


### poolKey
Uniswap V4 pool key (defines currencies/fee/tickSpacing/hooks)


```solidity
PoolKey public poolKey
```


### poolId
Uniswap V4 pool id (derived from poolKey)


```solidity
PoolId public poolId
```


### creatorIsCurrency0
True if CREATOR_COIN is currency0 for poolKey


```solidity
bool public creatorIsCurrency0
```


### positionManager
Uniswap V4 PositionManager (PosM)


```solidity
address public positionManager
```


### permit2
Permit2 contract used by PosM for token pulls into PoolManager


```solidity
address public permit2
```


### positionTokenId
Current position token ID (NFT)


```solidity
uint256 public positionTokenId
```


### totalLiquidity
Total liquidity in this strategy


```solidity
uint256 public totalLiquidity
```


### isActive_
Whether strategy is active


```solidity
bool public isActive_ = true
```


### isEmergencyMode
Emergency mode flag


```solidity
bool public isEmergencyMode
```


## Functions
### onlyLPManager


```solidity
modifier onlyLPManager() ;
```

### whenActive


```solidity
modifier whenActive() ;
```

### constructor

Initialize full range strategy


```solidity
constructor(address _creatorCoin, address _pairedToken, address _lpManager, address _owner) Ownable(_owner);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_creatorCoin`|`address`|Creator Coin token|
|`_pairedToken`|`address`|Paired token (WETH)|
|`_lpManager`|`address`|LP Manager address|
|`_owner`|`address`|Owner address|


### configurePool

Configure Uniswap V4 pool


```solidity
function configurePool(address _poolManager, address _positionManager, address _permit2, PoolKey calldata _poolKey)
    external
    onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_poolManager`|`address`|V4 Pool Manager|
|`_positionManager`|`address`|V4 Position Manager (PosM)|
|`_permit2`|`address`|Permit2 contract used by PosM|
|`_poolKey`|`PoolKey`|The pool key (pool id is derived from this)|


### deposit

Deposit liquidity


```solidity
function deposit(uint256 creatorCoinAmount, uint256 pairedAmount)
    external
    nonReentrant
    onlyLPManager
    whenActive
    returns (uint256 liquidity);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`creatorCoinAmount`|`uint256`|Amount of creator coin|
|`pairedAmount`|`uint256`|Amount of paired token|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`liquidity`|`uint256`|Amount of liquidity minted|


### withdraw

Withdraw liquidity


```solidity
function withdraw(uint256 liquidity)
    external
    nonReentrant
    onlyLPManager
    returns (uint256 creatorCoinAmount, uint256 pairedAmount);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`liquidity`|`uint256`|Amount of liquidity to withdraw|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`creatorCoinAmount`|`uint256`|Amount of creator coin returned|
|`pairedAmount`|`uint256`|Amount of paired token returned|


### withdrawAll

Withdraw all liquidity


```solidity
function withdrawAll()
    external
    nonReentrant
    onlyLPManager
    returns (uint256 creatorCoinAmount, uint256 pairedAmount);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`creatorCoinAmount`|`uint256`|Amount of creator coin returned|
|`pairedAmount`|`uint256`|Amount of paired token returned|


### rebalance

Rebalance position (collect fees, re-add if needed)

Full range doesn't need tick rebalancing, just fee collection


```solidity
function rebalance() external onlyLPManager whenActive;
```

### getTotalValue

Get total value in this strategy


```solidity
function getTotalValue() external view returns (uint256 creatorCoinValue, uint256 pairedValue);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`creatorCoinValue`|`uint256`|Value in creator coin terms|
|`pairedValue`|`uint256`|Value in paired token terms|


### getLiquidity

Get total liquidity


```solidity
function getLiquidity() external view returns (uint256);
```

### isActive

Check if strategy is active


```solidity
function isActive() external view returns (bool);
```

### strategyType

Get strategy type


```solidity
function strategyType() external pure returns (StrategyType);
```

### _requireConfigured


```solidity
function _requireConfigured() internal view;
```

### _posmMint


```solidity
function _posmMint(int24 tickLower, int24 tickUpper, uint128 liquidityToAdd) internal;
```

### _posmIncrease


```solidity
function _posmIncrease(uint256 tokenId, uint128 liquidityToAdd) internal;
```

### _posmDecrease


```solidity
function _posmDecrease(uint256 tokenId, uint128 liquidityToRemove) internal;
```

### _calculateLiquidity

Calculate liquidity from token amounts

This is a simplified calculation - production would use V4's math


```solidity
function _calculateLiquidity(uint256 creatorCoinAmount, uint256 pairedAmount) internal pure returns (uint256);
```

### _calculateAmountsForLiquidity

Calculate token amounts for liquidity


```solidity
function _calculateAmountsForLiquidity(uint256 liquidity)
    internal
    view
    returns (uint256 creatorCoinAmount, uint256 pairedAmount);
```

### _sqrt

Square root using Babylonian method


```solidity
function _sqrt(uint256 x) internal pure returns (uint256);
```

### setLPManager


```solidity
function setLPManager(address _lpManager) external onlyOwner;
```

### setActive


```solidity
function setActive(bool _active) external onlyOwner;
```

### enableEmergencyMode


```solidity
function enableEmergencyMode() external onlyOwner;
```

### emergencyWithdraw

Emergency withdraw all tokens to owner


```solidity
function emergencyWithdraw() external onlyOwner;
```

## Events
### Deposited

```solidity
event Deposited(uint256 creatorCoinAmount, uint256 pairedAmount, uint256 liquidity);
```

### Withdrawn

```solidity
event Withdrawn(uint256 liquidity, uint256 creatorCoinAmount, uint256 pairedAmount);
```

### Rebalanced

```solidity
event Rebalanced(uint256 timestamp);
```

### PoolConfigured

```solidity
event PoolConfigured(
    bytes32 poolId, address poolManager, address positionManager, address permit2, bool creatorIsCurrency0
);
```

### EmergencyModeEnabled

```solidity
event EmergencyModeEnabled();
```

## Errors
### NotLPManager

```solidity
error NotLPManager();
```

### NotActive

```solidity
error NotActive();
```

### ZeroAddress

```solidity
error ZeroAddress();
```

### ZeroAmount

```solidity
error ZeroAmount();
```

### PoolNotConfigured

```solidity
error PoolNotConfigured();
```

### InsufficientLiquidity

```solidity
error InsufficientLiquidity();
```

### PoolNotFullyConfigured

```solidity
error PoolNotFullyConfigured();
```

