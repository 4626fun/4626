# CreatorCharmStrategy
[Git Source](https://github.com/creatorvault/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/contracts/vault/strategies/univ3/CreatorCharmStrategy.sol)

**Inherits:**
[IStrategy](/contracts/interfaces/IStrategy.sol/interface.IStrategy.md), ReentrancyGuard, Ownable


## State Variables
### vault

```solidity
address public immutable vault
```


### CREATOR

```solidity
IERC20 public immutable CREATOR
```


### USDC

```solidity
IERC20 public immutable USDC
```


### UNISWAP_ROUTER

```solidity
ISwapRouter public immutable UNISWAP_ROUTER
```


### charmVault

```solidity
ICharmVault public charmVault
```


### swapPool

```solidity
IUniswapV3Pool public swapPool
```


### zRouter
zRouter for gas-efficient swaps (optional)

Base: TBD


```solidity
IzRouter public zRouter
```


### useZRouter

```solidity
bool public useZRouter = false
```


### uniFactory
Uniswap V3 Factory for auto fee tier discovery

Base: 0x33128a8fC17869897dcE68Ed026d694621f6FDfD


```solidity
IUniswapV3Factory public uniFactory
```


### autoFeeTier

```solidity
bool public autoFeeTier = false
```


### maxSwapPercent
Configurable parameters


```solidity
uint256 public maxSwapPercent = 5
```


### swapSlippageBps

```solidity
uint256 public swapSlippageBps = 300
```


### depositSlippageBps

```solidity
uint256 public depositSlippageBps = 500
```


### swapPoolFee

```solidity
uint24 public swapPoolFee = 3000
```


### active

```solidity
bool public active = true
```


### lastTotalAssets

```solidity
uint256 private lastTotalAssets
```


## Functions
### onlyVault


```solidity
modifier onlyVault() ;
```

### whenActive


```solidity
modifier whenActive() ;
```

### constructor


```solidity
constructor(
    address _vault,
    address _creator,
    address _usdc,
    address _uniswapRouter,
    address _charmVault,
    address _swapPool,
    address _owner
) Ownable(_owner);
```

### setCharmVault


```solidity
function setCharmVault(address _charmVault) external onlyOwner;
```

### setSwapPool


```solidity
function setSwapPool(address _swapPool) external onlyOwner;
```

### setZRouter

Set zRouter address for gas-efficient swaps


```solidity
function setZRouter(address _zRouter) external onlyOwner;
```

### setUseZRouter

Toggle between zRouter (gas-efficient) and Uniswap Router


```solidity
function setUseZRouter(bool _useZRouter) external onlyOwner;
```

### setUniFactory

Set Uniswap V3 Factory for auto fee tier discovery


```solidity
function setUniFactory(address _factory) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_factory`|`address`|Factory address (0x33128a8fC17869897dcE68Ed026d694621f6FDfD on Base)|


### setAutoFeeTier

Toggle automatic fee tier discovery


```solidity
function setAutoFeeTier(bool _autoFeeTier) external onlyOwner;
```

### _findBestFeeTier

Find best fee tier for a token pair (checks liquidity)

Checks 0.01%, 0.05%, 0.3%, 1% fee tiers


```solidity
function _findBestFeeTier(address tokenIn, address tokenOut) internal view returns (uint24 bestFee);
```

### setParameters


```solidity
function setParameters(
    uint256 _maxSwapPercent,
    uint256 _swapSlippageBps,
    uint256 _depositSlippageBps,
    uint24 _swapPoolFee
) external onlyOwner;
```

### setActive


```solidity
function setActive(bool _active) external onlyOwner;
```

### initializeApprovals


```solidity
function initializeApprovals() external onlyOwner;
```

### isActive


```solidity
function isActive() external view override returns (bool);
```

### asset


```solidity
function asset() external view override returns (address);
```

### getTotalAssets


```solidity
function getTotalAssets() public view override returns (uint256);
```

### deposit

Deposit CREATOR tokens (single-sided deposit)

Automatically swaps portion to USDC to maintain Charm vault ratio


```solidity
function deposit(uint256 amount) external override onlyVault whenActive nonReentrant returns (uint256 deposited);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`amount`|`uint256`|Amount of CREATOR tokens to deposit|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`deposited`|`uint256`|Actual amount deployed (in CREATOR value)|


### _calculateCreatorToSwap

Calculate how much CREATOR to swap for needed USDC


```solidity
function _calculateCreatorToSwap(uint256 usdcNeeded, uint256 maxCreator) internal view returns (uint256);
```

### isCharmInRange

Check if Charm vault is in range for deposits


```solidity
function isCharmInRange() public view returns (bool inRange, int24 currentTick, int24 lower, int24 upper);
```

### _depositToCharmSafe

Safe Charm deposit - SINGLE ATOMIC


```solidity
function _depositToCharmSafe(uint256 creatorAmount, uint256 usdcAmount, bool creatorIsToken0)
    internal
    returns (uint256 shares);
```

### _swapCreatorToUsdcSafe

Swap CREATOR → USDC with slippage protection

Uses zRouter if enabled, auto fee tier if enabled


```solidity
function _swapCreatorToUsdcSafe(uint256 amountIn) internal returns (uint256 amountOut);
```

### _getPoolPrice

Get pool price (CREATOR per USDC)


```solidity
function _getPoolPrice() internal view returns (uint256 creatorPerUsdc);
```

### withdraw


```solidity
function withdraw(uint256 amount) external override onlyVault nonReentrant returns (uint256 withdrawn);
```

### _swapUsdcToCreatorSafe

Swap USDC → CREATOR with slippage protection


```solidity
function _swapUsdcToCreatorSafe(uint256 amountIn) internal returns (uint256 amountOut);
```

### harvest


```solidity
function harvest() external override onlyVault returns (uint256 profit);
```

### rebalance


```solidity
function rebalance() external override;
```

### emergencyWithdraw


```solidity
function emergencyWithdraw() external override onlyVault returns (uint256 withdrawn);
```

### _returnAllTokens


```solidity
function _returnAllTokens() internal;
```

### _returnUnusedTokens


```solidity
function _returnUnusedTokens() internal;
```

### ownerEmergencyWithdraw


```solidity
function ownerEmergencyWithdraw(address token, address to, uint256 amount) external onlyOwner;
```

### ownerEmergencyWithdrawFromCharm


```solidity
function ownerEmergencyWithdrawFromCharm() external onlyOwner returns (uint256 amount0, uint256 amount1);
```

## Events
### TokensSwapped

```solidity
event TokensSwapped(address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut);
```

### DepositFailed

```solidity
event DepositFailed(string reason);
```

### UnusedTokensReturned

```solidity
event UnusedTokensReturned(uint256 creatorAmount, uint256 usdcAmount);
```

### ParametersUpdated

```solidity
event ParametersUpdated(uint256 maxSwapPercent, uint256 swapSlippageBps);
```

## Errors
### NotVault

```solidity
error NotVault();
```

### NotActive

```solidity
error NotActive();
```

### ZeroAddress

```solidity
error ZeroAddress();
```

### SlippageExceeded

```solidity
error SlippageExceeded(uint256 expected, uint256 actual);
```

