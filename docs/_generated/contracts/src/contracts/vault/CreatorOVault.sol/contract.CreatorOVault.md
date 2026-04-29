# CreatorOVault
[Git Source](https://github.com/wenakita/4626/blob/main/contracts/vault/CreatorOVault.sol)

**Inherits:**
ERC4626, Ownable, ReentrancyGuard, EIP712

**Title:**
CreatorOVault

**Author:**
0xakita.eth

Synchronous ERC-4626 vault for Creator Coins with full strategy support

ARCHITECTURE:
- Fully ERC-4626 compliant vault
- Deposit Creator Coin → mint vault shares
- Deploy idle assets to yield strategies
- Profit unlocking prevents PPS manipulation

STRATEGY SYSTEM:
- addStrategy() - Add yield strategy with allocation weight
- removeStrategy() - Remove strategy and withdraw funds
- deployToStrategies() - Deploy idle funds
- report() - Harvest yields and update accounting

ACCESS CONTROL:
- Owner: Full control
- Management: Strategy management, fees
- Keeper: Can call report/tend
- EmergencyAdmin: Can shutdown

CONSTRUCTOR ARGS (same on all chains):
- _creatorCoin: Creator Coin address
- _owner: deployer
- _name: Vault name (e.g., "Creator OVault - AKITA")
- _symbol: Vault symbol (e.g., "▢AKITA")


## State Variables
### MAX_FEE
Maximum performance fee (20%)


```solidity
uint16 public constant MAX_FEE = 2_000
```


### MAX_BPS
Basis points denominator


```solidity
uint256 internal constant MAX_BPS = 10_000
```


### MAX_BPS_EXTENDED
Extended precision for profit unlocking rate


```solidity
uint256 internal constant MAX_BPS_EXTENDED = 1_000_000_000_000
```


### SECONDS_PER_YEAR
Seconds per year


```solidity
uint256 internal constant SECONDS_PER_YEAR = 31_556_952
```


### MAX_STRATEGIES
Maximum strategies


```solidity
uint256 public constant MAX_STRATEGIES = 5
```


### MODULE_STORAGE_VERSION

```solidity
bytes32 internal constant MODULE_STORAGE_VERSION = keccak256("CreatorOVaultModuleStorage.current")
```


### MODULE_KIND_CORE

```solidity
bytes32 internal constant MODULE_KIND_CORE = keccak256("CreatorOVaultModule.core")
```


### MODULE_KIND_STRATEGIES

```solidity
bytes32 internal constant MODULE_KIND_STRATEGIES = keccak256("CreatorOVaultModule.strategies")
```


### MODULE_KIND_ADMIN

```solidity
bytes32 internal constant MODULE_KIND_ADMIN = keccak256("CreatorOVaultModule.admin")
```


### VIRTUAL_SHARES_OFFSET
Virtual offset for share calculations (prevents first-depositor inflation attack)

Based on OpenZeppelin ERC4626 security recommendations
Offset of 1e3 means an attacker needs to donate 1000x the victim's deposit
to steal 0.1% of their funds - economically unfeasible

**Note:**
security: Mitigates yTUSD-style "dust-balance / non-zero-supply" attacks


```solidity
uint256 internal constant VIRTUAL_SHARES_OFFSET = 1e3
```


### VIRTUAL_ASSETS_OFFSET

```solidity
uint256 internal constant VIRTUAL_ASSETS_OFFSET = 1
```


### MINIMUM_FIRST_DEPOSIT
Minimum first deposit to ensure meaningful liquidity

Serves two purposes:
1. Prevents dust manipulation attacks
2. Ensures creator launches have real liquidity

**Notes:**
- security: Prevents "dust deposit → inflate → value-extraction" attack vector

- economics: TEMP: 50M tokens = 5% of typical 1B supply


```solidity
uint256 public constant MINIMUM_FIRST_DEPOSIT = 50_000_000e18
```


### MAX_PRICE_CHANGE_BPS
Maximum price change per transaction (in basis points)

Prevents catastrophic single-tx price manipulation

**Note:**
security: Limits impact of any oracle/accounting manipulation


```solidity
uint256 public constant MAX_PRICE_CHANGE_BPS = 1000
```


### CREATOR_COIN
Creator Coin token


```solidity
IERC20 public immutable CREATOR_COIN
```


### coinBalance
Current Creator Coin balance held directly by vault


```solidity
uint256 public coinBalance
```


### activeStrategies
Strategy management


```solidity
mapping(address => bool) public activeStrategies
```


### strategyWeights

```solidity
mapping(address => uint256) public strategyWeights
```


### strategyList

```solidity
address[] public strategyList
```


### totalStrategyWeight

```solidity
uint256 public totalStrategyWeight
```


### management
Management role (can manage strategies)


```solidity
address public management
```


### pendingManagement

```solidity
address public pendingManagement
```


### keeper
Keeper role (can call report/tend)


```solidity
address public keeper
```


### emergencyAdmin
Emergency admin (can shutdown)


```solidity
address public emergencyAdmin
```


### gaugeController
GaugeController (can burn shares)


```solidity
address public gaugeController
```


### burnStream
Burn stream contract (can burn its own shares for PPS increase)

Set once (immutable-by-policy) to avoid "trust me bro" rug vectors.


```solidity
address internal burnStream
```


### performanceFee
Performance fee in basis points


```solidity
uint16 public performanceFee
```


### performanceFeeRecipient
Performance fee recipient


```solidity
address public performanceFeeRecipient
```


### profitUnlockingRate
Shares to unlock per second


```solidity
uint256 public profitUnlockingRate
```


### fullProfitUnlockDate
When all profits unlocked


```solidity
uint96 public fullProfitUnlockDate
```


### profitMaxUnlockTime
Max time to unlock profits


```solidity
uint32 public profitMaxUnlockTime
```


### totalLockedShares
Shares locked from last report


```solidity
uint256 public totalLockedShares
```


### totalQueuedWithdrawalShares
Shares currently held by queued withdrawals


```solidity
uint256 public totalQueuedWithdrawalShares
```


### lastProfitUnlockUpdate
Last timestamp that profit unlock processing was applied


```solidity
uint96 public lastProfitUnlockUpdate
```


### lastReport
Last report timestamp


```solidity
uint96 public lastReport
```


### totalAssetsAtLastReport
Total assets at last report


```solidity
uint256 public totalAssetsAtLastReport
```


### trustedPpsCheckpoint
Trusted price-per-share checkpoint (1e18) refreshed on `report()`


```solidity
uint256 public trustedPpsCheckpoint
```


### trustedPpsMaxDeviationBps
Maximum allowed deviation from trusted PPS for deposit/mint gating


```solidity
uint256 public trustedPpsMaxDeviationBps = 1_000
```


### totalSharesBurned
Total shares burned for price increase


```solidity
uint256 public totalSharesBurned
```


### isShutdown
Shutdown flag


```solidity
bool public isShutdown
```


### paused
Pause flag


```solidity
bool public paused
```


### whitelistEnabled
Whitelist enabled


```solidity
bool public whitelistEnabled
```


### whitelist
Whitelist mapping


```solidity
mapping(address => bool) public whitelist
```


### OP_DEPOSIT
Bitmask permission: deposit-like actions


```solidity
uint256 public constant OP_DEPOSIT = 1 << 0
```


### OP_WITHDRAW
Bitmask permission: withdraw-like actions


```solidity
uint256 public constant OP_WITHDRAW = 1 << 1
```


### OP_ACTIVATE
Bitmask permission: activation/batching actions


```solidity
uint256 public constant OP_ACTIVATE = 1 << 2
```


### operatorEpoch
Operator epoch. Bumped on ownership transfer to invalidate all previous operator grants.


```solidity
uint256 public operatorEpoch
```


### _operatorPerms
Operator permissions per epoch (epoch-scoped to make invalidation trivial).


```solidity
mapping(uint256 => mapping(address => uint256)) internal _operatorPerms
```


### operatorNonce
Nonce for `permitOperator` (separate from Permit2 nonces and deploy authorizations).


```solidity
uint256 public operatorNonce
```


### _PERMIT_OPERATOR_TYPEHASH

```solidity
bytes32 private constant _PERMIT_OPERATOR_TYPEHASH =
    keccak256("PermitOperator(address exec,uint256 perms,uint256 nonce,uint256 deadline)")
```


### MIN_RESCUE_DELAY
Minimum allowed rescue delay


```solidity
uint64 public constant MIN_RESCUE_DELAY = 1 days
```


### MAX_RESCUE_DELAY
Maximum allowed rescue delay


```solidity
uint64 public constant MAX_RESCUE_DELAY = 30 days
```


### protocolRescue
Protocol rescue authority (typically a multisig). Settable by owner (opt-out by setting to 0).


```solidity
address public protocolRescue
```


### rescueDelay
Delay before the protocol can finalize an ownership rescue


```solidity
uint64 public rescueDelay
```


### pendingRescueOwner
Pending rescue target owner


```solidity
address public pendingRescueOwner
```


### rescueUnlockTime
Timestamp when `pendingRescueOwner` may be finalized by `protocolRescue`


```solidity
uint64 public rescueUnlockTime
```


### maxTotalSupply
Maximum total supply (in shares)


```solidity
uint256 public maxTotalSupply = type(uint256).max
```


### deploymentThreshold
Keep this much Creator Coin idle for redemptions


```solidity
uint256 public deploymentThreshold = 1000e18
```


### minDeploymentInterval
Minimum deployment interval


```solidity
uint256 public minDeploymentInterval = 5 minutes
```


### lastDeployment
Last deployment timestamp


```solidity
uint256 public lastDeployment
```


### lastDepositBlock
Block number of last deposit (per user)


```solidity
mapping(address => uint256) public lastDepositBlock
```


### withdrawDelayBlocks
Minimum blocks between deposit and withdraw (flash loan protection)


```solidity
uint256 public withdrawDelayBlocks = 1
```


### largeWithdrawalThreshold
Large withdrawal threshold (requires delay)


```solidity
uint256 public largeWithdrawalThreshold = 100_000e18
```


### largeWithdrawalDelayBlocks
Extra delay for large withdrawals (in blocks)


```solidity
uint256 public largeWithdrawalDelayBlocks = 10
```


### queuedWithdrawals

```solidity
mapping(address => QueuedWithdrawal) public queuedWithdrawals
```


### defaultQueue
Default withdrawal queue (ordered list of strategies)

Based on Yearn V3: default_queue pattern for predictable withdrawals


```solidity
address[] public defaultQueue
```


### MAX_QUEUE
Maximum queue size


```solidity
uint256 public constant MAX_QUEUE = 10
```


### useDefaultQueue
Force use of default queue (ignore custom queue in withdrawals)


```solidity
bool public useDefaultQueue
```


### autoAllocate
Automatically allocate deposits to first strategy in queue


```solidity
bool public autoAllocate
```


### minimumTotalIdle
Minimum Creator Coin to keep idle for fast redemptions

Based on Yearn V3: minimum_total_idle pattern


```solidity
uint256 public minimumTotalIdle = 10_000e18
```


### strategyDebt
Current debt per strategy (tracks actual deployed amount)


```solidity
mapping(address => uint256) public strategyDebt
```


### totalDebt
Total debt across all strategies


```solidity
uint256 public totalDebt
```


### debtPurchaser
Debt purchaser role (can buy bad debt from vault)


```solidity
address public debtPurchaser
```


### _coreModule

```solidity
address internal _coreModule
```


### _strategiesModule

```solidity
address internal _strategiesModule
```


### _adminModule

```solidity
address internal _adminModule
```


## Functions
### onlyManagement


```solidity
modifier onlyManagement() ;
```

### onlyKeepers


```solidity
modifier onlyKeepers() ;
```

### onlyEmergencyAuthorized


```solidity
modifier onlyEmergencyAuthorized() ;
```

### onlyGaugeController


```solidity
modifier onlyGaugeController() ;
```

### whenNotPaused


```solidity
modifier whenNotPaused() ;
```

### whenNotShutdown


```solidity
modifier whenNotShutdown() ;
```

### onlyWhitelisted


```solidity
modifier onlyWhitelisted() ;
```

### onlyDebtPurchaser


```solidity
modifier onlyDebtPurchaser() ;
```

### onlyProtocolRescue


```solidity
modifier onlyProtocolRescue() ;
```

### constructor

Deploy CreatorOVault with same address on all chains via CREATE2


```solidity
constructor(address _creatorCoin, address _owner, string memory _name, string memory _symbol)
    ERC20(_name, _symbol)
    ERC4626(IERC20(_creatorCoin))
    Ownable(_owner)
    EIP712("CreatorOVault", "1");
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_creatorCoin`|`address`|Creator Coin address|
|`_owner`|`address`|Owner address|
|`_name`|`string`|Vault name (e.g., "Creator OVault - AKITA")|
|`_symbol`|`string`|Vault symbol (e.g., "▢AKITA")|


### setModulesOnce


```solidity
function setModulesOnce(address coreModule, address strategiesModule, address adminModule) external onlyOwner;
```

### _validateModuleIdentity


```solidity
function _validateModuleIdentity(address module, bytes32 expectedKind) internal view;
```

### _requireModulesSet


```solidity
function _requireModulesSet() internal view;
```

### _delegate

Delegatecall is intentional: modules execute against this vault's storage root.
Access control is enforced by the calling external functions before dispatch.


```solidity
function _delegate(address module) internal;
```

### _delegateAndReturn

Delegatecall helper that returns normally so modifiers can clean up.
Do NOT use `_delegate()` from a function with a modifier that has an epilogue
(e.g. OZ `nonReentrant`), since `_delegate()` uses an assembly `return`.
Delegate targets are module addresses configured by owner-only `setModulesOnce`.


```solidity
function _delegateAndReturn(address module) internal returns (bytes memory ret);
```

### __moduleUpdate


```solidity
function __moduleUpdate(address from, address to, uint256 value) external;
```

### __moduleSpendAllowance


```solidity
function __moduleSpendAllowance(address owner_, address spender, uint256 value) external;
```

### __moduleTransferOwnership


```solidity
function __moduleTransferOwnership(address newOwner) external;
```

### unlockedShares

Calculate unlocked shares pending burn

Shows matured shares since last unlock processing checkpoint


```solidity
function unlockedShares() public view returns (uint256);
```

### lockedShares

Get locked (not yet unlocked) shares


```solidity
function lockedShares() public view returns (uint256);
```

### _availableProfitShares

Profit shares available on vault balance (excludes queued withdrawals)


```solidity
function _availableProfitShares() internal view returns (uint256);
```

### _increaseReportBaselineForPrincipalInflow

Adjust report baseline upward for user principal inflows

Bootstraps from live assets when baseline is uninitialized (legacy vaults)


```solidity
function _increaseReportBaselineForPrincipalInflow(uint256 assets) internal;
```

### _decreaseReportBaselineForPrincipalOutflow

Adjust report baseline downward for user principal outflows

Uses floor-at-zero semantics to avoid underflow on extreme outflows


```solidity
function _decreaseReportBaselineForPrincipalOutflow(uint256 assets) internal;
```

### _processProfitUnlock

Burn matured profit-lock shares to realize unlock progression


```solidity
function _processProfitUnlock() internal;
```

### totalAssets

Total assets controlled by vault

Includes idle balance + strategy deployments


```solidity
function totalAssets() public view override returns (uint256);
```

### _getStrategyAssetsSafe

Read strategy assets without allowing a single faulty strategy to brick the vault.

Returns tracked `strategyDebt` when strategy valuation reverts.


```solidity
function _getStrategyAssetsSafe(address strategy) internal view returns (uint256 assets);
```

### _firstStrategyValuationNotReady

Find the first active strategy explicitly reporting unhealthy valuation.

Strategies MUST implement `IStrategyValuation` and MUST NOT revert in valuation
reads. Missing interfaces or any reverts are treated as NOT ready to prevent
ERC-4626 share dilution when `totalAssets()` would be under-reported.


```solidity
function _firstStrategyValuationNotReady() internal view returns (address bad);
```

### _requireStrategyValuationsReady


```solidity
function _requireStrategyValuationsReady() internal view;
```

### deposit

Deposit Creator Coin into vault

Protected against first-depositor inflation attacks via:
1. Minimum first deposit requirement
2. Virtual shares offset in conversion
3. Shares/assets ratio sanity check

**Note:**
security: See yTUSD exploit mitigation notes


```solidity
function deposit(uint256 assets, address receiver)
    public
    override
    nonReentrant
    whenNotPaused
    whenNotShutdown
    onlyWhitelisted
    returns (uint256 shares);
```

### mint

Mint exact shares

Protected against inflation attacks

**Note:**
security: See yTUSD exploit mitigation notes


```solidity
function mint(uint256 shares, address receiver)
    public
    override
    nonReentrant
    whenNotPaused
    whenNotShutdown
    onlyWhitelisted
    returns (uint256 assets);
```

### redeem

Redeem shares for Creator Coin

SYNCHRONOUS - Transfers immediately for small amounts
Large withdrawals must be queued for MEV protection

**Note:**
security: Flash loan protected - cannot withdraw same block as deposit


```solidity
function redeem(uint256 shares, address receiver, address owner_)
    public
    override
    nonReentrant
    returns (uint256 assets);
```

### withdraw

Withdraw exact Creator Coin amount

SYNCHRONOUS - Transfers immediately for small amounts
Large withdrawals must be queued for MEV protection

**Note:**
security: Flash loan protected - cannot withdraw same block as deposit


```solidity
function withdraw(uint256 assets, address receiver, address owner_)
    public
    override
    nonReentrant
    returns (uint256 shares);
```

### queueWithdrawal

Queue a large withdrawal

Required for withdrawals >= largeWithdrawalThreshold
Must wait largeWithdrawalDelayBlocks before claiming


```solidity
function queueWithdrawal(uint256 shares, address receiver) external nonReentrant;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`shares`|`uint256`|Amount of shares to withdraw|
|`receiver`|`address`|Address to receive Creator Coin when claimed|


### claimQueuedWithdrawal

Claim a queued withdrawal after delay period

Can only be called after unlockBlock has passed


```solidity
function claimQueuedWithdrawal() external nonReentrant returns (uint256 assets);
```

### cancelQueuedWithdrawal

Cancel a queued withdrawal and get shares back


```solidity
function cancelQueuedWithdrawal() external nonReentrant returns (uint256 shares);
```

### previewRedeem

Preview redeem (ERC-4626 override)

FIX: S-C02 — cap preview at liquid assets minus queued withdrawals.
OZ default uses totalAssets()/totalSupply() which overstates realisable value
when totalQueuedWithdrawalShares > 0 (those shares claim assets at redemption).


```solidity
function previewRedeem(uint256 shares) public view override returns (uint256);
```

### maxDeposit

Max deposit (standard ERC4626)


```solidity
function maxDeposit(address receiver) public view override returns (uint256);
```

### maxMint

Max mint (standard ERC4626)


```solidity
function maxMint(address receiver) public view override returns (uint256);
```

### maxWithdraw

Max withdraw (standard ERC4626)


```solidity
function maxWithdraw(address owner_) public view override returns (uint256);
```

### maxRedeem

Max redeem (standard ERC4626)


```solidity
function maxRedeem(address owner_) public view override returns (uint256);
```

### _syncCoinBalance

Synchronize internal `coinBalance` to the real token balance.

`coinBalance` is used for operational decisions; we keep it strict and synced
to prevent share pricing / solvency issues with non-standard ERC-20 behavior.


```solidity
function _syncCoinBalance() internal returns (uint256 actual);
```

### _pullCreatorCoinExact

Pull creator coin and require exact receipt.

Rejects fee-on-transfer / deflationary / rebasing tokens by enforcing
that the vault's balance increases by exactly `amount`.


```solidity
function _pullCreatorCoinExact(address from, uint256 amount) internal returns (uint256 received);
```

### _pushCreatorCoinExact

Push creator coin out of vault and require exact vault-side debit.

Enforces that the vault's own balance decreases by exactly `amount`.


```solidity
function _pushCreatorCoinExact(address to, uint256 amount) internal returns (uint256 spent);
```

### _depositIntoStrategyMeasured

Deploy creator coin into a strategy using measured vault outflow.

Uses vault-side balance delta (`spent`) as canonical accounting input so
fee-on-transfer / partial-spend strategy internals do not revert keeper deploys.


```solidity
function _depositIntoStrategyMeasured(address strategy, uint256 amount) internal returns (uint256 deposited);
```

### _withdrawFromStrategyMeasured

Withdraw from strategy and validate returned amount against balance delta.


```solidity
function _withdrawFromStrategyMeasured(address strategy, uint256 amount) internal returns (uint256 withdrawn);
```

### _withdrawFromStrategyBestEffort

Best-effort strategy withdrawal for user redemptions.

Never reverts on strategy failure; returns the measured amount received by the vault.


```solidity
function _withdrawFromStrategyBestEffort(address strategy, uint256 amount) internal returns (uint256 withdrawn);
```

### _ensureCoin

Ensure vault has enough Creator Coin for redemptions

Withdraws from strategies if needed


```solidity
function _ensureCoin(uint256 coinNeeded) internal;
```

### _checkPriceChange

Check that price change is within acceptable bounds

Prevents catastrophic single-tx price manipulation

**Note:**
security: Key defense against yTUSD-style cascading failures


```solidity
function _checkPriceChange(uint256 priceBefore, uint256 priceAfter) internal pure;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`priceBefore`|`uint256`|Price per share before operation|
|`priceAfter`|`uint256`|Price per share after operation|


### addStrategy

Add a new strategy


```solidity
function addStrategy(address strategy, uint256 weight) external nonReentrant onlyManagement;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`strategy`|`address`|Strategy address|
|`weight`|`uint256`|Allocation weight (basis points, total <= 10000)|


### addStrategy

Add a new yield strategy with queue option

Based on Yearn V3: add_strategy pattern


```solidity
function addStrategy(address strategy, uint256 weight, bool addToQueue) public nonReentrant onlyManagement;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`strategy`|`address`|Strategy address (must be ERC-4626 compatible)|
|`weight`|`uint256`|Allocation weight (basis points, max 10000)|
|`addToQueue`|`bool`|Whether to add to default withdrawal queue|


### removeStrategy

Remove a strategy

Withdraws all funds before removal


```solidity
function removeStrategy(address strategy) external nonReentrant onlyManagement;
```

### forceRemoveStrategy


```solidity
function forceRemoveStrategy(address strategy) external nonReentrant onlyManagement;
```

### _removeFromQueue

Remove a strategy from the default queue

Internal helper based on Yearn V3 pattern


```solidity
function _removeFromQueue(address strategy) internal;
```

### updateStrategyWeight

Update strategy weight


```solidity
function updateStrategyWeight(address strategy, uint256 newWeight) external nonReentrant onlyManagement;
```

### deployToStrategies

Deploy idle funds to strategies


```solidity
function deployToStrategies() external nonReentrant onlyKeepers;
```

### forceDeployToStrategies

Force deploy (management only)


```solidity
function forceDeployToStrategies() external nonReentrant onlyManagement;
```

### _deployToStrategies

Internal deploy logic


```solidity
function _deployToStrategies() internal;
```

### _withdrawFromStrategies

Withdraw from strategies


```solidity
function _withdrawFromStrategies(uint256 amountNeeded) internal returns (uint256 totalWithdrawn);
```

### _assessUnrealisedLoss

Assess unrealized losses for a strategy

Based on Yearn V3: _assess_share_of_unrealised_losses pattern


```solidity
function _assessUnrealisedLoss(address strategy, uint256 currentDebt, uint256 assetsNeeded)
    internal
    view
    returns (uint256);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`strategy`|`address`|The strategy to assess|
|`currentDebt`|`uint256`|What vault thinks strategy should have|
|`assetsNeeded`|`uint256`|Amount being withdrawn|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|Loss share of unrealized losses|


### _autoAllocateToStrategy

Auto-allocate idle funds to first strategy in queue

Based on Yearn V3: auto_allocate pattern


```solidity
function _autoAllocateToStrategy() internal;
```

### report

Report profit/loss and charge fees

Called periodically by keeper


```solidity
function report() external nonReentrant onlyKeepers returns (uint256 profit, uint256 loss);
```

### tend

Perform maintenance without full report


```solidity
function tend() external nonReentrant onlyKeepers;
```

### burnSharesForPriceIncrease

Burn shares to increase price (called by GaugeController)


```solidity
function burnSharesForPriceIncrease(uint256 shares) external nonReentrant;
```

### injectCapital

Inject capital without minting shares (increases PPS)

Anyone can call (typically protocol treasury)

**Note:**
security: Price change check prevents dramatic manipulation


```solidity
function injectCapital(uint256 amount) external nonReentrant whenNotPaused onlyManagement;
```

### setDefaultQueue

Set the default withdrawal queue

Based on Yearn V3: set_default_queue pattern


```solidity
function setDefaultQueue(address[] calldata newQueue) external onlyManagement;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`newQueue`|`address[]`|Ordered array of strategies for withdrawals|


### setUseDefaultQueue

Set whether to force use of default queue

Based on Yearn V3: set_use_default_queue pattern


```solidity
function setUseDefaultQueue(bool _useDefaultQueue) external onlyManagement;
```

### setAutoAllocate

Set auto-allocate option

Based on Yearn V3: set_auto_allocate pattern


```solidity
function setAutoAllocate(bool _autoAllocate) external onlyManagement;
```

### setMinimumTotalIdle

Set minimum total idle

Based on Yearn V3: set_minimum_total_idle pattern


```solidity
function setMinimumTotalIdle(uint256 _minimumTotalIdle) external onlyManagement;
```

### setDebtPurchaser

Set debt purchaser address


```solidity
function setDebtPurchaser(address _debtPurchaser) external onlyOwner;
```

### buyDebt

Buy bad debt from a strategy

Based on Yearn V3: buy_debt pattern


```solidity
function buyDebt(address strategy, uint256 amount) external nonReentrant onlyDebtPurchaser;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`strategy`|`address`|Strategy to buy debt from|
|`amount`|`uint256`|Amount of debt to purchase|


### assessUnrealisedLosses

Get unrealized losses for a strategy

Based on Yearn V3: assess_share_of_unrealised_losses pattern


```solidity
function assessUnrealisedLosses(address strategy, uint256 assetsNeeded) external view returns (uint256);
```

### shutdownVault


```solidity
function shutdownVault() external onlyEmergencyAuthorized;
```

### emergencyWithdrawFromStrategies


```solidity
function emergencyWithdrawFromStrategies() external nonReentrant onlyEmergencyAuthorized;
```

### emergencyWithdraw


```solidity
function emergencyWithdraw(uint256 amount, address to) external nonReentrant onlyEmergencyAuthorized;
```

### setPaused


```solidity
function setPaused(bool _paused) external onlyOwner;
```

### setGaugeController


```solidity
function setGaugeController(address _gaugeController) external onlyOwner;
```

### setBurnStream

Set the burn stream contract (ONE-TIME).

This is intentionally one-way to make streamed-burn enforceable.
Once set, vault shares minted to the burn stream cannot be withdrawn — only burned.


```solidity
function setBurnStream(address _burnStream) external onlyOwner;
```

### setKeeper


```solidity
function setKeeper(address _keeper) external onlyManagement;
```

### setEmergencyAdmin


```solidity
function setEmergencyAdmin(address _emergencyAdmin) external onlyManagement;
```

### setWhitelistEnabled


```solidity
function setWhitelistEnabled(bool _enabled) external onlyOwner;
```

### setWhitelist


```solidity
function setWhitelist(address _account, bool _status) external onlyOwner;
```

### setWhitelistBatch


```solidity
function setWhitelistBatch(address[] calldata _accounts, bool _status) external onlyOwner;
```

### operatorPerms

Get operator permissions for the current epoch


```solidity
function operatorPerms(address exec) public view returns (uint256);
```

### setOperatorPerms

Set operator permissions for an execution wallet (current epoch)

Setting perms to 0 revokes the operator


```solidity
function setOperatorPerms(address exec, uint256 perms) external onlyOwner;
```

### permitOperator

Permit-based operator grant (EIP-712)

Signature MUST be produced by the current `owner()` (canonical identity).
The domain binds `chainId` + `verifyingContract` (this vault).


```solidity
function permitOperator(address exec, uint256 perms, uint256 deadline, bytes calldata sig) external;
```

### isAuthorizedOperator

Check whether an execution wallet is authorized for a specific permission

The owner is always authorized.


```solidity
function isAuthorizedOperator(address exec, uint256 perm) public view returns (bool);
```

### _transferOwnership

Bump `operatorEpoch` on ownership transfer to invalidate all prior operator grants.
Skip bump on the constructor's initial owner set (oldOwner == 0).


```solidity
function _transferOwnership(address newOwner) internal override;
```

### setProtocolRescue

Configure the protocol rescue authority (typically a multisig). Owner may opt out by setting to 0.

Configuration changes are blocked while a rescue is pending; cancel first.


```solidity
function setProtocolRescue(address rescue) external onlyOwner;
```

### setRescueDelay

Set the rescue delay (time between initiate/finalize).

Configuration changes are blocked while a rescue is pending; cancel first.


```solidity
function setRescueDelay(uint64 delay) external onlyOwner;
```

### initiateOwnershipRescue

Initiate a timelocked ownership rescue to `newOwner`.

Only callable by `protocolRescue`. The current owner can cancel before finalization.


```solidity
function initiateOwnershipRescue(address newOwner) external onlyProtocolRescue;
```

### cancelOwnershipRescue

Cancel a pending ownership rescue.


```solidity
function cancelOwnershipRescue() external onlyOwner;
```

### finalizeOwnershipRescue

Finalize a pending ownership rescue after the timelock.


```solidity
function finalizeOwnershipRescue() external onlyProtocolRescue;
```

### setPerformanceFee


```solidity
function setPerformanceFee(uint16 _performanceFee) external onlyManagement;
```

### setPerformanceFeeRecipient


```solidity
function setPerformanceFeeRecipient(address _performanceFeeRecipient) external onlyManagement;
```

### setProfitMaxUnlockTime


```solidity
function setProfitMaxUnlockTime(uint256 _profitMaxUnlockTime) external onlyManagement;
```

### setPendingManagement


```solidity
function setPendingManagement(address _management) external onlyManagement;
```

### acceptManagement


```solidity
function acceptManagement() external;
```

### setDeploymentParams


```solidity
function setDeploymentParams(uint256 _threshold, uint256 _interval) external onlyOwner;
```

### setMaxTotalSupply


```solidity
function setMaxTotalSupply(uint256 _maxTotalSupply) external onlyOwner;
```

### setFlashLoanProtection

Configure flash loan protection parameters

MEV/flash loan exploit mitigation


```solidity
function setFlashLoanProtection(
    uint256 _withdrawDelayBlocks,
    uint256 _largeWithdrawalThreshold,
    uint256 _largeWithdrawalDelayBlocks
) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_withdrawDelayBlocks`|`uint256`|Blocks to wait after deposit before withdraw allowed|
|`_largeWithdrawalThreshold`|`uint256`|Assets above which queue is required|
|`_largeWithdrawalDelayBlocks`|`uint256`|Extra blocks for large withdrawal queue|


### setTrustedPpsDeviationBps

Configure the trusted PPS circuit-breaker for deposit/mint.

Deposits/mints are blocked when live PPS deviates too far from `trustedPpsCheckpoint`.


```solidity
function setTrustedPpsDeviationBps(uint256) external onlyOwner;
```

### syncBalances


```solidity
function syncBalances() external onlyManagement;
```

### rescueETH


```solidity
function rescueETH() external onlyOwner;
```

### rescueToken


```solidity
function rescueToken(address token, uint256 amount, address to) external onlyOwner;
```

### _update

Track the latest share acquisition block for delay enforcement.
- Mint: receiver gets current block.
- Transfer: does NOT update cooldown state (prevents griefing via dust transfers).
- Burn: no update needed.


```solidity
function _update(address from, address to, uint256 value) internal override;
```

### pricePerShare

Get price per share (1e18 scale)


```solidity
function pricePerShare() public view returns (uint256);
```

### decimals


```solidity
function decimals() public pure override returns (uint8);
```

### _decimalsOffset

Decimals offset for virtual shares (inflation attack protection)

OpenZeppelin ERC4626 uses this to add "virtual" shares/assets
An offset of 3 means 10^3 = 1000 virtual shares exist
This makes the first-depositor inflation attack economically infeasible

**Note:**
security: CRITICAL for yTUSD-style attack prevention
With offset of 3:
- Attacker needs to donate 1000 tokens per 1 token stolen
- Makes dust-balance manipulation unprofitable
Reference: https://blog.openzeppelin.com/a-novel-defense-against-erc4626-inflation-attacks


```solidity
function _decimalsOffset() internal pure override returns (uint8);
```

## Events
### Reported

```solidity
event Reported(uint256 profit, uint256 loss, uint256 performanceFees, uint256 totalAssets);
```

### StrategyAdded

```solidity
event StrategyAdded(address indexed strategy, uint256 weight);
```

### StrategyRemoved

```solidity
event StrategyRemoved(address indexed strategy);
```

### StrategyDeployed

```solidity
event StrategyDeployed(address indexed strategy, uint256 amount);
```

### StrategyWithdrawn

```solidity
event StrategyWithdrawn(address indexed strategy, uint256 amount);
```

### StrategyWithdrawFailed

```solidity
event StrategyWithdrawFailed(address indexed strategy, uint256 amount, bytes revertData);
```

### UpdateManagement

```solidity
event UpdateManagement(address indexed newManagement);
```

### UpdatePendingManagement

```solidity
event UpdatePendingManagement(address indexed newPendingManagement);
```

### UpdateKeeper

```solidity
event UpdateKeeper(address indexed newKeeper);
```

### UpdateEmergencyAdmin

```solidity
event UpdateEmergencyAdmin(address indexed newEmergencyAdmin);
```

### UpdateGaugeController

```solidity
event UpdateGaugeController(address indexed oldController, address indexed newController);
```

### UpdatePerformanceFee

```solidity
event UpdatePerformanceFee(uint16 newPerformanceFee);
```

### UpdatePerformanceFeeRecipient

```solidity
event UpdatePerformanceFeeRecipient(address indexed newRecipient);
```

### UpdateProfitMaxUnlockTime

```solidity
event UpdateProfitMaxUnlockTime(uint256 newProfitMaxUnlockTime);
```

### UpdateTrustedPpsDeviationBps

```solidity
event UpdateTrustedPpsDeviationBps(uint256 newTrustedPpsDeviationBps);
```

### BalancesSynced

```solidity
event BalancesSynced(uint256 coinBalance);
```

### WhitelistEnabled

```solidity
event WhitelistEnabled(bool enabled);
```

### WhitelistUpdated

```solidity
event WhitelistUpdated(address indexed account, bool status);
```

### EmergencyPause

```solidity
event EmergencyPause(bool paused);
```

### VaultShutdown

```solidity
event VaultShutdown();
```

### CapitalInjected

```solidity
event CapitalInjected(address indexed from, uint256 amount, uint256 newPricePerShare);
```

### SharesBurnedForPrice

```solidity
event SharesBurnedForPrice(address indexed from, uint256 shares, uint256 newPricePerShare);
```

### EmergencyWithdraw

```solidity
event EmergencyWithdraw(address indexed to, uint256 amount);
```

### WithdrawalQueued

```solidity
event WithdrawalQueued(address indexed user, uint256 shares, uint256 unlockBlock);
```

### WithdrawalClaimed

```solidity
event WithdrawalClaimed(address indexed user, uint256 assets);
```

### WithdrawalCancelled

```solidity
event WithdrawalCancelled(address indexed user, uint256 shares);
```

### UpdateDefaultQueue

```solidity
event UpdateDefaultQueue(address[] newDefaultQueue);
```

### UpdateUseDefaultQueue

```solidity
event UpdateUseDefaultQueue(bool useDefaultQueue);
```

### UpdateAutoAllocate

```solidity
event UpdateAutoAllocate(bool autoAllocate);
```

### UpdateMinimumTotalIdle

```solidity
event UpdateMinimumTotalIdle(uint256 minimumTotalIdle);
```

### UpdateDebtPurchaser

```solidity
event UpdateDebtPurchaser(address indexed newDebtPurchaser);
```

### DebtUpdated

```solidity
event DebtUpdated(address indexed strategy, uint256 currentDebt, uint256 newDebt);
```

### DebtPurchased

```solidity
event DebtPurchased(address indexed strategy, uint256 amount, address indexed buyer);
```

### UnrealisedLossAssessed

```solidity
event UnrealisedLossAssessed(address indexed strategy, uint256 lossAmount);
```

### AutoAllocated

```solidity
event AutoAllocated(address indexed strategy, uint256 amount);
```

### OperatorPermsSet

```solidity
event OperatorPermsSet(uint256 indexed epoch, address indexed exec, uint256 perms);
```

### OperatorPermitted

```solidity
event OperatorPermitted(
    uint256 indexed epoch, address indexed exec, uint256 perms, uint256 nonce, uint256 deadline
);
```

### OperatorEpochBumped

```solidity
event OperatorEpochBumped(uint256 newEpoch);
```

### RescueConfigured

```solidity
event RescueConfigured(address indexed rescue, uint64 delay);
```

### RescueDisabled

```solidity
event RescueDisabled();
```

### RescueInitiated

```solidity
event RescueInitiated(address indexed oldOwner, address indexed pendingOwner, uint64 unlockTime);
```

### RescueCancelled

```solidity
event RescueCancelled(address indexed owner);
```

### RescueFinalized

```solidity
event RescueFinalized(address indexed oldOwner, address indexed newOwner);
```

### ModulesSet

```solidity
event ModulesSet(address indexed coreModule, address indexed strategiesModule, address indexed adminModule);
```

## Errors
### ZeroAddress

```solidity
error ZeroAddress();
```

### ZeroAmount

```solidity
error ZeroAmount();
```

### ZeroShares

```solidity
error ZeroShares();
```

### Unauthorized

```solidity
error Unauthorized();
```

### Paused

```solidity
error Paused();
```

### InvalidAmount

```solidity
error InvalidAmount();
```

### InsufficientBalance

```solidity
error InsufficientBalance();
```

### StrategyAlreadyActive

```solidity
error StrategyAlreadyActive();
```

### StrategyNotActive

```solidity
error StrategyNotActive();
```

### MaxStrategiesReached

```solidity
error MaxStrategiesReached();
```

### InvalidWeight

```solidity
error InvalidWeight();
```

### VaultIsShutdown

```solidity
error VaultIsShutdown();
```

### VaultNotShutdown

```solidity
error VaultNotShutdown();
```

### OnlyGaugeController

```solidity
error OnlyGaugeController();
```

### FirstDepositTooSmall
First deposit must meet minimum threshold


```solidity
error FirstDepositTooSmall(uint256 provided, uint256 minimum);
```

### PriceChangeExceedsLimit
Price change exceeds safety bounds


```solidity
error PriceChangeExceedsLimit(uint256 priceBefore, uint256 priceAfter, uint256 maxChangeBps);
```

### TrustedPpsDeviationExceeded

```solidity
error TrustedPpsDeviationExceeded(uint256 checkpointPps, uint256 currentPps, uint256 maxDeviationBps);
```

### InflationAttackDetected
Mint would result in too many shares for assets (inflation protection)


```solidity
error InflationAttackDetected(uint256 assets, uint256 shares);
```

### WithdrawTooSoon
Flash loan protection - must wait before withdrawing


```solidity
error WithdrawTooSoon(uint256 currentBlock, uint256 requiredBlock);
```

### TransferTooSoon
Flash loan protection - must wait before transferring freshly minted shares


```solidity
error TransferTooSoon(uint256 currentBlock, uint256 requiredBlock);
```

### LargeWithdrawalMustBeQueued
Large withdrawal must be queued


```solidity
error LargeWithdrawalMustBeQueued(uint256 amount, uint256 threshold);
```

### WithdrawalNotUnlocked
Withdrawal not yet unlocked


```solidity
error WithdrawalNotUnlocked(uint256 currentBlock, uint256 unlockBlock);
```

### NoQueuedWithdrawal
No queued withdrawal


```solidity
error NoQueuedWithdrawal();
```

### QueuedWithdrawalReceiverMismatch

```solidity
error QueuedWithdrawalReceiverMismatch(address existing, address provided);
```

### StrategyHasUnrealisedLosses

```solidity
error StrategyHasUnrealisedLosses(address strategy, uint256 lossAmount);
```

### StrategyValuationNotReady
Strategy explicitly reports valuation inputs are unhealthy (oracle stale/unavailable).


```solidity
error StrategyValuationNotReady(address strategy);
```

### InsufficientIdleForWithdrawal

```solidity
error InsufficientIdleForWithdrawal(uint256 requested, uint256 available);
```

### QueueTooLong

```solidity
error QueueTooLong(uint256 length, uint256 maxLength);
```

### StrategyNotInQueue

```solidity
error StrategyNotInQueue(address strategy);
```

### NothingToBuy

```solidity
error NothingToBuy();
```

### OnlyDebtPurchaser

```solidity
error OnlyDebtPurchaser();
```

### OperatorPermitExpired

```solidity
error OperatorPermitExpired(uint256 deadline);
```

### InvalidOperatorSignature

```solidity
error InvalidOperatorSignature();
```

### RescueNotConfigured

```solidity
error RescueNotConfigured();
```

### RescueDelayOutOfBounds

```solidity
error RescueDelayOutOfBounds(uint64 provided, uint64 min, uint64 max);
```

### RescueAlreadyPending

```solidity
error RescueAlreadyPending(address pendingOwner);
```

### RescueNotPending

```solidity
error RescueNotPending();
```

### RescueTooEarly

```solidity
error RescueTooEarly(uint64 unlockTime);
```

### InvalidRescueOwner

```solidity
error InvalidRescueOwner(address newOwner);
```

### StrategyAssetMismatch

```solidity
error StrategyAssetMismatch(address expected, address actual);
```

### NoStrategies

```solidity
error NoStrategies();
```

### MaxTotalSupplyBelowCurrent

```solidity
error MaxTotalSupplyBelowCurrent(uint256 provided, uint256 current);
```

### TooManyBlocks

```solidity
error TooManyBlocks(uint256 provided, uint256 max);
```

### CannotRescueCreatorCoin

```solidity
error CannotRescueCreatorCoin();
```

### TransferAmountMismatch
Creator coin transfer did not move the expected amount (fee-on-transfer / rebasing / deflationary not supported).


```solidity
error TransferAmountMismatch(uint256 expected, uint256 actual);
```

### ETHTransferFailed

```solidity
error ETHTransferFailed();
```

### ModulesNotSet

```solidity
error ModulesNotSet();
```

### ModulesAlreadySet

```solidity
error ModulesAlreadySet();
```

### InvalidModuleAddress

```solidity
error InvalidModuleAddress();
```

## Structs
### QueuedWithdrawal
Queued large withdrawals


```solidity
struct QueuedWithdrawal {
    uint256 shares;
    uint256 unlockBlock;
    address receiver;
}
```

