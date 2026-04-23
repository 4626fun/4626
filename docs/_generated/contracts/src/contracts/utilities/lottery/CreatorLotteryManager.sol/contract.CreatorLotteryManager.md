# CreatorLotteryManager
[Git Source](https://github.com/wenakita/4626/blob/main/contracts/utilities/lottery/CreatorLotteryManager.sol)

**Inherits:**
OApp, OAppOptionsType3, ReentrancyGuard, Pausable


## State Variables
### MIN_SWAP_USD

```solidity
uint256 public constant MIN_SWAP_USD = 1_000_000
```


### MAX_SWAP_USD

```solidity
uint256 public constant MAX_SWAP_USD = 1_000_000_000_000
```


### BASIS_POINTS

```solidity
uint256 public constant BASIS_POINTS = 10_000
```


### MAX_JACKPOT_PAYOUT_ITERATIONS
Hard cap on the number of *active* creator coins evaluated in
a single jackpot payout. Caps the gas cost of
_payoutLocalJackpotInner() so the function cannot be bricked by a
growing registry (M-06 / 4626-315). Remainder active coins roll to
the next jackpot via the payout cursor.


```solidity
uint256 public constant MAX_JACKPOT_PAYOUT_ITERATIONS = 128
```


### MAX_JACKPOT_PAYOUT_SLOT_SCANS
Hard cap on the number of registry slots scanned in a single
jackpot payout, regardless of active/inactive status. Because
registeredTokens is append-only and inactive entries are never
removed, a long prefix of inactive coins would otherwise consume the
active cap without paying any active creator. The slot cap bounds the
worst-case all-inactive loop while the cursor carries progress into
the next call until an active creator is found. Set materially higher
than MAX_JACKPOT_PAYOUT_ITERATIONS so natural inactive density does
not starve active creators.


```solidity
uint256 public constant MAX_JACKPOT_PAYOUT_SLOT_SCANS = 1024
```


### MSG_TYPE_LOTTERY_ENTRY
Message types for hub-centric architecture


```solidity
uint16 public constant MSG_TYPE_LOTTERY_ENTRY = 3
```


### MSG_TYPE_WINNER_CALLBACK

```solidity
uint16 public constant MSG_TYPE_WINNER_CALLBACK = 4
```


### DEFAULT_GAS_LIMIT

```solidity
uint128 internal constant DEFAULT_GAS_LIMIT = 200_000
```


### DEFAULT_MSG_VALUE

```solidity
uint128 internal constant DEFAULT_MSG_VALUE = 0
```


### DEFAULT_CALLBACK_GAS_LIMIT

```solidity
uint128 internal constant DEFAULT_CALLBACK_GAS_LIMIT = 100_000
```


### DEFAULT_SPONSOR_EPOCH_DURATION

```solidity
uint256 internal constant DEFAULT_SPONSOR_EPOCH_DURATION = 1 hours
```


### DEFAULT_VRF_SPONSOR_MAX_FEE

```solidity
uint256 internal constant DEFAULT_VRF_SPONSOR_MAX_FEE = 0.01 ether
```


### DEFAULT_VRF_SPONSOR_BUDGET

```solidity
uint256 internal constant DEFAULT_VRF_SPONSOR_BUDGET = 0.25 ether
```


### DEFAULT_CALLBACK_SPONSOR_MAX_FEE

```solidity
uint256 internal constant DEFAULT_CALLBACK_SPONSOR_MAX_FEE = 0.01 ether
```


### DEFAULT_CALLBACK_SPONSOR_BUDGET

```solidity
uint256 internal constant DEFAULT_CALLBACK_SPONSOR_BUDGET = 0.1 ether
```


### VRF_REQUEST_CONTEXT

```solidity
bytes32 internal constant VRF_REQUEST_CONTEXT = 0xd84f4bdfe2e4cf43345263bca820ebe0fd153da9fd7f53871b6103ba604a4430
```


### WINNER_CALLBACK_CONTEXT

```solidity
bytes32 internal constant WINNER_CALLBACK_CONTEXT =
    0x197005c8271d0fbeff8e5770b1fa02e04e4ba94e019fc8ea71c55fd52eb21205
```


### DEFAULT_SPONSORED_VRF_MIN_SWAP_USD

```solidity
uint256 internal constant DEFAULT_SPONSORED_VRF_MIN_SWAP_USD = 10_000_000
```


### DEFAULT_VRF_MAX_SPONSORED_PER_BUYER_PER_EPOCH

```solidity
uint32 internal constant DEFAULT_VRF_MAX_SPONSORED_PER_BUYER_PER_EPOCH = 2
```


### DEFAULT_VRF_MAX_SPONSORED_PER_ORIGIN_PER_EPOCH

```solidity
uint32 internal constant DEFAULT_VRF_MAX_SPONSORED_PER_ORIGIN_PER_EPOCH = 10
```


### DEFAULT_CALLBACK_MAX_SPONSORED_PER_BUYER_PER_EPOCH

```solidity
uint32 internal constant DEFAULT_CALLBACK_MAX_SPONSORED_PER_BUYER_PER_EPOCH = 1
```


### DEFAULT_CALLBACK_MAX_SPONSORED_PER_ORIGIN_PER_EPOCH

```solidity
uint32 internal constant DEFAULT_CALLBACK_MAX_SPONSORED_PER_ORIGIN_PER_EPOCH = 10
```


### registry
Registry for looking up per-creator contracts


```solidity
ICreatorRegistryLottery public immutable registry
```


### authorizedSwapContracts
Authorized swap contracts that can trigger lottery


```solidity
mapping(address => bool) public authorizedSwapContracts
```


### localVRFConsumer
VRF providers (shared across all creators)


```solidity
ICreatorVRFConsumer public localVRFConsumer
```


### vrfIntegrator

```solidity
IChainlinkVRFIntegrator public vrfIntegrator
```


### targetEid

```solidity
uint32 public targetEid
```


### useLocalVRF

```solidity
bool public useLocalVRF
```


### trustedVrfIntegrators

```solidity
mapping(address => bool) public trustedVrfIntegrators
```


### boostManager
Boost manager for ve4626 lockers


```solidity
Ive4626BoostManager public boostManager
```


### vaultGaugeVoting
VaultGaugeVoting for ve(3,3) vault probability direction


```solidity
IVaultGaugeVoting public vaultGaugeVoting
```


### lotteryConfig

```solidity
LotteryConfig public lotteryConfig
```


### oracleMaxStaleness
Max acceptable oracle staleness (seconds).

Used as defense-in-depth; default preserves prior 2h hardcode.


```solidity
uint256 public oracleMaxStaleness = 2 hours
```


### vrfResultGracePeriod

```solidity
uint256 public vrfResultGracePeriod = 30 minutes
```


### oracleMaxDeviationBps
Circuit breaker: maximum allowed price deviation (bps) within `oracleDeviationWindow`.

If the reference is recent and the oracle price jumps beyond this, the entry is skipped (no VRF request).


```solidity
uint256 public oracleMaxDeviationBps = 2000
```


### oracleDeviationWindow

```solidity
uint256 public oracleDeviationWindow = 30 minutes
```


### lastAcceptedPriceUSD1e18
Per-creator reference price used for deviation checks (USD 1e18).


```solidity
mapping(address => uint256) public lastAcceptedPriceUSD1e18
```


### lastAcceptedPriceTimestamp

```solidity
mapping(address => uint256) public lastAcceptedPriceTimestamp
```


### vrfRequests

```solidity
mapping(uint256 => VRFRequest) public vrfRequests
```


### pendingRandomWord
Deferred VRF results while the contract is paused.

While paused, callbacks store randomness and do not settle wins/losses.


```solidity
mapping(uint256 => uint256) public pendingRandomWord
```


### hasPendingRandomWord

```solidity
mapping(uint256 => bool) public hasPendingRandomWord
```


### vrfSponsorshipPolicy
Funding policy for cross-chain VRF requests and winner callbacks.


```solidity
SponsorshipPolicy public vrfSponsorshipPolicy
```


### callbackSponsorshipPolicy

```solidity
SponsorshipPolicy public callbackSponsorshipPolicy
```


### sponsoredVrfMinSwapAmountUSD

```solidity
uint256 public sponsoredVrfMinSwapAmountUSD = DEFAULT_SPONSORED_VRF_MIN_SWAP_USD
```


### vrfMaxSponsoredPerBuyerPerEpoch
Sponsorship anti-spam rate limits (count-based per epoch). 0 = unlimited.


```solidity
uint32 public vrfMaxSponsoredPerBuyerPerEpoch
```


### vrfMaxSponsoredPerOriginPerEpoch

```solidity
uint32 public vrfMaxSponsoredPerOriginPerEpoch
```


### callbackMaxSponsoredPerBuyerPerEpoch

```solidity
uint32 public callbackMaxSponsoredPerBuyerPerEpoch
```


### callbackMaxSponsoredPerOriginPerEpoch

```solidity
uint32 public callbackMaxSponsoredPerOriginPerEpoch
```


### vrfSponsoredCountByBuyer

```solidity
mapping(address => uint32) public vrfSponsoredCountByBuyer
```


### vrfBuyerEpochStart

```solidity
mapping(address => uint256) public vrfBuyerEpochStart
```


### vrfSponsoredCountByOrigin

```solidity
mapping(bytes32 => uint32) public vrfSponsoredCountByOrigin
```


### vrfOriginEpochStart

```solidity
mapping(bytes32 => uint256) public vrfOriginEpochStart
```


### callbackSponsoredCountByBuyer

```solidity
mapping(address => uint32) public callbackSponsoredCountByBuyer
```


### callbackBuyerEpochStart

```solidity
mapping(address => uint256) public callbackBuyerEpochStart
```


### callbackSponsoredCountByOrigin

```solidity
mapping(bytes32 => uint32) public callbackSponsoredCountByOrigin
```


### callbackOriginEpochStart

```solidity
mapping(bytes32 => uint256) public callbackOriginEpochStart
```


### authorizedRemoteOFTs
Authorized remote OFT peers that can send lottery entries

Maps (srcEid, senderBytes32) → authorized


```solidity
mapping(uint32 => mapping(bytes32 => bool)) public authorizedRemoteOFTs
```


### callbackGasLimit
Gas limit for winner callback messages


```solidity
uint128 public callbackGasLimit = DEFAULT_CALLBACK_GAS_LIMIT
```


### totalRemoteLotteryEntries
Total remote lottery entries received


```solidity
uint256 public totalRemoteLotteryEntries
```


### totalLotteryEntries
Global statistics (vault share units)


```solidity
uint256 public totalLotteryEntries
```


### totalWinners

```solidity
uint256 public totalWinners
```


### totalRewardsPaid

```solidity
uint256 public totalRewardsPaid
```


### creatorStats

```solidity
mapping(address => CreatorStats) public creatorStats
```


### _payoutLock

```solidity
uint256 private _payoutLock
```


### _adminModule

```solidity
address private immutable _adminModule
```


### jackpotPayoutCursor
Cursor that advances through the creator-coin registry between
jackpot payouts so that when the registry is larger than
MAX_JACKPOT_PAYOUT_ITERATIONS, all coins eventually receive payouts
across successive jackpots rather than being starved behind the cap.
Incremented after each payout in _payoutLocalJackpotInner (M-06).


```solidity
uint256 public jackpotPayoutCursor
```


## Functions
### constructor

Deploy shared lottery manager


```solidity
constructor(address _registry, address owner_)
    OApp(ICreatorRegistryLottery(_registry).getLayerZeroEndpoint(block.chainid), owner_)
    Ownable(owner_);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_registry`|`address`|CreatorRegistry address|
|`owner_`|`address`|Owner address|


### onlyAuthorizedSwapContract


```solidity
modifier onlyAuthorizedSwapContract() ;
```

### processSwapLottery

Process swap-based lottery entry for ANY Creator Coin


```solidity
function processSwapLottery(address buyer, address tokenIn, uint256 amountIn, uint256 buyerCurrentShareBalance)
    external
    payable
    nonReentrant
    onlyAuthorizedSwapContract
    whenNotPaused
    returns (uint256 entryId);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`buyer`|`address`|User's wallet address (recipient of the swap) Supports EOAs, smart contract wallets (Coinbase Smart Wallet, Safe), and ERC-4337 accounts. Passed by the calling swap contract.|
|`tokenIn`|`address`|Token swapped (■TOKEN / ShareOFT)|
|`amountIn`|`uint256`|Amount swapped|
|`buyerCurrentShareBalance`|`uint256`||

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`entryId`|`uint256`|VRF request ID (0 if no entry)|


### _requestCrossChainVRF

Request cross-chain VRF (hub local call path, sourceChainEid = 0)


```solidity
function _requestCrossChainVRF(
    address creatorCoin,
    address buyer,
    uint256 swapValueUSD,
    uint256 winChancePPM,
    uint256 callerFeeValue
) internal returns (uint256);
```

### _requestLocalVRF

Request local VRF (hub local call path, sourceChainEid = 0)


```solidity
function _requestLocalVRF(address creatorCoin, address buyer, uint256 swapValueUSD, uint256 winChancePPM)
    internal
    returns (uint256);
```

### _localVrfKey


```solidity
function _localVrfKey(uint256 requestId) internal pure returns (uint256);
```

### _crossChainVrfKey


```solidity
function _crossChainVrfKey(uint256 sequence) internal pure returns (uint256);
```

### receiveRandomWords

Local VRF callback


```solidity
function receiveRandomWords(uint256 requestId, uint256[] memory randomWords) external nonReentrant;
```

### receiveRandomWords

Cross-chain VRF callback


```solidity
function receiveRandomWords(uint256[] memory randomWords, uint256 sequence) external nonReentrant;
```

### processPendingVrfResult

Process a deferred VRF result after unpausing.

While paused, callbacks store randomness and skip settlement to halt jackpot outflows.


```solidity
function processPendingVrfResult(uint256 requestId) external onlyOwner whenNotPaused nonReentrant;
```

### _processVRFResult


```solidity
function _processVRFResult(uint256 requestId, uint256[] memory randomWords) internal;
```

### _calculateTokenUSD

Calculate USD value of tokens using per-creator oracle


```solidity
function _calculateTokenUSD(address creatorCoin, address tokenIn, uint256 amount)
    internal
    view
    returns (uint256 usd1e6, uint256 priceUSD1e18, uint256 oracleTimestamp);
```

### calculateWinChance


```solidity
function calculateWinChance(uint256 swapAmountUSD) public view returns (uint256 winChancePPM);
```

### _applyBoost

Apply ve(3,3) boosts to base win probability

Personal ve4626 boosts stay coverage-scaled (full 2.5x only up to covered value).
Vault gauge boost is flat additive and applies full voted PPM to every trade.


```solidity
function _applyBoost(
    address user,
    address creatorCoin,
    address shareBalanceToken,
    uint256 creatorShareBalanceAmount,
    address vault,
    uint256 swapAmountUSD,
    uint256 baseWinChance
) internal view returns (uint256 boostedWinChance);
```

### _scaleGaugeBoostBySwapSize


```solidity
function _scaleGaugeBoostBySwapSize(uint256 gaugeBoostPPM, uint256 swapAmountUSD) internal view returns (uint256);
```

### _processWin

Process a lottery win (hub-only, all wins are paid on Base)


```solidity
function _processWin(
    address creatorCoin,
    address user,
    uint256 swapAmountUSD,
    uint256 requestId,
    uint32 sourceChainEid
) internal returns (uint256);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`creatorCoin`|`address`||
|`user`|`address`||
|`swapAmountUSD`|`uint256`||
|`requestId`|`uint256`||
|`sourceChainEid`|`uint32`|The EID of the chain where the trade originated (0 = local hub)|


### _lzReceive

Receive LayerZero messages (lottery entries from remote OFTs)

Only accepts MSG_TYPE_LOTTERY_ENTRY from authorized remote OFTs


```solidity
function _lzReceive(Origin calldata _origin, bytes32, bytes calldata _payload, address, bytes calldata)
    internal
    override;
```

### _handleLotteryEntry

Handle a lottery entry from a remote chain OFT
Legacy payload: (msgType, buyer, tokenIn, amount, sourceChainId)
V2 payload:     (msgType, buyer, tokenIn, amount, sourceChainId, buyerCurrentShareBalance)


```solidity
function _handleLotteryEntry(uint32 srcEid, bytes32 originSender, bytes calldata _payload) internal;
```

### _requestLocalVRFWithSource

Request local VRF with source chain tracking


```solidity
function _requestLocalVRFWithSource(
    address creatorCoin,
    address buyer,
    uint256 swapValueUSD,
    uint256 winChancePPM,
    uint32 sourceChainEid
) internal returns (uint256);
```

### _requestCrossChainVRFWithSource

Request cross-chain VRF with source chain tracking


```solidity
function _requestCrossChainVRFWithSource(
    address creatorCoin,
    address buyer,
    uint256 swapValueUSD,
    uint256 winChancePPM,
    uint32 sourceChainEid,
    bytes32 originSender,
    uint256 callerFeeValue
) internal returns (uint256);
```

### _sendWinnerCallback

Send winner callback to the source chain OFT
Payload: (msgType, winner, creatorCoin, totalSharesPaid)
Target: the remote CreatorShareOFT that sent the lottery entry


```solidity
function _sendWinnerCallback(uint32 dstEid, address winner, address creatorCoin, uint256 totalSharesPaid) internal;
```

### _payNative

Override LayerZero default behavior to support contract-sponsored messaging fees.


```solidity
function _payNative(uint256 _nativeFee) internal override returns (uint256 nativeFee);
```

### _refreshSponsorshipEpoch


```solidity
function _refreshSponsorshipEpoch(SponsorshipPolicy storage policy) internal;
```

### _consumeSponsorship


```solidity
function _consumeSponsorship(
    SponsorshipPolicy storage policy,
    bytes32 context,
    uint256 feeNative,
    uint256 valueHint,
    bool enforceMinSwap
) internal returns (bool);
```

### _rollbackSponsoredSpend


```solidity
function _rollbackSponsoredSpend(SponsorshipPolicy storage policy, uint256 feeNative) internal;
```

### _refundCallerFeeOrRevert


```solidity
function _refundCallerFeeOrRevert(uint256 amount) internal;
```

### _rateLimitOriginKey


```solidity
function _rateLimitOriginKey(uint32 eid, bytes32 sender) internal pure returns (bytes32);
```

### _syncSponsoredCountByBuyer


```solidity
function _syncSponsoredCountByBuyer(
    mapping(address => uint32) storage counts,
    mapping(address => uint256) storage epochStarts,
    address buyer,
    uint256 epochStart
) internal returns (uint32);
```

### _syncSponsoredCountByOrigin


```solidity
function _syncSponsoredCountByOrigin(
    mapping(bytes32 => uint32) storage counts,
    mapping(bytes32 => uint256) storage epochStarts,
    bytes32 originKey,
    uint256 epochStart
) internal returns (uint32);
```

### _buildOptions


```solidity
function _buildOptions(uint32 dstEid) internal view returns (bytes memory);
```

### _payoutLocalJackpot

Pay jackpot from ALL active creator vaults (multi-token prize!)


```solidity
function _payoutLocalJackpot(address triggeringCoin, address winner, uint16 payoutBps) internal returns (uint256);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`triggeringCoin`|`address`|The creator coin that triggered the lottery|
|`winner`|`address`|The lottery winner|
|`payoutBps`|`uint16`|Percentage of each vault's jackpot to pay (6900 = 69%)|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|totalPaidOut Total number of vaults that paid out|


### _payoutLocalJackpotInner


```solidity
function _payoutLocalJackpotInner(address triggeringCoin, address winner, uint16 payoutBps)
    internal
    returns (uint256 totalPaidOut);
```

### _delegateAdmin


```solidity
function _delegateAdmin() internal;
```

### setAuthorizedSwapContract


```solidity
function setAuthorizedSwapContract(address swapContract, bool authorized) external;
```

### setLocalVRFConsumer


```solidity
function setLocalVRFConsumer(address _consumer) external;
```

### setVRFIntegrator


```solidity
function setVRFIntegrator(address _integrator) external;
```

### setTargetEid


```solidity
function setTargetEid(uint32 _eid) external;
```

### setUseLocalVRF


```solidity
function setUseLocalVRF(bool _useLocal) external;
```

### setSponsoredVrfMinSwapAmountUSD


```solidity
function setSponsoredVrfMinSwapAmountUSD(uint256 _minSwapAmountUSD) external;
```

### setVrfSponsorshipPolicy


```solidity
function setVrfSponsorshipPolicy(
    bool enabled,
    uint256 maxFeePerMessage,
    uint256 budgetPerEpoch,
    uint256 epochDuration
) external;
```

### setCallbackSponsorshipPolicy


```solidity
function setCallbackSponsorshipPolicy(
    bool enabled,
    uint256 maxFeePerMessage,
    uint256 budgetPerEpoch,
    uint256 epochDuration
) external;
```

### setSponsorshipRateLimits

Configure sponsorship anti-spam rate limits (count-based per epoch).

A value of 0 means unlimited.


```solidity
function setSponsorshipRateLimits(
    uint32 _vrfMaxPerBuyerPerEpoch,
    uint32 _vrfMaxPerOriginPerEpoch,
    uint32 _callbackMaxPerBuyerPerEpoch,
    uint32 _callbackMaxPerOriginPerEpoch
) external;
```

### setBoostManager


```solidity
function setBoostManager(address _manager) external;
```

### setVaultGaugeVoting

Set VaultGaugeVoting for ve(3,3) probability direction


```solidity
function setVaultGaugeVoting(address _vaultGaugeVoting) external;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_vaultGaugeVoting`|`address`|Address of the VaultGaugeVoting contract|


### setLotteryConfig


```solidity
function setLotteryConfig(
    uint256 _minSwap,
    uint256 _rewardPercentage,
    bool _isActive,
    uint256 _baseWinChance,
    uint256 _maxWinChance,
    uint256 _usdMultiplierBps
) external;
```

### setOracleMaxStaleness


```solidity
function setOracleMaxStaleness(uint256 _maxStaleness) external;
```

### setVrfResultGracePeriod


```solidity
function setVrfResultGracePeriod(uint256 _gracePeriod) external;
```

### setOracleDeviationGuard


```solidity
function setOracleDeviationGuard(uint256 _maxDeviationBps, uint256 _deviationWindow) external;
```

### setCallbackOptions

Set enforced options for winner callback messages


```solidity
function setCallbackOptions(uint32 dstEid, uint128 gasLimit, uint128 msgValue) external;
```

### setAuthorizedRemoteOFT

Authorize a remote OFT as a valid lottery entry sender


```solidity
function setAuthorizedRemoteOFT(uint32 srcEid, bytes32 sender, bool authorized) external;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`srcEid`|`uint32`|The source chain EID|
|`sender`|`bytes32`|The bytes32-encoded address of the remote OFT|
|`authorized`|`bool`|Whether to authorize or deauthorize|


### batchSetAuthorizedRemoteOFTs

Batch authorize remote OFTs


```solidity
function batchSetAuthorizedRemoteOFTs(uint32[] calldata srcEids, bytes32[] calldata senders, bool authorized)
    external;
```

### setCallbackGasLimit

Set the gas limit for winner callback messages


```solidity
function setCallbackGasLimit(uint128 _gasLimit) external;
```

### pause


```solidity
function pause() external;
```

### unpause


```solidity
function unpause() external;
```

### getWinChance


```solidity
function getWinChance(uint256 swapAmountUSD) external view returns (uint256);
```

### getGlobalStats

Get global lottery stats


```solidity
function getGlobalStats() external view returns (uint256 entries, uint256 winners, uint256 rewards);
```

### getCreatorLotteryStats

Get lottery stats for a specific creator coin


```solidity
function getCreatorLotteryStats(address creatorCoin)
    external
    view
    returns (uint256 entries, uint256 winners, uint256 rewardsPaid, uint256 jackpotBalance);
```

### emergencyWithdraw


```solidity
function emergencyWithdraw(address token, uint256 amount) external;
```

### receive


```solidity
receive() external payable;
```

## Events
### LotteryEntryCreated

```solidity
event LotteryEntryCreated(
    address indexed creatorCoin,
    address indexed user,
    uint256 swapAmountUSD,
    uint256 winChancePPM,
    uint256 requestId
);
```

### LotteryWinner

```solidity
event LotteryWinner(
    address indexed creatorCoin,
    address indexed user,
    uint256 swapAmountUSD,
    uint256 rewardAmount,
    uint256 requestId
);
```

### LotteryResultProcessed

```solidity
event LotteryResultProcessed(
    address indexed creatorCoin,
    address indexed user,
    uint256 swapAmountUSD,
    bool won,
    uint256 rewardAmount,
    uint256 requestId
);
```

### SwapContractAuthorized

```solidity
event SwapContractAuthorized(address indexed swapContract, bool authorized);
```

### LotteryConfigUpdated

```solidity
event LotteryConfigUpdated(uint256 minSwap, uint256 rewardPercentage, bool isActive);
```

### OracleMaxStalenessUpdated

```solidity
event OracleMaxStalenessUpdated(uint256 maxStaleness);
```

### OracleDeviationGuardUpdated

```solidity
event OracleDeviationGuardUpdated(uint256 maxDeviationBps, uint256 deviationWindow);
```

### CrossChainJackpotPaid

```solidity
event CrossChainJackpotPaid(
    address indexed creatorCoin, address indexed winner, uint256 shares, uint256 tokenValue
);
```

### LotteryWon

```solidity
event LotteryWon(
    address indexed creatorCoin, uint256 indexed entryId, address indexed winner, uint256 shares, uint256 tokenValue
);
```

### MultiTokenJackpotWon

```solidity
event MultiTokenJackpotWon(address indexed triggeringCoin, address indexed winner, uint256 numVaultsPaid);
```

### JackpotPayoutFailed

```solidity
event JackpotPayoutFailed(address indexed creatorCoin, address indexed winner, uint256 shares);
```

### RemoteLotteryEntryReceived

```solidity
event RemoteLotteryEntryReceived(
    uint32 indexed srcEid, address indexed buyer, address indexed tokenIn, uint256 amount, uint32 sourceChainId
);
```

### WinnerCallbackSent

```solidity
event WinnerCallbackSent(
    uint32 indexed dstEid, address indexed winner, address indexed creatorCoin, uint256 totalSharesPaid
);
```

### RemoteOFTAuthorized

```solidity
event RemoteOFTAuthorized(uint32 indexed srcEid, bytes32 sender, bool authorized);
```

### CallbackGasLimitUpdated

```solidity
event CallbackGasLimitUpdated(uint128 newGasLimit);
```

### VRFConsumerUpdated

```solidity
event VRFConsumerUpdated(address indexed consumer);
```

### TargetEidUpdated

```solidity
event TargetEidUpdated(uint32 indexed targetEid);
```

### VRFIntegratorUpdated

```solidity
event VRFIntegratorUpdated(address indexed integrator, bool trusted);
```

### VrfResultDeferred

```solidity
event VrfResultDeferred(uint256 indexed requestId, uint256 randomWord);
```

### PendingVrfResultProcessed

```solidity
event PendingVrfResultProcessed(uint256 indexed requestId);
```

### SponsorshipPolicyUpdated

```solidity
event SponsorshipPolicyUpdated(
    bytes32 indexed context, bool enabled, uint256 maxFeePerMessage, uint256 budgetPerEpoch, uint256 epochDuration
);
```

### SponsorshipRateLimitsUpdated

```solidity
event SponsorshipRateLimitsUpdated(
    uint32 vrfMaxPerBuyerPerEpoch,
    uint32 vrfMaxPerOriginPerEpoch,
    uint32 callbackMaxPerBuyerPerEpoch,
    uint32 callbackMaxPerOriginPerEpoch
);
```

### SponsoredVrfMinSwapUpdated

```solidity
event SponsoredVrfMinSwapUpdated(uint256 minSwapAmountUSD);
```

### SponsorshipSpendRecorded

```solidity
event SponsorshipSpendRecorded(
    bytes32 indexed context, uint256 amount, uint256 spentInEpoch, uint256 budgetPerEpoch, uint256 epochStart
);
```

### SponsorshipSkipped

```solidity
event SponsorshipSkipped(
    bytes32 indexed context, SponsorshipSkipReason reason, uint256 feeNative, uint256 valueHint
);
```

### WinnerCallbackDropped

```solidity
event WinnerCallbackDropped(
    uint32 indexed dstEid,
    address indexed winner,
    address indexed creatorCoin,
    uint256 totalSharesPaid,
    uint8 reason
);
```

### InvalidPayloadReceived

```solidity
event InvalidPayloadReceived(uint32 indexed srcEid, uint256 payloadLength);
```

### StaleVRFResultDiscarded

```solidity
event StaleVRFResultDiscarded(uint256 indexed requestId, uint256 requestTimestamp, uint256 gracePeriod);
```

### JackpotPayoutCapped
Emitted when the per-call iteration cap truncated the payout.
Off-chain monitors can use this to reconcile that the remaining coins
will be reached on subsequent jackpots via the advancing cursor.


```solidity
event JackpotPayoutCapped(
    uint256 totalRegistrySize, uint256 startIndex, uint256 activeIterated, uint256 slotsScanned
);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`totalRegistrySize`|`uint256`|Full registry size at the time of the call.|
|`startIndex`|`uint256`|First registry index visited (pre-wrap).|
|`activeIterated`|`uint256`|Number of *active* creator coins actually evaluated.|
|`slotsScanned`|`uint256`|Number of registry slots scanned (active + inactive).|

## Errors
### ZeroAddress

```solidity
error ZeroAddress();
```

### Unauthorized

```solidity
error Unauthorized();
```

### InvalidAmount

```solidity
error InvalidAmount();
```

### CallerFeeMismatch

```solidity
error CallerFeeMismatch(uint256 provided, uint256 required);
```

### NoPendingVrfResult

```solidity
error NoPendingVrfResult(uint256 requestId);
```

### ETHRefundFailed

```solidity
error ETHRefundFailed();
```

## Structs
### LotteryConfig
Lottery configuration (shared across all creators)


```solidity
struct LotteryConfig {
    uint256 minSwapAmount;
    uint256 rewardPercentage; // bps of jackpot
    bool isActive;
    uint256 baseWinChance; // PPM (parts per million)
    uint256 maxWinChance; // PPM
    uint256 usdMultiplierBps; // Bonus for slippage (10500 = 1.05x)
}
```

### SponsorshipPolicy

```solidity
struct SponsorshipPolicy {
    bool enabled;
    uint256 maxFeePerMessage;
    uint256 budgetPerEpoch;
    uint256 epochDuration;
    uint256 epochStart;
    uint256 spentInEpoch;
}
```

### VRFRequest

```solidity
struct VRFRequest {
    address user;
    address creatorCoin; // Which creator coin this entry is for
    uint256 amountUSD;
    uint256 effectiveWinChancePPM;
    VRFType vrfType;
    uint32 sourceChainEid; // 0 = local (hub), non-zero = remote chain lottery entry
    // FIX: CLM-02 — track request creation time to reject stale VRF results
    uint256 requestTimestamp;
}
```

### CreatorStats
Per-creator statistics (vault share units)


```solidity
struct CreatorStats {
    uint256 entries;
    uint256 winners;
    uint256 rewardsPaid;
}
```

## Enums
### VRFType
VRF request tracking - includes creator coin and source chain


```solidity
enum VRFType {
    LOCAL,
    CROSS_CHAIN
}
```

### SponsorshipSkipReason

```solidity
enum SponsorshipSkipReason {
    DISABLED,
    BELOW_MIN_SWAP,
    FEE_ABOVE_CAP,
    BUDGET_EXCEEDED,
    INSUFFICIENT_BALANCE,
    SEND_FAILED,
    RATE_LIMITED
}
```

### CallbackDropReason

```solidity
enum CallbackDropReason {
    BUYER_RATE_LIMITED,
    ORIGIN_RATE_LIMITED,
    SPONSORSHIP_UNAVAILABLE
}
```

