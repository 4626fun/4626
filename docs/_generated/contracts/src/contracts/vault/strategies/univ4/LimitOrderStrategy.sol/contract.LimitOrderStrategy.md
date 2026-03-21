# LimitOrderStrategy
[Git Source](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/contracts/vault/strategies/univ4/LimitOrderStrategy.sol)

**Inherits:**
Ownable, ReentrancyGuard


## State Variables
### MAX_ORDERS
Maximum number of active limit orders


```solidity
uint256 public constant MAX_ORDERS = 10
```


### tickSpacing
Tick spacing (depends on pool fee tier)


```solidity
int24 public tickSpacing = 60
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


### orders
All limit orders


```solidity
LimitOrder[] public orders
```


### totalLiquidity
Total liquidity across all orders


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


### defaultTickOffset
Default tick offset from current price for new orders


```solidity
int24 public defaultTickOffset = 100
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


```solidity
constructor(address _creatorCoin, address _pairedToken, address _lpManager, address _owner) Ownable(_owner);
```

### configurePool


```solidity
function configurePool(address _poolManager, address _positionManager, address _permit2, PoolKey calldata _poolKey)
    external
    onlyOwner;
```

### createOrder

Create a new limit order


```solidity
function createOrder(int24 tickLower, int24 tickUpper, uint256 amount, bool isBuyOrder)
    external
    onlyLPManager
    whenActive
    returns (uint256 orderId, uint256 liquidity);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`tickLower`|`int24`|Lower tick bound|
|`tickUpper`|`int24`|Upper tick bound (tickLower + tickSpacing for single-tick)|
|`amount`|`uint256`|Amount of token to provide|
|`isBuyOrder`|`bool`|True for buy support, false for sell resistance|


### cancelOrder

Cancel an existing order


```solidity
function cancelOrder(uint256 orderId)
    external
    onlyLPManager
    returns (uint256 creatorCoinAmount, uint256 pairedAmount);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`orderId`|`uint256`|Order ID to cancel|


### deposit

Deposit creates a new limit order at default offset


```solidity
function deposit(uint256 creatorCoinAmount, uint256 pairedAmount)
    external
    nonReentrant
    onlyLPManager
    whenActive
    returns (uint256 liquidity);
```

### withdraw

Withdraw proportionally from all active orders


```solidity
function withdraw(uint256 liquidity)
    external
    nonReentrant
    onlyLPManager
    returns (uint256 creatorCoinAmount, uint256 pairedAmount);
```

### withdrawAll

Withdraw all liquidity


```solidity
function withdrawAll()
    external
    nonReentrant
    onlyLPManager
    returns (uint256 creatorCoinAmount, uint256 pairedAmount);
```

### rebalance

Rebalance: move filled/stale orders to optimal ticks


```solidity
function rebalance() external onlyLPManager whenActive;
```

### getTotalValue

Get total value


```solidity
function getTotalValue() external view returns (uint256 creatorCoinValue, uint256 pairedValue);
```

### getLiquidity


```solidity
function getLiquidity() external view returns (uint256);
```

### isActive


```solidity
function isActive() external view returns (bool);
```

### strategyType


```solidity
function strategyType() external pure returns (StrategyType);
```

### getOrder


```solidity
function getOrder(uint256 orderId) external view returns (LimitOrder memory);
```

### getActiveOrders


```solidity
function getActiveOrders() external view returns (LimitOrder[] memory activeOrders);
```

### getOrderCount


```solidity
function getOrderCount() external view returns (uint256 total, uint256 active);
```

### _getActiveOrderCount


```solidity
function _getActiveOrderCount() internal view returns (uint256 count);
```

### _getCurrentTick


```solidity
function _getCurrentTick() internal view returns (int24);
```

### _requireConfigured


```solidity
function _requireConfigured() internal view;
```

### _liquidityForSingleSidedAmount


```solidity
function _liquidityForSingleSidedAmount(uint256 amount, int24 tickLower, int24 tickUpper, bool isBuyOrder)
    internal
    view
    returns (uint128 liquidity);
```

### _posmMint


```solidity
function _posmMint(int24 tickLower, int24 tickUpper, uint128 liquidityToAdd) internal;
```

### _posmDecrease


```solidity
function _posmDecrease(uint256 tokenId, uint128 liquidityToRemove) internal;
```

### _posmBurn


```solidity
function _posmBurn(uint256 tokenId) internal;
```

### _roundDownToSpacing


```solidity
function _roundDownToSpacing(int24 tick) internal view returns (int24);
```

### _estimateOrderValue


```solidity
function _estimateOrderValue(LimitOrder storage order)
    internal
    view
    returns (uint256 creatorCoinAmount, uint256 pairedAmount);
```

### _isOrderFilled


```solidity
function _isOrderFilled(LimitOrder storage order, int24 currentTick) internal view returns (bool);
```

### setLPManager


```solidity
function setLPManager(address _lpManager) external onlyOwner;
```

### setDefaultTickOffset


```solidity
function setDefaultTickOffset(int24 _offset) external onlyOwner;
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


```solidity
function emergencyWithdraw() external onlyOwner;
```

## Events
### OrderCreated

```solidity
event OrderCreated(uint256 indexed orderId, int24 tickLower, int24 tickUpper, uint256 liquidity, bool isBuyOrder);
```

### OrderFilled

```solidity
event OrderFilled(uint256 indexed orderId, uint256 amountIn, uint256 amountOut);
```

### OrderCancelled

```solidity
event OrderCancelled(uint256 indexed orderId, uint256 creatorCoinReturned, uint256 pairedReturned);
```

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
event Rebalanced(uint256 timestamp, uint256 ordersMoved);
```

### PoolConfigured

```solidity
event PoolConfigured(
    bytes32 poolId, address poolManager, address positionManager, address permit2, bool creatorIsCurrency0
);
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

### TooManyOrders

```solidity
error TooManyOrders();
```

### OrderNotFound

```solidity
error OrderNotFound();
```

### InvalidTick

```solidity
error InvalidTick();
```

### InsufficientLiquidity

```solidity
error InsufficientLiquidity();
```

### PoolNotFullyConfigured

```solidity
error PoolNotFullyConfigured();
```

