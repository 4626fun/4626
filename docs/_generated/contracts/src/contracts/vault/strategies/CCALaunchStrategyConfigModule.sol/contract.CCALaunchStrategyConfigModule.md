# CCALaunchStrategyConfigModule
[Git Source](https://github.com/wenakita/4626/blob/2951e17122326ff4a23b28e80356c44121ebf59c/contracts/vault/strategies/CCALaunchStrategyConfigModule.sol)

**Inherits:**
Ownable, ReentrancyGuard


## Constants
### BPS_DENOMINATOR

```solidity
uint256 public constant BPS_DENOMINATOR = 10_000
```


### CONFIG_DURATION

```solidity
bytes32 private constant CONFIG_DURATION = "duration"
```


### CONFIG_CLAIM_DELAY

```solidity
bytes32 private constant CONFIG_CLAIM_DELAY = "claimDelay"
```


### CONFIG_BLOCK_TIME

```solidity
bytes32 private constant CONFIG_BLOCK_TIME = "launchBlockTimeSeconds"
```


### CONFIG_MIGRATION_DELAY

```solidity
bytes32 private constant CONFIG_MIGRATION_DELAY = "migrationDelayBlocks"
```


### CONFIG_SWEEP_DELAY

```solidity
bytes32 private constant CONFIG_SWEEP_DELAY = "sweepDelayBlocks"
```


### CONFIG_TICK_SPACING

```solidity
bytes32 private constant CONFIG_TICK_SPACING = "tickSpacing"
```


### CONFIG_FLOOR_PRICE

```solidity
bytes32 private constant CONFIG_FLOOR_PRICE = "floorPrice"
```


### CONFIG_LAUNCH_DISCOUNT

```solidity
bytes32 private constant CONFIG_LAUNCH_DISCOUNT = "launchDiscountBps"
```


### CONFIG_LAUNCH_TICK_SPACING

```solidity
bytes32 private constant CONFIG_LAUNCH_TICK_SPACING = "launchTickSpacingBps"
```


### CONFIG_ORACLE_MAX_AGE

```solidity
bytes32 private constant CONFIG_ORACLE_MAX_AGE = "launchOracleMaxAge"
```


### CONFIG_POOL_FEE

```solidity
bytes32 private constant CONFIG_POOL_FEE = "poolFeeTier"
```


### CONFIG_POOL_TICK_SPACING

```solidity
bytes32 private constant CONFIG_POOL_TICK_SPACING = "poolTickSpacing"
```


### auctionToken

```solidity
IERC20 public immutable auctionToken
```


### _self

```solidity
address private immutable _self
```


## State Variables
### currency

```solidity
address public currency
```


### ccaFactory

```solidity
address public ccaFactory
```


### currentAuction

```solidity
address public currentAuction
```


### pastAuctions

```solidity
address[] public pastAuctions
```


### fundsRecipient

```solidity
address public fundsRecipient
```


### tokensRecipient

```solidity
address public tokensRecipient
```


### oracle

```solidity
address public oracle
```


### poolManager

```solidity
IPoolManager public poolManager
```


### taxHook

```solidity
address public taxHook
```


### positionManager

```solidity
IPositionManager public positionManager
```


### positionRecipient

```solidity
address public positionRecipient
```


### operator

```solidity
address public operator
```


### feeRecipient

```solidity
address public feeRecipient
```


### taxRateBps

```solidity
uint256 public taxRateBps
```


### poolFeeTier

```solidity
uint24 public poolFeeTier
```


### poolTickSpacing

```solidity
int24 public poolTickSpacing
```


### approvedLaunchers

```solidity
mapping(address => bool) public approvedLaunchers
```


### backingVault

```solidity
address public backingVault
```


### currentLaunch

```solidity
LaunchLifecycle public currentLaunch
```


### launchByAuction

```solidity
mapping(address => LaunchLifecycle) public launchByAuction
```


### phase

```solidity
LifecyclePhase public phase
```


### lastSweepBlock

```solidity
uint64 public lastSweepBlock
```


### defaultDuration

```solidity
uint64 public defaultDuration
```


### defaultClaimDelay

```solidity
uint64 public defaultClaimDelay
```


### launchBlockTimeSeconds

```solidity
uint64 public launchBlockTimeSeconds
```


### defaultTickSpacing

```solidity
uint256 public defaultTickSpacing
```


### defaultFloorPrice

```solidity
uint256 public defaultFloorPrice
```


### launchDiscountBps

```solidity
uint16 public launchDiscountBps
```


### launchTickSpacingBps

```solidity
uint16 public launchTickSpacingBps
```


### launchOracleMaxAge

```solidity
uint64 public launchOracleMaxAge
```


### migrationDelayBlocks

```solidity
uint64 public migrationDelayBlocks
```


### defaultSweepDelayBlocks

```solidity
uint64 public defaultSweepDelayBlocks
```


### simpleLaunchEnabled

```solidity
bool public simpleLaunchEnabled
```


## Functions
### constructor


```solidity
constructor(
    address _auctionToken,
    address _currency,
    address _fundsRecipient,
    address _tokensRecipient,
    address _owner
) Ownable(_owner);
```

### onlyDelegateCall


```solidity
modifier onlyDelegateCall() ;
```

### setApprovedLauncher


```solidity
function setApprovedLauncher(address launcher, bool approved) external onlyDelegateCall onlyOwner;
```

### setCcaFactory


```solidity
function setCcaFactory(address newFactory) external onlyDelegateCall onlyOwner;
```

### setMigrationConfig


```solidity
function setMigrationConfig(
    address _positionManager,
    address _positionRecipient,
    address _operator,
    uint64 _migrationDelayBlocks,
    uint64 _sweepDelayBlocks
) external onlyDelegateCall onlyOwner;
```

### setBackingVault


```solidity
function setBackingVault(address _backingVault) external onlyDelegateCall onlyOwner;
```

### setSimpleLaunchEnabled


```solidity
function setSimpleLaunchEnabled(bool enabled) external onlyDelegateCall onlyOwner;
```

### sweepResidualAuctionToken


```solidity
function sweepResidualAuctionToken() external onlyDelegateCall;
```

### sweepResidualCurrency


```solidity
function sweepResidualCurrency() external onlyDelegateCall;
```

### setDefaultDuration


```solidity
function setDefaultDuration(uint64 _duration) external onlyDelegateCall onlyOwner;
```

### setDefaultClaimDelay


```solidity
function setDefaultClaimDelay(uint64 _delay) external onlyDelegateCall onlyOwner;
```

### setLaunchBlockTimeSeconds


```solidity
function setLaunchBlockTimeSeconds(uint64 _secondsPerBlock) external onlyDelegateCall onlyOwner;
```

### setMigrationDelayBlocks


```solidity
function setMigrationDelayBlocks(uint64 _delay) external onlyDelegateCall onlyOwner;
```

### setDefaultSweepDelayBlocks


```solidity
function setDefaultSweepDelayBlocks(uint64 _delay) external onlyDelegateCall onlyOwner;
```

### setDefaultTickSpacing


```solidity
function setDefaultTickSpacing(uint256 _spacing) external onlyDelegateCall onlyOwner;
```

### setDefaultFloorPrice


```solidity
function setDefaultFloorPrice(uint256 _price) external onlyDelegateCall onlyOwner;
```

### setLaunchDiscountBps


```solidity
function setLaunchDiscountBps(uint16 _discountBps) external onlyDelegateCall onlyOwner;
```

### setLaunchTickSpacingBps


```solidity
function setLaunchTickSpacingBps(uint16 _tickSpacingBps) external onlyDelegateCall onlyOwner;
```

### setLaunchOracleMaxAge


```solidity
function setLaunchOracleMaxAge(uint64 _maxAge) external onlyDelegateCall onlyOwner;
```

### setRecipients


```solidity
function setRecipients(address _fundsRecipient, address _tokensRecipient) external onlyDelegateCall onlyOwner;
```

### setOracleConfig


```solidity
function setOracleConfig(address _oracle, address _poolManager, address _taxHook, address _feeRecipient)
    external
    onlyDelegateCall
    onlyOwner;
```

### setFeeRecipient


```solidity
function setFeeRecipient(address _feeRecipient) external onlyDelegateCall onlyOwner;
```

### setTaxRate


```solidity
function setTaxRate(uint256 _taxRateBps) external onlyDelegateCall onlyOwner;
```

### setPoolFeeTier


```solidity
function setPoolFeeTier(uint24 _feeTier) external onlyDelegateCall onlyOwner;
```

### setPoolTickSpacing


```solidity
function setPoolTickSpacing(int24 _tickSpacing) external onlyDelegateCall onlyOwner;
```

### emergencyWithdraw


```solidity
function emergencyWithdraw(address token, uint256 amount, address to) external onlyDelegateCall onlyOwner;
```

### emergencyWithdrawETH


```solidity
function emergencyWithdrawETH(address payable to) external onlyDelegateCall onlyOwner;
```

## Events
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

### FundsSwept

```solidity
event FundsSwept(address indexed auction, uint256 amount);
```

### TokensSwept

```solidity
event TokensSwept(address indexed auction, uint256 amount);
```

## Errors
### ZeroAddress

```solidity
error ZeroAddress();
```

### InvalidConfig

```solidity
error InvalidConfig();
```

### EthTransferFailed

```solidity
error EthTransferFailed();
```

### SweepNotAllowed

```solidity
error SweepNotAllowed(uint64 sweepBlock, uint256 currentBlock);
```

### NotOperator

```solidity
error NotOperator(address caller, address expected);
```

### OnlyDelegateCall

```solidity
error OnlyDelegateCall();
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

