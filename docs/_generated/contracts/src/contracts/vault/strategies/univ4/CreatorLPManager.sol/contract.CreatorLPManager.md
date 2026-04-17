# CreatorLPManager
[Git Source](https://github.com/wenakita/4626/blob/main/contracts/vault/strategies/univ4/CreatorLPManager.sol)

**Inherits:**
Ownable, ReentrancyGuard

**Title:**
CreatorLPManager

**Author:**
0xakita.eth

Manages LP liquidity for CreatorShareOFT (■AKITA) on Uniswap V4

PURPOSE:
This strategy manages liquidity for the WRAPPED SHARE TOKEN (■AKITA)
on Uniswap V4 with 6.9% fee hooks for the lottery system.
NOT for the original Creator Coin - that uses CreatorCharmStrategy on V3.

TOKEN DISTINCTION:
┌────────────────────────────────────────────────────────────┐
│ AKITA (Creator Coin)  →  CreatorCharmStrategy  →  V3 Pool  │
│ ■AKITA (ShareOFT)     →  CreatorLPManager      →  V4 Pool  │
│                                                  + 6.9% Hook
└────────────────────────────────────────────────────────────┘

WHY V4 FOR SHARE TOKEN:
- V4 hooks enable the 6.9% fee on trades
- Fees feed into the lottery jackpot via GaugeController
- The ShareOFT (■AKITA) is the primary trading token for the lottery system

ARCHITECTURE (inspired by Charm Alpha Pro Vault):
CreatorOVault → CreatorLPManager → Uniswap V4 Positions

THREE-POSITION STRATEGY:
1. Full Range: Passive liquidity across entire price range
2. Base Order: Concentrated around current price (both sides)
3. Limit Order: Single-sided bid or ask (excess token)

REBALANCE FLOW:
1. Withdraw all liquidity from all positions
2. Place full range order (weighted %)
3. Place base order with remaining liquidity
4. Place limit order with excess token (bid or ask)

REBALANCE GUARDS (from Charm):
- Time: Must wait `period` seconds between rebalances
- Price: Must move at least `minTickMove` ticks
- TWAP: Spot price must be within `maxTwapDeviation` of TWAP
- Boundary: Price can't be too close to MIN/MAX tick


## State Variables
### MIN_TICK

```solidity
int24 public constant MIN_TICK = -887272
```


### MAX_TICK

```solidity
int24 public constant MAX_TICK = 887272
```


### PRECISION

```solidity
uint256 public constant PRECISION = 1e6
```


### CREATOR_COIN
Creator Coin token (token0 or token1 depending on sort)


```solidity
IERC20 public immutable CREATOR_COIN
```


### PAIRED_TOKEN
Paired token (WETH)


```solidity
IERC20 public immutable PAIRED_TOKEN
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


### hookRegistry
Governance-managed hook allowlist for V4 pool configuration.


```solidity
IApprovedV4HooksRegistry public immutable hookRegistry
```


### vault
Vault that owns this manager


```solidity
address public vault
```


### tickSpacing
Tick spacing of the pool


```solidity
int24 public tickSpacing
```


### twapOracle
Optional TWAP oracle for tick-based manipulation resistance.

If maxTwapDeviation > 0 and this is unset, rebalances will revert.


```solidity
ICreatorOracle public twapOracle
```


### fullRangePosition

```solidity
PositionInfo public fullRangePosition
```


### basePosition

```solidity
PositionInfo public basePosition
```


### limitPosition

```solidity
PositionInfo public limitPosition
```


### fullRangeWeight
Proportion of liquidity in full range (multiplied by 1e6)


```solidity
uint24 public fullRangeWeight = 400000
```


### baseThreshold
Half of the base order width in ticks


```solidity
int24 public baseThreshold = 500
```


### limitThreshold
Limit order width in ticks


```solidity
int24 public limitThreshold = 100
```


### period
Minimum time between rebalances


```solidity
uint32 public period = 1 hours
```


### minTickMove
Minimum tick movement to trigger rebalance


```solidity
int24 public minTickMove = 10
```


### maxTwapDeviation
Max deviation from TWAP (anti-manipulation)


```solidity
int24 public maxTwapDeviation = 100
```


### twapDuration
TWAP duration in seconds
FIX: S-H02 — 60s TWAP is trivially manipulable; 900s is minimum safe window


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


### maxRebalanceSlippageBps
FIX: S-H02 — max allowed value loss during rebalance (basis points)


```solidity
uint256 public maxRebalanceSlippageBps = 500
```


### accruedFees0
Accrued protocol fees (token0)


```solidity
uint256 public accruedFees0
```


### accruedFees1
Accrued protocol fees (token1)


```solidity
uint256 public accruedFees1
```


### feeRecipient
Fee recipient


```solidity
address public feeRecipient
```


### isManager
Managers who can execute rebalance


```solidity
mapping(address => bool) public isManager
```


## Functions
### onlyVault


```solidity
modifier onlyVault() ;
```

### onlyManager


```solidity
modifier onlyManager() ;
```

### constructor


```solidity
constructor(address _creatorCoin, address _pairedToken, address _vault, address _owner, address _hookRegistry)
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

### setParameters

Set strategy parameters (Charm-style)


```solidity
function setParameters(
    uint24 _fullRangeWeight,
    int24 _baseThreshold,
    int24 _limitThreshold,
    uint32 _period,
    int24 _minTickMove,
    int24 _maxTwapDeviation,
    uint32 _twapDuration
) external onlyOwner;
```

### deposit

Deposit tokens (held until next rebalance)


```solidity
function deposit(uint256 amount0, uint256 amount1)
    external
    nonReentrant
    onlyVault
    returns (uint256 totalLiquidity);
```

### withdraw

Withdraw proportional share from all positions


```solidity
function withdraw(uint256 shares, uint256 totalShares)
    external
    nonReentrant
    onlyVault
    returns (uint256 amount0, uint256 amount1);
```

### rebalance

Rebalance all positions

Three-position strategy:
1. Full range (passive)
2. Base order (concentrated around price)
3. Limit order (single-sided with excess)


```solidity
function rebalance() external nonReentrant onlyManager;
```

### checkCanRebalance

Check if rebalance can be executed


```solidity
function checkCanRebalance() public view;
```

### getTwap

Get TWAP price in ticks


```solidity
function getTwap() public view returns (int24);
```

### getTotalAmounts

Get total amounts across all positions and idle


```solidity
function getTotalAmounts() public view returns (uint256 total0, uint256 total1);
```

### getBalance0

Idle balance of token0


```solidity
function getBalance0() public view returns (uint256);
```

### getBalance1

Idle balance of token1


```solidity
function getBalance1() public view returns (uint256);
```

### canRebalance

Check if rebalance is possible


```solidity
function canRebalance() external view returns (bool);
```

### getPositions

Get position info


```solidity
function getPositions()
    external
    view
    returns (PositionInfo memory fullRange, PositionInfo memory base, PositionInfo memory limit);
```

### _getCurrentTick


```solidity
function _getCurrentTick() internal view returns (int24);
```

### _floor


```solidity
function _floor(int24 tick) internal view returns (int24);
```

### _mintLiquidity


```solidity
function _mintLiquidity(PositionInfo storage pos, uint128 liquidity) internal;
```

### _burnAndCollect


```solidity
function _burnAndCollect(PositionInfo storage pos) internal returns (uint256 amount0, uint256 amount1);
```

### _burnLiquidityShare


```solidity
function _burnLiquidityShare(PositionInfo storage pos, uint256 shares, uint256 totalShares)
    internal
    returns (uint256 amount0, uint256 amount1);
```

### _getPositionAmounts


```solidity
function _getPositionAmounts(PositionInfo storage pos) internal view returns (uint256 amount0, uint256 amount1);
```

### _liquidityForAmounts


```solidity
function _liquidityForAmounts(int24 tickLower, int24 tickUpper, uint256 amount0, uint256 amount1)
    internal
    view
    returns (uint128);
```

### _requireConfigured


```solidity
function _requireConfigured() internal view;
```

### _estimateLiquidity


```solidity
function _estimateLiquidity(uint256 amount0, uint256 amount1) internal pure returns (uint256);
```

### _sqrt


```solidity
function _sqrt(uint256 x) internal pure returns (uint256);
```

### setVault


```solidity
function setVault(address _vault) external onlyOwner;
```

### setManager


```solidity
function setManager(address _manager, bool _status) external onlyOwner;
```

### setFeeRecipient


```solidity
function setFeeRecipient(address _recipient) external onlyOwner;
```

### collectFees


```solidity
function collectFees() external;
```

### emergencyWithdraw

Emergency withdraw all liquidity


```solidity
function emergencyWithdraw() external onlyOwner;
```

## Events
### Deposit

```solidity
event Deposit(address indexed sender, uint256 amount0, uint256 amount1, uint256 liquidity);
```

### Withdraw

```solidity
event Withdraw(address indexed sender, uint256 amount0, uint256 amount1, uint256 liquidity);
```

### Rebalanced

```solidity
event Rebalanced(int24 tick, uint256 balance0, uint256 balance1);
```

### Snapshot

```solidity
event Snapshot(int24 tick, uint256 totalAmount0, uint256 totalAmount1);
```

### FeesCollected

```solidity
event FeesCollected(uint256 fees0, uint256 fees1);
```

### ParametersUpdated

```solidity
event ParametersUpdated(uint24 fullRangeWeight, int24 baseThreshold, int24 limitThreshold);
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

## Errors
### NotVault

```solidity
error NotVault();
```

### NotManager

```solidity
error NotManager();
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

### PositionManagerNotSet

```solidity
error PositionManagerNotSet();
```

### Permit2NotSet

```solidity
error Permit2NotSet();
```

### InvalidPoolKey

```solidity
error InvalidPoolKey();
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

### RebalanceSlippageExceeded

```solidity
error RebalanceSlippageExceeded(uint256 valueBefore, uint256 valueAfter);
```

## Structs
### PositionInfo
Full range position (MIN_TICK to MAX_TICK)


```solidity
struct PositionInfo {
    int24 tickLower;
    int24 tickUpper;
    uint128 liquidity;
    uint256 tokenId;
}
```

