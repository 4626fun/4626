# CreatorCharmStrategy
[Git Source](https://github.com/wenakita/4626/blob/2951e17122326ff4a23b28e80356c44121ebf59c/contracts/vault/strategies/univ3/CreatorCharmStrategy.sol)

**Inherits:**
[IStrategy](/contracts/interfaces/IStrategy.sol/interface.IStrategy.md), [IStrategyValuation](/contracts/interfaces/IStrategyValuation.sol/interface.IStrategyValuation.md), ReentrancyGuard, Ownable


## Constants
### DEFAULT_TWAP_DURATION
Default TWAP window used for valuation (share pricing).


```solidity
uint32 internal constant DEFAULT_TWAP_DURATION = 1800
```


### MIN_TWAP_DURATION

```solidity
uint32 public constant MIN_TWAP_DURATION = 60
```


### MAX_TWAP_DURATION

```solidity
uint32 public constant MAX_TWAP_DURATION = 1 days
```


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


### AJNA_WAD

```solidity
uint256 internal constant AJNA_WAD = 1e18
```


### USDC_TO_AJNA_WAD

```solidity
uint256 internal constant USDC_TO_AJNA_WAD = 1e12
```


### AJNA_MIN_BUCKET_INDEX

```solidity
uint256 internal constant AJNA_MIN_BUCKET_INDEX = 1
```


### AJNA_MAX_BUCKET_INDEX

```solidity
uint256 internal constant AJNA_MAX_BUCKET_INDEX = 7_388
```


### AJNA_APPROX_BUCKET_STEP_BPS

```solidity
uint256 internal constant AJNA_APPROX_BUCKET_STEP_BPS = 50
```


## State Variables
### charmVault

```solidity
ICharmVault public charmVault
```


### swapPool

```solidity
IUniswapV3Pool public swapPool
```


### creatorOracle
CreatorOracle used for USDC valuation inside `getTotalAssets()`.

This is intentionally distinct from Uniswap TWAP used for swap sizing/slippage.


```solidity
ICreatorOracle public creatorOracle
```


### twapDuration
TWAP window (seconds) used for valuation inside `getTotalAssets()`.

This impacts ERC-4626 share pricing via `CreatorOVault.totalAssets()`.


```solidity
uint32 public twapDuration = DEFAULT_TWAP_DURATION
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


### ajnaPool
Optional Ajna ERC20 pool used as CREATOR borrow backstop against USDC collateral.


```solidity
IAjnaPool public ajnaPool
```


### ajnaBorrowEnabled

```solidity
bool public ajnaBorrowEnabled
```


### ajnaMaxDebt

```solidity
uint256 public ajnaMaxDebt = type(uint256).max
```


### ajnaMaxBorrowPerWithdraw

```solidity
uint256 public ajnaMaxBorrowPerWithdraw = type(uint256).max
```


### ajnaMinCollateralRatioBps

```solidity
uint256 public ajnaMinCollateralRatioBps = 12_500
```


### ajnaBorrowLimitIndex

```solidity
uint256 public ajnaBorrowLimitIndex
```


### ajnaRepayLimitIndex

```solidity
uint256 public ajnaRepayLimitIndex
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

### setCreatorOracle


```solidity
function setCreatorOracle(address _creatorOracle) external onlyOwner;
```

### setTwapDuration


```solidity
function setTwapDuration(uint32 _twapDuration) external onlyOwner;
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

### setAjnaPool


```solidity
function setAjnaPool(address _ajnaPool) external onlyOwner;
```

### setAjnaBorrowConfig


```solidity
function setAjnaBorrowConfig(
    bool _enabled,
    uint256 _maxDebt,
    uint256 _maxBorrowPerWithdraw,
    uint256 _minCollateralRatioBps,
    uint256 _borrowLimitIndex,
    uint256 _repayLimitIndex
) external onlyOwner;
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

### isValuationReady

Strategy valuation health check for ERC-4626 deposit/mint gating.

MUST NOT revert. Any USDC exposure (idle/charm/Ajna collateral) requires a
fresh CreatorOracle price. Ajna debt state must be readable and above the
configured collateral ratio threshold when debt is outstanding.


```solidity
function isValuationReady() external view override returns (bool);
```

### getAjnaPosition


```solidity
function getAjnaPosition()
    external
    view
    returns (
        bool configured,
        bool readable,
        uint256 debtCreator,
        uint256 collateralUsdc,
        uint256 collateralRatioBps
    );
```

### getTotalAssets


```solidity
function getTotalAssets() public view override returns (uint256);
```

### _getCharmExposure


```solidity
function _getCharmExposure() internal view returns (uint256 creatorAmount, uint256 usdcAmount, bool readable);
```

### _readAjnaDebtState


```solidity
function _readAjnaDebtState() internal view returns (AjnaDebtState memory state);
```

### _getFreshCreatorPrice


```solidity
function _getFreshCreatorPrice() internal view returns (uint256 priceUsd, bool fresh);
```

### _usdcToCreatorValue


```solidity
function _usdcToCreatorValue(uint256 usdcAmount) internal view returns (uint256 creatorAmount);
```

### _usdcToCreatorValueWithPrice


```solidity
function _usdcToCreatorValueWithPrice(uint256 usdcAmount, uint256 creatorPriceUsd) internal pure returns (uint256);
```

### _computeCollateralRatioBps


```solidity
function _computeCollateralRatioBps(uint256 collateralValueCreator, uint256 debtCreator)
    internal
    pure
    returns (uint256);
```

### _getPoolPriceTWAP

Get manipulation-resistant valuation price (CREATOR per USDC, 1e18).

Uses Uniswap V3 TWAP (pool observations), not spot `slot0` (manipulable intra-tx).
If observations are unavailable, returns (0,false). Callers should not silently fall back to spot pricing.


```solidity
function _getPoolPriceTWAP(uint32 duration) internal view returns (uint256 creatorPerUsdc, bool ok);
```

### _getQuoteAtTick

Minimal Uniswap V3 OracleLibrary-style quote at tick.
Returns `quoteToken` amount for `baseAmount` of `baseToken`.
Tick is assumed to be for the canonical Uniswap V3 ordering (token0 < token1).


```solidity
function _getQuoteAtTick(int24 tick, uint128 baseAmount, address baseToken, address quoteToken)
    internal
    pure
    returns (uint256 quoteAmount);
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

Pre-checks range, uses slippage protection, graceful failure handling


```solidity
function _depositToCharmSafe(uint256 creatorAmount, uint256 usdcAmount, bool creatorIsToken0)
    internal
    returns (uint256 shares);
```

### _int24ToString

Convert int24 to string for error messages


```solidity
function _int24ToString(int24 value) internal pure returns (string memory);
```

### _bytesToHex

Convert bytes to hex string for error debugging


```solidity
function _bytesToHex(bytes memory data) internal pure returns (string memory);
```

### _swapCreatorToUsdcSafe

Swap CREATOR → USDC with slippage protection

Uses Uniswap V3 router with optional auto fee tier discovery.


```solidity
function _swapCreatorToUsdcSafe(uint256 amountIn) internal returns (uint256 amountOut);
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

### _swapUsdcToCreatorRequired


```solidity
function _swapUsdcToCreatorRequired(uint256 amountIn) internal returns (uint256 amountOut);
```

### _swapUsdcToCreator


```solidity
function _swapUsdcToCreator(uint256 amountIn, bool required) internal returns (uint256 amountOut);
```

### _tryAjnaBorrow


```solidity
function _tryAjnaBorrow(uint256 creatorNeeded) internal returns (uint256 borrowed);
```

### _repayAjnaDebtWithCreator


```solidity
function _repayAjnaDebtWithCreator(uint256 availableCreator)
    internal
    returns (uint256 repaid, uint256 collateralPulledUsdc);
```

### _usdcToAjnaWad


```solidity
function _usdcToAjnaWad(uint256 usdcAmount) internal pure returns (uint256);
```

### _resolveAjnaLimitIndex

Resolve Ajna draw/repay limit index.

Configured non-zero index is used as-is (clamped); 0 enables oracle-driven auto mode:
base bucket from CreatorOracle V3 TWAP helper + conservative collateral-ratio buffer.


```solidity
function _resolveAjnaLimitIndex(bool forBorrow) internal view returns (uint256 limitIndex);
```

### _oracleSuggestedAjnaBucket


```solidity
function _oracleSuggestedAjnaBucket() internal view returns (uint256 bucketIndex);
```

### _clampAjnaBucketIndex


```solidity
function _clampAjnaBucketIndex(uint256 index) internal pure returns (uint256);
```

### _creatorToUsdcAmountWithPrice


```solidity
function _creatorToUsdcAmountWithPrice(uint256 creatorAmount, uint256 creatorPriceUsd)
    internal
    pure
    returns (uint256);
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

### TwapDurationUpdated

```solidity
event TwapDurationUpdated(uint32 oldDuration, uint32 newDuration);
```

### CreatorOracleUpdated

```solidity
event CreatorOracleUpdated(address indexed oldOracle, address indexed newOracle);
```

### AjnaPoolUpdated

```solidity
event AjnaPoolUpdated(address indexed oldPool, address indexed newPool);
```

### AjnaBorrowConfigUpdated

```solidity
event AjnaBorrowConfigUpdated(
    bool enabled,
    uint256 maxDebt,
    uint256 maxBorrowPerWithdraw,
    uint256 minCollateralRatioBps,
    uint256 borrowLimitIndex,
    uint256 repayLimitIndex
);
```

### AjnaBorrowed

```solidity
event AjnaBorrowed(uint256 requestedCreator, uint256 borrowedCreator, uint256 pledgedUsdc);
```

### AjnaRepaid

```solidity
event AjnaRepaid(uint256 repaidCreator, uint256 collateralPulledUsdc);
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

### InvalidTwapDuration

```solidity
error InvalidTwapDuration(uint32 duration);
```

### TwapUnavailable

```solidity
error TwapUnavailable();
```

### RequiredSwapFailed

```solidity
error RequiredSwapFailed();
```

### InvalidCollateralRatioBps

```solidity
error InvalidCollateralRatioBps(uint256 ratioBps);
```

### InvalidAjnaLimitIndex

```solidity
error InvalidAjnaLimitIndex(uint256 limitIndex);
```

### InvalidAjnaPool

```solidity
error InvalidAjnaPool(
    address expectedQuote, address actualQuote, address expectedCollateral, address actualCollateral
);
```

### AjnaPositionOpen

```solidity
error AjnaPositionOpen(uint256 debtCreator, uint256 collateralUsdc);
```

### WithdrawLiquidityUnavailable

```solidity
error WithdrawLiquidityUnavailable(uint256 requested, uint256 available);
```

## Structs
### AjnaDebtState

```solidity
struct AjnaDebtState {
    bool readable;
    uint256 debtCreator;
    uint256 collateralUsdc;
}
```

