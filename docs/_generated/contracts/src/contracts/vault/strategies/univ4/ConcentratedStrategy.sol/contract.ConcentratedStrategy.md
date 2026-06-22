# ConcentratedStrategy
[Git Source](https://github.com/wenakita/4626/blob/main/contracts/vault/strategies/univ4/ConcentratedStrategy.sol)

**Inherits:**
Ownable, ReentrancyGuard


## Constants
### BASIS_POINTS

```solidity
uint256 public constant BASIS_POINTS = 10000
```


### MIN_TICK

```solidity
int24 public constant MIN_TICK = -887272
```


### MAX_TICK

```solidity
int24 public constant MAX_TICK = 887272
```


### REBALANCE_BURN_SLIPPAGE_BPS
Slippage tolerance (in bps) for BURN_POSITION min-out amounts during rebalance.
FIX: S-H05 — BURN_POSITION previously passed zero as both min amounts. To defend
against sandwich attacks in the same block a rebalance lands (TWAP oracles use
historical data and cannot react within a single tx), the min amounts are now
derived from the TWAP-implied sqrtPriceX96 with a 1% floor.


```solidity
uint256 public constant REBALANCE_BURN_SLIPPAGE_BPS = 100
```


### WITHDRAW_BURN_SLIPPAGE_BPS
Tighter slippage tolerance (in bps) for BURN_POSITION during full withdraws.

`withdrawAll` is a higher-trust path (onlyLPManager) but still benefits from a
non-zero min amount so LP manager bugs / compromised keepers cannot silently
burn against a manipulated pool. Kept at 2% to avoid unnecessary reverts when
the pool genuinely diverges from TWAP within a block.


```solidity
uint256 public constant WITHDRAW_BURN_SLIPPAGE_BPS = 200
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


### hookRegistry
Governance-managed hook allowlist for V4 pool configuration.


```solidity
IApprovedV4HooksRegistry public immutable hookRegistry
```


## State Variables
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


### tickSpacing
Tick spacing for the pool


```solidity
int24 public tickSpacing = 60
```


### twapOracle
Optional TWAP oracle for tick-based manipulation resistance.

If maxTwapDeviation > 0 and this is unset, rebalances will revert.


```solidity
ICreatorOracle public twapOracle
```


### position

```solidity
Position public position
```


### baseThreshold
Range width in ticks (half width each side)


```solidity
int24 public baseThreshold = 500
```


### period
Minimum time between rebalances


```solidity
uint32 public period = 1 hours
```


### minTickMove
Minimum tick movement required to trigger rebalance


```solidity
int24 public minTickMove = 10
```


### maxTwapDeviation
Maximum allowed deviation from TWAP (anti-manipulation)


```solidity
int24 public maxTwapDeviation = 100
```


### twapDuration
TWAP duration in seconds
FIX: S-H05 — 60s TWAP is trivially manipulable; 900s is minimum safe window


```solidity
uint32 public twapDuration = 900
```


### lastTimestamp
Last rebalance timestamp


```solidity
uint256 public lastTimestamp
```


### lastTick
Last tick at rebalance


```solidity
int24 public lastTick
```


### totalLiquidity
Total liquidity


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


```solidity
constructor(address _creatorCoin, address _pairedToken, address _lpManager, address _owner, address _hookRegistry)
    Ownable(_owner);
```

### configurePool


```solidity
function configurePool(address _poolManager, address _positionManager, address _permit2, PoolKey calldata _poolKey)
    external
    onlyOwner;
```

### reconfigureApprovals

Rotate Permit2/PosM approval targets and revoke stale approvals.

Useful for operator key rotation or explicit approval hygiene.


```solidity
function reconfigureApprovals(address _positionManager, address _permit2) external onlyOwner;
```

### setTwapOracle


```solidity
function setTwapOracle(address _oracle) external onlyOwner;
```

### setRebalanceParameters

Set rebalance parameters (Charm-style)


```solidity
function setRebalanceParameters(
    int24 _baseThreshold,
    uint32 _period,
    int24 _minTickMove,
    int24 _maxTwapDeviation,
    uint32 _twapDuration
) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_baseThreshold`|`int24`|Half of the range width in ticks|
|`_period`|`uint32`|Minimum time between rebalances|
|`_minTickMove`|`int24`|Minimum tick movement to trigger rebalance|
|`_maxTwapDeviation`|`int24`|Maximum allowed deviation from TWAP|
|`_twapDuration`|`uint32`|TWAP calculation window|


### deposit

Deposit liquidity into concentrated position


```solidity
function deposit(uint256 creatorCoinAmount, uint256 pairedAmount)
    external
    nonReentrant
    onlyLPManager
    whenActive
    returns (uint256 liquidity);
```

### withdraw

Withdraw liquidity


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

Rebalance position (Charm-style with all guards)

Checks: time elapsed, price movement, TWAP deviation, boundary


```solidity
function rebalance() external onlyLPManager whenActive;
```

### checkCanRebalance

Check if rebalance can be executed (Charm-style guards)

Reverts with specific error if any check fails


```solidity
function checkCanRebalance() public view;
```

### getTwap

Get time-weighted average price (TWAP) in ticks

Queries pool's oracle for historical price data


```solidity
function getTwap() public view returns (int24);
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

### canRebalance

Check if rebalance would pass all guards


```solidity
function canRebalance() external view returns (bool);
```

### getPosition

Get current position details


```solidity
function getPosition()
    external
    view
    returns (int24 tickLower, int24 tickUpper, uint256 liquidity, uint256 tokenId);
```

### getRebalanceInfo

Get rebalance status info


```solidity
function getRebalanceInfo()
    external
    view
    returns (
        int24 currentTick,
        int24 twap,
        int24 twapDeviation,
        uint256 timeSinceLastRebalance,
        int24 tickMoveSinceLast,
        bool canRebalanceNow
    );
```

### _getCurrentTick


```solidity
function _getCurrentTick() internal view returns (int24);
```

### _calculateRange


```solidity
function _calculateRange(int24 currentTick) internal view returns (int24 tickLower, int24 tickUpper);
```

### _floor

Rounds tick down towards negative infinity (multiple of tickSpacing)


```solidity
function _floor(int24 tick) internal view returns (int24);
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

### _posmBurn

FIX: S-H05 — Dual defense against pool manipulation during burns:
(1) `checkCanRebalance()` rejects rebalances when spot deviates from the
900s TWAP by more than `maxTwapDeviation` (prevents multi-block
manipulation and stale-price exits).
(2) `amount0Min` / `amount1Min` are derived from the TWAP-implied
sqrtPriceX96 with a per-path slippage floor (see
REBALANCE_BURN_SLIPPAGE_BPS / WITHDRAW_BURN_SLIPPAGE_BPS). This makes
same-block sandwiching strictly unprofitable because the burn reverts
if the PoolManager would return less than the TWAP-implied amounts
net of slippage.


```solidity
function _posmBurn(uint256 tokenId, uint128 amount0Min, uint128 amount1Min) internal;
```

### _computeBurnMinAmounts

FIX: S-H05 — Compute BURN_POSITION min-out amounts from the TWAP-implied
sqrtPriceX96 with a bps slippage floor.
Returns (0, 0) when:
- `liquidity == 0` (nothing to burn) — callers still pay for position tracking state.
- `maxTwapDeviation == 0` (TWAP checks explicitly disabled by governance). In this
regime the operator has opted out of manipulation protection wholesale and a
zero min-out preserves pre-fix withdraw behaviour.
Reverts with `TwapOracleNotSet()` when:
- `maxTwapDeviation > 0` (TWAP protection is on) but `twapOracle` is unset.
This mirrors `getTwap()`'s presence check and surfaces the mis-configuration
as a clear, named revert on the `withdrawAll` / `rebalance` paths rather than
letting the raw low-level call to a zero address bubble up. Using a zero min-out
fallback here is deliberately avoided because that would silently disable the
S-H05 slippage floor precisely when the operator believes it is on.
Otherwise, computes the expected amounts from the TWAP tick and shaves
`slippageBps` basis points.


```solidity
function _computeBurnMinAmounts(int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 slippageBps)
    internal
    view
    returns (uint128 amount0Min, uint128 amount1Min);
```

### _calculateLiquidity


```solidity
function _calculateLiquidity(
    uint256 creatorCoinAmount,
    uint256 pairedAmount,
    int24, /* tickLower */
    int24 /* tickUpper */
)
    internal
    pure
    returns (uint256);
```

### _calculateAmountsForLiquidity


```solidity
function _calculateAmountsForLiquidity(uint256 liquidity)
    internal
    view
    returns (uint256 creatorCoinAmount, uint256 pairedAmount);
```

### _sqrt


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

### _requireConfigured


```solidity
function _requireConfigured() internal view;
```

### emergencyWithdraw


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
event Rebalanced(int24 oldTickLower, int24 oldTickUpper, int24 newTickLower, int24 newTickUpper, int24 tick);
```

### Snapshot

```solidity
event Snapshot(int24 tick, uint256 totalAmount0, uint256 totalAmount1, uint256 totalSupply);
```

### PoolConfigured

```solidity
event PoolConfigured(
    bytes32 poolId, address poolManager, address positionManager, address permit2, bool creatorIsCurrency0
);
```

### ApprovalsReconfigured

```solidity
event ApprovalsReconfigured(
    address oldPositionManager, address oldPermit2, address newPositionManager, address newPermit2
);
```

### ParametersUpdated

```solidity
event ParametersUpdated(
    int24 baseThreshold, uint32 period, int24 minTickMove, int24 maxTwapDeviation, uint32 twapDuration
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

### InsufficientLiquidity

```solidity
error InsufficientLiquidity();
```

### PeriodNotElapsed

```solidity
error PeriodNotElapsed();
```

### InsufficientTickMove

```solidity
error InsufficientTickMove();
```

### TwapDeviationTooHigh

```solidity
error TwapDeviationTooHigh();
```

### PriceTooCloseToBoundary

```solidity
error PriceTooCloseToBoundary();
```

### InvalidParameters

```solidity
error InvalidParameters();
```

### PoolNotFullyConfigured

```solidity
error PoolNotFullyConfigured();
```

### TwapOracleNotSet

```solidity
error TwapOracleNotSet();
```

### PoolAlreadyConfigured

```solidity
error PoolAlreadyConfigured();
```

### InvalidHook

```solidity
error InvalidHook(address hook);
```

### HookNotApproved

```solidity
error HookNotApproved(address hook);
```

## Structs
### Position
Current position


```solidity
struct Position {
    int24 tickLower;
    int24 tickUpper;
    uint128 liquidity;
    uint256 tokenId;
}
```

