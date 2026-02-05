# CharmAlphaVault
[Git Source](https://github.com/creatorvault/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/contracts/vault/strategies/univ3/CharmAlphaVault.sol)

**Inherits:**
[IUniswapV3MintCallback](/contracts/interfaces/uniswap/IUniswapV3MintCallback.sol/interface.IUniswapV3MintCallback.md), [IUniswapV3SwapCallback](/contracts/interfaces/uniswap/IUniswapV3SwapCallback.sol/interface.IUniswapV3SwapCallback.md), ERC20, ReentrancyGuard

**Title:**
CharmAlphaVault

**Author:**
0xakita.eth

Uniswap v3 alpha vault for managed LP positions.

Used by Charm-based strategies for automated rebalancing.


## State Variables
### pool

```solidity
IUniswapV3Pool public immutable pool
```


### token0

```solidity
IERC20 public immutable token0
```


### token1

```solidity
IERC20 public immutable token1
```


### tickSpacing

```solidity
int24 public immutable tickSpacing
```


### protocolFee

```solidity
uint256 public protocolFee
```


### maxTotalSupply

```solidity
uint256 public maxTotalSupply
```


### strategy

```solidity
address public strategy
```


### governance

```solidity
address public governance
```


### pendingGovernance

```solidity
address public pendingGovernance
```


### baseLower

```solidity
int24 public baseLower
```


### baseUpper

```solidity
int24 public baseUpper
```


### limitLower

```solidity
int24 public limitLower
```


### limitUpper

```solidity
int24 public limitUpper
```


### accruedProtocolFees0

```solidity
uint256 public accruedProtocolFees0
```


### accruedProtocolFees1

```solidity
uint256 public accruedProtocolFees1
```


## Functions
### constructor

After deploying, strategy needs to be set via `setStrategy()`


```solidity
constructor(
    address _pool,
    uint256 _protocolFee,
    uint256 _maxTotalSupply,
    string memory _name,
    string memory _symbol
) ERC20(_name, _symbol);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_pool`|`address`|Underlying Uniswap V3 pool|
|`_protocolFee`|`uint256`|Protocol fee expressed as multiple of 1e-6|
|`_maxTotalSupply`|`uint256`|Cap on total supply|
|`_name`|`string`||
|`_symbol`|`string`||


### deposit

Deposits tokens in proportion to the vault's current holdings


```solidity
function deposit(uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address to)
    external
    nonReentrant
    returns (uint256 shares, uint256 amount0, uint256 amount1);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`amount0Desired`|`uint256`|Max amount of token0 to deposit|
|`amount1Desired`|`uint256`|Max amount of token1 to deposit|
|`amount0Min`|`uint256`|Revert if resulting `amount0` is less than this|
|`amount1Min`|`uint256`|Revert if resulting `amount1` is less than this|
|`to`|`address`|Recipient of shares|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`shares`|`uint256`|Number of shares minted|
|`amount0`|`uint256`|Amount of token0 deposited|
|`amount1`|`uint256`|Amount of token1 deposited|


### _poke

Do zero-burns to poke a position on Uniswap so earned fees are updated


```solidity
function _poke(int24 tickLower, int24 tickUpper) internal;
```

### _calcSharesAndAmounts

Calculates shares and amounts for deposit


```solidity
function _calcSharesAndAmounts(uint256 amount0Desired, uint256 amount1Desired)
    internal
    view
    returns (uint256 shares, uint256 amount0, uint256 amount1);
```

### withdraw

Withdraws tokens in proportion to the vault's holdings


```solidity
function withdraw(uint256 shares, uint256 amount0Min, uint256 amount1Min, address to)
    external
    nonReentrant
    returns (uint256 amount0, uint256 amount1);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`shares`|`uint256`|Shares burned by sender|
|`amount0Min`|`uint256`|Revert if resulting `amount0` is smaller than this|
|`amount1Min`|`uint256`|Revert if resulting `amount1` is smaller than this|
|`to`|`address`|Recipient of tokens|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`amount0`|`uint256`|Amount of token0 sent to recipient|
|`amount1`|`uint256`|Amount of token1 sent to recipient|


### _burnLiquidityShare

Withdraws share of liquidity in a range from Uniswap pool


```solidity
function _burnLiquidityShare(int24 tickLower, int24 tickUpper, uint256 shares, uint256 _totalSupply)
    internal
    returns (uint256 amount0, uint256 amount1);
```

### rebalance

Updates vault's positions. Can only be called by the strategy

Places base order and limit order


```solidity
function rebalance(
    int256 swapAmount,
    uint160 sqrtPriceLimitX96,
    int24 _baseLower,
    int24 _baseUpper,
    int24 _bidLower,
    int24 _bidUpper,
    int24 _askLower,
    int24 _askUpper
) external nonReentrant;
```

### _checkRange


```solidity
function _checkRange(int24 tickLower, int24 tickUpper) internal view;
```

### _burnAndCollect

Withdraws liquidity and collects fees


```solidity
function _burnAndCollect(int24 tickLower, int24 tickUpper, uint128 liquidity)
    internal
    returns (uint256 burned0, uint256 burned1, uint256 feesToVault0, uint256 feesToVault1);
```

### _mintLiquidity

Deposits liquidity in a range


```solidity
function _mintLiquidity(int24 tickLower, int24 tickUpper, uint128 liquidity) internal;
```

### getTotalAmounts

Calculates the vault's total holdings


```solidity
function getTotalAmounts() public view returns (uint256 total0, uint256 total1);
```

### getPositionAmounts

Amounts of tokens held in vault's position


```solidity
function getPositionAmounts(int24 tickLower, int24 tickUpper)
    public
    view
    returns (uint256 amount0, uint256 amount1);
```

### getBalance0

Balance of token0 in vault not used in any position


```solidity
function getBalance0() public view returns (uint256);
```

### getBalance1

Balance of token1 in vault not used in any position


```solidity
function getBalance1() public view returns (uint256);
```

### _position

Wrapper around `IUniswapV3Pool.positions()`


```solidity
function _position(int24 tickLower, int24 tickUpper)
    internal
    view
    returns (uint128, uint256, uint256, uint128, uint128);
```

### _amountsForLiquidity

Wrapper around `LiquidityAmounts.getAmountsForLiquidity()`


```solidity
function _amountsForLiquidity(int24 tickLower, int24 tickUpper, uint128 liquidity)
    internal
    view
    returns (uint256, uint256);
```

### _liquidityForAmounts

Wrapper around `LiquidityAmounts.getLiquidityForAmounts()`


```solidity
function _liquidityForAmounts(int24 tickLower, int24 tickUpper, uint256 amount0, uint256 amount1)
    internal
    view
    returns (uint128);
```

### uniswapV3MintCallback

Callback for Uniswap V3 pool


```solidity
function uniswapV3MintCallback(uint256 amount0, uint256 amount1, bytes calldata) external;
```

### uniswapV3SwapCallback

Callback for Uniswap V3 pool


```solidity
function uniswapV3SwapCallback(int256 amount0Delta, int256 amount1Delta, bytes calldata) external;
```

### collectProtocol

Used to collect accumulated protocol fees


```solidity
function collectProtocol(uint256 amount0, uint256 amount1, address to) external onlyGovernance;
```

### sweep

Removes tokens accidentally sent to this vault


```solidity
function sweep(IERC20 token, uint256 amount, address to) external onlyGovernance;
```

### setStrategy

Set the strategy contract


```solidity
function setStrategy(address _strategy) external onlyGovernance;
```

### setProtocolFee

Change protocol fee


```solidity
function setProtocolFee(uint256 _protocolFee) external onlyGovernance;
```

### setMaxTotalSupply

Change deposit cap


```solidity
function setMaxTotalSupply(uint256 _maxTotalSupply) external onlyGovernance;
```

### emergencyBurn

Emergency liquidity removal


```solidity
function emergencyBurn(int24 tickLower, int24 tickUpper, uint128 liquidity) external onlyGovernance;
```

### setGovernance

Transfer governance


```solidity
function setGovernance(address _governance) external onlyGovernance;
```

### acceptGovernance

Accept governance


```solidity
function acceptGovernance() external;
```

### _min


```solidity
function _min(uint256 a, uint256 b) internal pure returns (uint256);
```

### onlyGovernance


```solidity
modifier onlyGovernance() ;
```

## Events
### Deposit

```solidity
event Deposit(address indexed sender, address indexed to, uint256 shares, uint256 amount0, uint256 amount1);
```

### Withdraw

```solidity
event Withdraw(address indexed sender, address indexed to, uint256 shares, uint256 amount0, uint256 amount1);
```

### CollectFees

```solidity
event CollectFees(uint256 feesToVault0, uint256 feesToVault1, uint256 feesToProtocol0, uint256 feesToProtocol1);
```

### Snapshot

```solidity
event Snapshot(int24 tick, uint256 totalAmount0, uint256 totalAmount1, uint256 totalSupply);
```

