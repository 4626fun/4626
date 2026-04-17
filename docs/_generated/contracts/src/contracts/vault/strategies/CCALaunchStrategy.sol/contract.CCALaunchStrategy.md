# CCALaunchStrategy
[Git Source](https://github.com/wenakita/4626/blob/main/contracts/vault/strategies/CCALaunchStrategy.sol)

**Inherits:**
Ownable, ReentrancyGuard

**Title:**
CCALaunchStrategy

**Author:**
0xakita.eth

Fair launch strategy using Uniswap's Continuous Clearing Auction

USE CASES:
1. Initial ■AKITA token launch - fair price discovery
2. Creator token fundraise - no sniping, early participants rewarded
3. Periodic fee auctions - sell accumulated fees fairly

WHY CCA?
- Official Uniswap mechanism (already deployed on Base)
- Fair price discovery - no timing games
- Early participants get better prices naturally
- No MEV/sandwich attacks
- Graduates to Uniswap V4 pool automatically

CCA Factory is chain-specific; configure via `CCA_FACTORY`.


## State Variables
### UNISWAP_CCA_FACTORY_V110
Uniswap v1.1.0 CCA factory (canonical on Base/Mainnet/Unichain/Sepolia)

See https://github.com/Uniswap/continuous-clearing-auction#deployments


```solidity
address public constant UNISWAP_CCA_FACTORY_V110 = 0xCCccCcCAE7503Cac057829BF2811De42E16e0bD5
```


### MPS
Milli-basis points constant


```solidity
uint24 public constant MPS = 1e7
```


### Q96
Q96 fixed point scalar (2^96) used by Uniswap pricing


```solidity
uint256 public constant Q96 = 2 ** 96
```


### BPS_DENOMINATOR
Basis points denominator.


```solidity
uint256 public constant BPS_DENOMINATOR = 10_000
```


### AUCTION_SPLIT_MPS
Auction allocation: 40%


```solidity
uint24 public constant AUCTION_SPLIT_MPS = 4_000_000
```


### VESTING_SPLIT_MPS
Creator vesting allocation: 40%


```solidity
uint24 public constant VESTING_SPLIT_MPS = 4_000_000
```


### LP_RESERVE_SPLIT_MPS
LP reserve allocation: 20%


```solidity
uint24 public constant LP_RESERVE_SPLIT_MPS = 2_000_000
```


### auctionToken
Token being auctioned (e.g., ■AKITA)


```solidity
IERC20 public immutable auctionToken
```


### currency
Currency to raise (address(0) for ETH)


```solidity
address public currency
```


### ccaFactory
Uniswap CCA factory used to create auctions (upgradeable by owner)

Stored in state so we can migrate factory versions without redeploying this strategy.


```solidity
address public ccaFactory
```


### currentAuction
Current active auction (if any)


```solidity
address public currentAuction
```


### pastAuctions
Historical auctions


```solidity
address[] public pastAuctions
```


### fundsRecipient
Funds recipient (vault or treasury)


```solidity
address public fundsRecipient
```


### tokensRecipient
Unsold tokens recipient


```solidity
address public tokensRecipient
```


### oracle
Oracle to configure with V4 pool on graduation


```solidity
address public oracle
```


### poolManager
V4 PoolManager (configure via `setPoolManager`)


```solidity
IPoolManager public poolManager
```


### taxHook
Tax hook for the V4 pool (configure via `setTaxHook`)


```solidity
address public taxHook
```


### positionManager
V4 PositionManager used to mint post-auction LP


```solidity
IPositionManager public positionManager
```


### positionRecipient
Recipient of the migrated v4 LP position


```solidity
address public positionRecipient
```


### operator
Operator allowed to sweep residual balances after sweepBlock


```solidity
address public operator
```


### feeRecipient
Fee recipient for the tax hook (GaugeController)


```solidity
address public feeRecipient
```


### taxRateBps
Tax rate in basis points (690 = 6.9%)


```solidity
uint256 public taxRateBps = 690
```


### poolFeeTier
Fee tier for V4 pool (default 3000 = 0.3%)


```solidity
uint24 public poolFeeTier = 3000
```


### poolTickSpacing
Tick spacing for V4 pool


```solidity
int24 public poolTickSpacing = 60
```


### approvedLaunchers
Approved addresses that can launch auctions (e.g., VaultActivationBatcher)


```solidity
mapping(address => bool) public approvedLaunchers
```


### backingVault
Optional vault used only for non-blocking launch telemetry.


```solidity
address public backingVault
```


### currentLaunch
Latest lifecycle data for the active auction.


```solidity
LaunchLifecycle public currentLaunch
```


### launchByAuction
Lifecycle snapshots by auction address.


```solidity
mapping(address => LaunchLifecycle) public launchByAuction
```


### phase
Current phase for API/UI/keeper state machines.


```solidity
LifecyclePhase public phase = LifecyclePhase.Idle
```


### lastSweepBlock
Last sweep block target used for operator residual sweeps.


```solidity
uint64 public lastSweepBlock
```


### defaultDuration
Default auction duration in blocks (~1 week on Base at 2s blocks)


```solidity
uint64 public defaultDuration = 302_400
```


### defaultClaimDelay
Default claim delay after auction ends


```solidity
uint64 public defaultClaimDelay = 3600
```


### launchBlockTimeSeconds
Average seconds per block used to convert Thursday UTC boundaries into CCA block schedules.


```solidity
uint64 public launchBlockTimeSeconds = 2
```


### defaultTickSpacing
Default tick spacing in Q96 (recommended ~1% of floor price)

In Uniswap CCA, tickSpacing is a *price granularity* in Q96, not an ERC20/ETH amount.


```solidity
uint256 public defaultTickSpacing = (Q96 / 1000) / 100
```


### defaultFloorPrice
Default floor price in Q96

0.001 ETH per 1 token => 1 ETH buys 1000 tokens => floorPrice = 0.001 * 2^96 = Q96/1000.


```solidity
uint256 public defaultFloorPrice = Q96 / 1000
```


### launchDiscountBps
Discount applied to oracle-derived floor price for launch (8000 = 80%).


```solidity
uint16 public launchDiscountBps = 8000
```


### launchTickSpacingBps
Tick spacing (in bps of derived floor) used for CCA launch params (100 = 1%).


```solidity
uint16 public launchTickSpacingBps = 100
```


### launchOracleMaxAge
Maximum accepted age for oracle prices used at launch.


```solidity
uint64 public launchOracleMaxAge = 7200
```


### migrationDelayBlocks
Delay from auction end to migration eligibility.


```solidity
uint64 public migrationDelayBlocks = 1
```


### defaultSweepDelayBlocks
Delay from claim block to operator residual sweep eligibility.


```solidity
uint64 public defaultSweepDelayBlocks = 14_400
```


### simpleLaunchEnabled
If false, `launchAuctionSimple` is disabled.


```solidity
bool public simpleLaunchEnabled
```


### _configModule

```solidity
address private immutable _configModule
```


### _encodingHelper

```solidity
CCALaunchStrategyEncodingHelper private immutable _encodingHelper
```


## Functions
### constructor

Create CCA launch strategy


```solidity
constructor(
    address _auctionToken,
    address _currency,
    address _fundsRecipient,
    address _tokensRecipient,
    address _owner
) Ownable(_owner);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_auctionToken`|`address`|Token to auction (e.g., ■AKITA)|
|`_currency`|`address`|Currency to raise (address(0) for ETH, or USDC/WETH)|
|`_fundsRecipient`|`address`|Where to send raised funds|
|`_tokensRecipient`|`address`|Where to send unsold tokens|
|`_owner`|`address`|Strategy owner|


### onlyApprovedOrOwner

Only owner or approved launchers can call


```solidity
modifier onlyApprovedOrOwner() ;
```

### _delegateConfig


```solidity
function _delegateConfig() internal;
```

### setApprovedLauncher

Approve or revoke launcher permissions

Only owner can manage approved launchers


```solidity
function setApprovedLauncher(address launcher, bool approved) external;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`launcher`|`address`|Address to approve (e.g., VaultActivationBatcher)|
|`approved`|`bool`|Whether to approve or revoke|


### setCcaFactory

Update the Uniswap CCA factory address used for deployments.

Allows migrating to newer Uniswap factory deployments without redeploying this strategy.


```solidity
function setCcaFactory(address newFactory) external;
```

### setMigrationConfig

Configure migration path (position manager + recipients + delays).

Position manager may be set to zero during bootstrapping, but migrate() will revert until set.


```solidity
function setMigrationConfig(
    address _positionManager,
    address _positionRecipient,
    address _operator,
    uint64 _migrationDelayBlocks,
    uint64 _sweepDelayBlocks
) external;
```

### setBackingVault

Configure optional backing-vault telemetry source.

This is non-blocking visibility only; no auction/migration gates depend on it.


```solidity
function setBackingVault(address _backingVault) external;
```

### setSimpleLaunchEnabled

Enable or disable simplified launch path.


```solidity
function setSimpleLaunchEnabled(bool enabled) external;
```

### _launchAuctionInternal

Internal shared implementation for launching an auction.
IMPORTANT: Do NOT call the external entrypoint via `this.launchAuction(...)` from within the contract.
That changes `msg.sender` (breaks auth) and also trips ReentrancyGuard (both entrypoints are nonReentrant).


```solidity
function _launchAuctionInternal(uint256 amount, uint256 lpReserveAmount, uint128 requiredRaise)
    internal
    returns (address auction);
```

### launchAuction

Launch a new CCA auction for token distribution


```solidity
function launchAuction(uint256 amount, uint256 floorPrice, uint128 requiredRaise, bytes calldata auctionSteps)
    external
    onlyApprovedOrOwner
    nonReentrant
    returns (address auction);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`amount`|`uint256`|Amount of tokens to auction|
|`floorPrice`|`uint256`|Deprecated. Ignored; launch floor is derived onchain from oracle data.|
|`requiredRaise`|`uint128`|Minimum currency to raise for graduation|
|`auctionSteps`|`bytes`|Deprecated. Ignored in favor of strategy-enforced safe schedule.|


### launchAuctionWithReserve

Launch auction with explicit LP reserve metadata (for 40/40/20 batch flows).

`lpReserveAmount` is expected to remain in the strategy for post-auction migration.


```solidity
function launchAuctionWithReserve(
    uint256 amount,
    uint256 lpReserveAmount,
    uint256 floorPrice,
    uint128 requiredRaise,
    bytes calldata auctionSteps
) external onlyApprovedOrOwner nonReentrant returns (address auction);
```

### launchAuctionSimple

Launch auction with default parameters


```solidity
function launchAuctionSimple(uint256 amount, uint128 requiredRaise)
    external
    onlyApprovedOrOwner
    nonReentrant
    returns (address auction);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`amount`|`uint256`|Amount of tokens to auction|
|`requiredRaise`|`uint128`|Minimum currency to raise|


### checkpoint

Checkpoint the current auction

Can be called by anyone, updates price discovery


```solidity
function checkpoint() external;
```

### sweepCurrency

Sweep raised currency after auction graduates.

This only settles auction funds. Pool migration is performed by `migrate()`.


```solidity
function sweepCurrency() external nonReentrant;
```

### finalizeFailedAuction

Finalize a failed auction and unblock relaunchs.

Sweeps unsold auction tokens and clears active auction pointers.


```solidity
function finalizeFailedAuction() external nonReentrant;
```

### migrate

Migrate graduated CCA liquidity into a Uniswap v4 LP position.


```solidity
function migrate() external nonReentrant;
```

### _configureOracleV4Pool

Configure oracle with V4 pool details

Called automatically on graduation if oracle is set


```solidity
function _configureOracleV4Pool() internal;
```

### getTaxHookCalldata

Get the calldata for configuring the tax hook

Returns the exact bytes to call on the tax hook (for ERC-4337 batching)
Token owner must call: taxHook.call(getTaxHookCalldata())


```solidity
function getTaxHookCalldata() external view returns (address target, bytes memory data);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`target`|`address`|The tax hook address to call|
|`data`|`bytes`|The calldata for setTaxConfig|


### getCompleteAuctionCalldata

Get all calldata needed for completion flow (sweep + migrate + configure hook)

Returns array of calls for ERC-4337 batching:
1. sweepCurrency() on this strategy
2. migrate() on this strategy
3. setTaxConfig() on the tax hook (requires token owner)


```solidity
function getCompleteAuctionCalldata() external view returns (address[] memory targets, bytes[] memory calldatas);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`targets`|`address[]`|Array of addresses to call|
|`calldatas`|`bytes[]`|Array of calldata for each call|


### configureOracleV4Pool

Manually configure oracle V4 pool (if not done on graduation)


```solidity
function configureOracleV4Pool() external onlyOwner;
```

### sweepUnsoldTokens

Sweep unsold tokens after auction ends


```solidity
function sweepUnsoldTokens() external nonReentrant;
```

### sweepResidualAuctionToken

Sweep residual auction token balance after sweep window.


```solidity
function sweepResidualAuctionToken() external nonReentrant;
```

### sweepResidualCurrency

Sweep residual raised currency balance after sweep window.


```solidity
function sweepResidualCurrency() external nonReentrant;
```

### _archiveIfFinished


```solidity
function _archiveIfFinished() internal;
```

### _setPhase


```solidity
function _setPhase(LifecyclePhase newPhase) internal;
```

### _derivePhase


```solidity
function _derivePhase(bool isGraduated, LaunchLifecycle memory launchData) internal view returns (LifecyclePhase);
```

### _persistLifecycleSnapshot


```solidity
function _persistLifecycleSnapshot() internal;
```

### _snapshotBackingTelemetry


```solidity
function _snapshotBackingTelemetry() internal;
```

### _deriveScheduledStartBlock


```solidity
function _deriveScheduledStartBlock() internal view returns (uint64 startBlock);
```

### _deriveLaunchPricing


```solidity
function _deriveLaunchPricing()
    internal
    view
    returns (uint256 floorPriceQ96, uint256 tickSpacingQ96, uint256 creatorUsdPrice, uint256 ethUsdPrice);
```

### _deriveLaunchTickSpacing


```solidity
function _deriveLaunchTickSpacing(uint256 floorPriceQ96) internal view returns (uint256 tickSpacingQ96);
```

### _encodeAuctionParams


```solidity
function _encodeAuctionParams(
    uint256 floorPrice,
    uint256 tickSpacingQ96,
    uint128 requiredRaise,
    uint64 startBlock,
    uint64 endBlock,
    uint64 claimBlock,
    bytes memory auctionSteps
) internal view returns (bytes memory);
```

### _createUniswapSafeDefaultSteps


```solidity
function _createUniswapSafeDefaultSteps(uint64 duration) internal view returns (bytes memory);
```

### _currencyBalance


```solidity
function _currencyBalance(address holder) internal view returns (uint256);
```

### _buildPoolKey


```solidity
function _buildPoolKey() internal view returns (PoolKey memory key);
```

### setDefaultDuration

Update default auction duration


```solidity
function setDefaultDuration(uint64 _duration) external;
```

### setDefaultClaimDelay

Update default claim delay


```solidity
function setDefaultClaimDelay(uint64 _delay) external;
```

### setLaunchBlockTimeSeconds

Update the block-time estimate used for Thursday UTC launch alignment.


```solidity
function setLaunchBlockTimeSeconds(uint64 _secondsPerBlock) external;
```

### setMigrationDelayBlocks

Update migration delay after auction end.


```solidity
function setMigrationDelayBlocks(uint64 _delay) external;
```

### setDefaultSweepDelayBlocks

Update default post-claim sweep delay.


```solidity
function setDefaultSweepDelayBlocks(uint64 _delay) external;
```

### setDefaultTickSpacing

Update default tick spacing


```solidity
function setDefaultTickSpacing(uint256 _spacing) external;
```

### setDefaultFloorPrice

Update default floor price

Legacy fallback value retained for backwards compatibility. Launch flow derives floor onchain.


```solidity
function setDefaultFloorPrice(uint256 _price) external;
```

### setLaunchDiscountBps

Update launch floor discount applied to oracle price.


```solidity
function setLaunchDiscountBps(uint16 _discountBps) external;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_discountBps`|`uint16`|Discount in bps (10000 = 100%, 8000 = 80%).|


### setLaunchTickSpacingBps

Update launch tick spacing (as bps of derived launch floor).


```solidity
function setLaunchTickSpacingBps(uint16 _tickSpacingBps) external;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_tickSpacingBps`|`uint16`|Tick spacing bps (100 = 1%).|


### setLaunchOracleMaxAge

Update maximum accepted oracle staleness for launch pricing.


```solidity
function setLaunchOracleMaxAge(uint64 _maxAge) external;
```

### setRecipients

Update fund recipients


```solidity
function setRecipients(address _fundsRecipient, address _tokensRecipient) external;
```

### setOracleConfig

Configure oracle for V4 pool setup on graduation


```solidity
function setOracleConfig(address _oracle, address _poolManager, address _taxHook, address _feeRecipient) external;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_oracle`|`address`|Oracle address to configure|
|`_poolManager`|`address`|V4 PoolManager address|
|`_taxHook`|`address`|Tax hook address for the pool|
|`_feeRecipient`|`address`|GaugeController to receive 6.9% trade fees|


### setFeeRecipient

Update fee recipient (GaugeController)


```solidity
function setFeeRecipient(address _feeRecipient) external;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_feeRecipient`|`address`|New fee recipient address|


### setTaxRate

Update tax rate


```solidity
function setTaxRate(uint256 _taxRateBps) external;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_taxRateBps`|`uint256`|Tax rate in basis points (690 = 6.9%)|


### setPoolFeeTier

Update V4 pool fee tier


```solidity
function setPoolFeeTier(uint24 _feeTier) external;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_feeTier`|`uint24`|Fee in hundredths of bips (3000 = 0.3%)|


### setPoolTickSpacing

Update V4 pool tick spacing


```solidity
function setPoolTickSpacing(int24 _tickSpacing) external;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_tickSpacing`|`int24`|Tick spacing for the pool|


### previewLaunchPricing

Preview onchain launch pricing derived from oracle data.

Reverts when oracle data is missing/stale/invalid.


```solidity
function previewLaunchPricing()
    external
    view
    returns (uint256 floorPriceQ96, uint256 tickSpacingQ96, uint256 creatorUsdPrice, uint256 ethUsdPrice);
```

### getAuctionStatus

Get current auction status


```solidity
function getAuctionStatus()
    external
    view
    returns (address auction, bool isActive, bool isGraduated, uint256 clearingPrice, uint256 currencyRaised);
```

### getLifecycleStatus

Returns richer lifecycle status for keepers and frontend state machines.


```solidity
function getLifecycleStatus() external view returns (LifecycleStatus memory status);
```

### getBackingTelemetry

Non-blocking backing telemetry for share-economics visibility.


```solidity
function getBackingTelemetry()
    external
    view
    returns (
        address vault,
        uint256 launchTotalAssets,
        uint256 launchTotalSupply,
        uint256 currentTotalAssets,
        uint256 currentTotalSupply,
        int256 assetsDelta,
        int256 supplyDelta
    );
```

### getPastAuctions

Get all past auctions


```solidity
function getPastAuctions() external view returns (address[] memory);
```

### auctionCount

Get auction count


```solidity
function auctionCount() external view returns (uint256);
```

### emergencyWithdraw

Emergency withdraw tokens stuck in strategy


```solidity
function emergencyWithdraw(address token, uint256 amount, address to) external;
```

### emergencyWithdrawETH

Emergency withdraw ETH


```solidity
function emergencyWithdrawETH(address payable to) external;
```

### receive


```solidity
receive() external payable;
```

## Events
### AuctionCreated

```solidity
event AuctionCreated(
    address indexed auction, address indexed token, uint256 totalSupply, uint64 startBlock, uint64 endBlock
);
```

### LifecyclePhaseChanged

```solidity
event LifecyclePhaseChanged(address indexed auction, LifecyclePhase phase);
```

### FailedAuctionFinalized

```solidity
event FailedAuctionFinalized(address indexed auction, uint256 unsoldTokens);
```

### Migrated

```solidity
event Migrated(address indexed auction, uint160 sqrtPriceX96, uint256 tokenAmount, uint256 currencyAmount);
```

### AuctionGraduated

```solidity
event AuctionGraduated(address indexed auction, uint256 currencyRaised, uint256 finalPrice);
```

### FundsSwept

```solidity
event FundsSwept(address indexed auction, uint256 amount);
```

### TokensSwept

```solidity
event TokensSwept(address indexed auction, uint256 amount);
```

### LaunchPricingResolved

```solidity
event LaunchPricingResolved(
    address indexed auction,
    uint256 floorPriceQ96,
    uint256 tickSpacingQ96,
    uint256 creatorUsdPrice,
    uint256 ethUsdPrice
);
```

### ConfigUpdated

```solidity
event ConfigUpdated(bytes32 param, uint256 value);
```

### RecipientsUpdated

```solidity
event RecipientsUpdated(address fundsRecipient, address tokensRecipient);
```

### OracleConfigured

```solidity
event OracleConfigured(address indexed oracle, address poolManager, address hook);
```

### V4PoolConfigured

```solidity
event V4PoolConfigured(address indexed oracle, address token0, address token1);
```

### TaxHookConfigured

```solidity
event TaxHookConfigured(address indexed token, address indexed recipient, uint256 taxRate);
```

### LauncherApproved

```solidity
event LauncherApproved(address indexed launcher, bool approved);
```

### CcaFactoryUpdated

```solidity
event CcaFactoryUpdated(address indexed oldFactory, address indexed newFactory);
```

### MigrationConfigUpdated

```solidity
event MigrationConfigUpdated(
    address indexed positionManager,
    address indexed positionRecipient,
    address indexed operator,
    uint64 migrationDelayBlocks,
    uint64 sweepDelayBlocks
);
```

### BackingVaultUpdated

```solidity
event BackingVaultUpdated(address indexed backingVault);
```

### SimpleLaunchToggled

```solidity
event SimpleLaunchToggled(bool enabled);
```

## Errors
### AuctionAlreadyActive

```solidity
error AuctionAlreadyActive();
```

### NoActiveAuction

```solidity
error NoActiveAuction();
```

### AuctionNotGraduated

```solidity
error AuctionNotGraduated();
```

### AuctionStillLive

```solidity
error AuctionStillLive(uint64 endBlock, uint256 currentBlock);
```

### AuctionNotFailed

```solidity
error AuctionNotFailed();
```

### MigrationNotReady

```solidity
error MigrationNotReady(uint64 migrationBlock, uint256 currentBlock);
```

### MigrationConfigMissing

```solidity
error MigrationConfigMissing();
```

### CurrencyBalanceTooLow

```solidity
error CurrencyBalanceTooLow(uint256 needed, uint256 available);
```

### LpReserveTooLow

```solidity
error LpReserveTooLow(uint256 requiredReserve, uint256 availableBalance);
```

### SweepNotAllowed

```solidity
error SweepNotAllowed(uint64 sweepBlock, uint256 currentBlock);
```

### NotOperator

```solidity
error NotOperator(address caller, address expected);
```

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

### SimpleLaunchDisabled

```solidity
error SimpleLaunchDisabled();
```

### ZeroAddress

```solidity
error ZeroAddress();
```

### ZeroAmount

```solidity
error ZeroAmount();
```

### InvalidConfig

```solidity
error InvalidConfig();
```

### Unauthorized

```solidity
error Unauthorized();
```

### EthTransferFailed

```solidity
error EthTransferFailed();
```

## Structs
### LaunchLifecycle

```solidity
struct LaunchLifecycle {
    uint64 startBlock;
    uint64 endBlock;
    uint64 claimBlock;
    uint64 migrationBlock;
    uint64 sweepBlock;
    uint256 auctionAmount;
    uint256 lpReserveAmount;
    uint256 launchVaultTotalAssets;
    uint256 launchVaultTotalSupply;
    bool currencySwept;
    bool unsoldSwept;
    bool migrated;
    bool failedFinalized;
}
```

### LifecycleStatus

```solidity
struct LifecycleStatus {
    uint8 phase;
    address auction;
    bool isGraduated;
    bool auctionWindowOpen;
    bool claimOpen;
    bool currencySwept;
    bool unsoldSwept;
    bool migrated;
    bool failedFinalized;
    uint64 startBlock;
    uint64 endBlock;
    uint64 claimBlock;
    uint64 migrationBlock;
    uint64 sweepBlock;
    uint256 lpReserveAmount;
    uint256 clearingPrice;
    uint256 currencyRaised;
}
```

## Enums
### LifecyclePhase

```solidity
enum LifecyclePhase {
    Idle,
    AuctionLive,
    AuctionEndedPending,
    ClaimReady,
    PoolInitializing,
    PoolLive,
    LaunchFailed,
    AuctionScheduled
}
```

