# CreatorLotteryManagerAdminModule
[Git Source](https://github.com/wenakita/4626/blob/2951e17122326ff4a23b28e80356c44121ebf59c/contracts/utilities/lottery/CreatorLotteryManager.sol)

**Inherits:**
OApp, OAppOptionsType3, ReentrancyGuard, Pausable


## Constants
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


### MSG_TYPE_WINNER_CALLBACK

```solidity
uint16 public constant MSG_TYPE_WINNER_CALLBACK = 4
```


### DEFAULT_MSG_VALUE

```solidity
uint128 internal constant DEFAULT_MSG_VALUE = 0
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


### registry

```solidity
ICreatorRegistryLottery public immutable registry
```


### _self

```solidity
address private immutable _self
```


### BOOST_SOURCE_TIMELOCK
Mirror of main-contract `BOOST_SOURCE_TIMELOCK`.


```solidity
uint256 public constant BOOST_SOURCE_TIMELOCK = 24 hours
```


## State Variables
### authorizedSwapContracts

```solidity
mapping(address => bool) public authorizedSwapContracts
```


### localVRFConsumer

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

```solidity
Ive4626BoostManager public boostManager
```


### vaultGaugeVoting

```solidity
IVaultGaugeVoting public vaultGaugeVoting
```


### lotteryConfig

```solidity
LotteryConfig public lotteryConfig
```


### oracleMaxStaleness

```solidity
uint256 public oracleMaxStaleness
```


### vrfResultGracePeriod

```solidity
uint256 public vrfResultGracePeriod
```


### oracleMaxDeviationBps

```solidity
uint256 public oracleMaxDeviationBps
```


### oracleDeviationWindow

```solidity
uint256 public oracleDeviationWindow
```


### lastAcceptedPriceUSD1e18

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

```solidity
mapping(uint256 => uint256) public pendingRandomWord
```


### hasPendingRandomWord

```solidity
mapping(uint256 => bool) public hasPendingRandomWord
```


### vrfSponsorshipPolicy

```solidity
SponsorshipPolicy public vrfSponsorshipPolicy
```


### callbackSponsorshipPolicy

```solidity
SponsorshipPolicy public callbackSponsorshipPolicy
```


### sponsoredVrfMinSwapAmountUSD

```solidity
uint256 public sponsoredVrfMinSwapAmountUSD
```


### vrfMaxSponsoredPerBuyerPerEpoch

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

```solidity
mapping(uint32 => mapping(bytes32 => bool)) public authorizedRemoteOFTs
```


### callbackGasLimit

```solidity
uint128 public callbackGasLimit
```


### totalRemoteLotteryEntries

```solidity
uint256 public totalRemoteLotteryEntries
```


### totalLotteryEntries

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


### baseCeilingPPM
Pre-boost win-chance ceiling (PPM). Default 40_000 = 4%.


```solidity
uint256 public baseCeilingPPM
```


### authorizedAmoeRelayer
Trusted relayer authorized to call `processAmoeEntry`.


```solidity
address public authorizedAmoeRelayer
```


### _pendingBoostManager
Pending replacement for `boostManager`. Public view via `getPendingBoostSources()`.


```solidity
address internal _pendingBoostManager
```


### _pendingBoostManagerEffectiveAt

```solidity
uint256 internal _pendingBoostManagerEffectiveAt
```


### _pendingVaultGaugeVoting

```solidity
address internal _pendingVaultGaugeVoting
```


### _pendingVaultGaugeVotingEffectiveAt

```solidity
uint256 internal _pendingVaultGaugeVotingEffectiveAt
```


### _timelockArmed
Once true, legacy single-call setters revert. Read via `isTimelockArmed()`.


```solidity
bool internal _timelockArmed
```


## Functions
### constructor


```solidity
constructor(address _registry, address owner_)
    OApp(ICreatorRegistryLottery(_registry).getLayerZeroEndpoint(block.chainid), owner_)
    Ownable(owner_);
```

### onlyDelegateCall


```solidity
modifier onlyDelegateCall() ;
```

### setAuthorizedSwapContract


```solidity
function setAuthorizedSwapContract(address swapContract, bool authorized) external onlyDelegateCall onlyOwner;
```

### setLocalVRFConsumer


```solidity
function setLocalVRFConsumer(address _consumer) external onlyDelegateCall onlyOwner;
```

### setVRFIntegrator


```solidity
function setVRFIntegrator(address _integrator) external onlyDelegateCall onlyOwner;
```

### setTargetEid


```solidity
function setTargetEid(uint32 _eid) external onlyDelegateCall onlyOwner;
```

### setUseLocalVRF


```solidity
function setUseLocalVRF(bool _useLocal) external onlyDelegateCall onlyOwner;
```

### setSponsoredVrfMinSwapAmountUSD


```solidity
function setSponsoredVrfMinSwapAmountUSD(uint256 _minSwapAmountUSD) external onlyDelegateCall onlyOwner;
```

### setVrfSponsorshipPolicy


```solidity
function setVrfSponsorshipPolicy(
    bool enabled,
    uint256 maxFeePerMessage,
    uint256 budgetPerEpoch,
    uint256 epochDuration
) external onlyDelegateCall onlyOwner;
```

### setCallbackSponsorshipPolicy


```solidity
function setCallbackSponsorshipPolicy(
    bool enabled,
    uint256 maxFeePerMessage,
    uint256 budgetPerEpoch,
    uint256 epochDuration
) external onlyDelegateCall onlyOwner;
```

### setSponsorshipRateLimits


```solidity
function setSponsorshipRateLimits(
    uint32 _vrfMaxPerBuyerPerEpoch,
    uint32 _vrfMaxPerOriginPerEpoch,
    uint32 _callbackMaxPerBuyerPerEpoch,
    uint32 _callbackMaxPerOriginPerEpoch
) external onlyDelegateCall onlyOwner;
```

### setBoostManager

Legacy single-call setter for `boostManager`.

Disabled once `armBoostSourceTimelock()` has been called. Until
then, this preserves the original ops bootstrap path so initial
deploys can wire up the boost source without going through the
24h timelock dance. Once armed, callers must use
`proposeBoostManager` + `commitBoostManager`.


```solidity
function setBoostManager(address _manager) external onlyDelegateCall onlyOwner;
```

### setVaultGaugeVoting

Legacy single-call setter for `vaultGaugeVoting`.

Disabled once `armBoostSourceTimelock()` has been called.


```solidity
function setVaultGaugeVoting(address _vaultGaugeVoting) external onlyDelegateCall onlyOwner;
```

### armBoostSourceTimelock

Engage the boost-source timelock. One-way switch.

After this is called, `setBoostManager` / `setVaultGaugeVoting`
revert with `LegacySetterDisabled` and the only path forward is
`proposeBoostManager` + (24h delay) + `commitBoostManager`
(and the symmetric pair for `vaultGaugeVoting`). The emergency
`disableBoostSources()` circuit breaker remains available with no
timelock.


```solidity
function armBoostSourceTimelock() external onlyDelegateCall onlyOwner;
```

### proposeBoostManager

Propose a new `boostManager`. Effective after `BOOST_SOURCE_TIMELOCK`
has elapsed, via `commitBoostManager()`. Owner can cancel during
the window via `cancelBoostManagerProposal()`.

Requires `timelockArmed`. Pass `address(0)` to propose disabling the
personal boost source entirely (still subject to the same delay).


```solidity
function proposeBoostManager(address _manager) external onlyDelegateCall onlyOwner;
```

### commitBoostManager

Commit a previously proposed `boostManager` once the timelock has elapsed.


```solidity
function commitBoostManager() external onlyDelegateCall onlyOwner;
```

### proposeVaultGaugeVoting

Propose a new `vaultGaugeVoting`. Symmetric to `proposeBoostManager`.


```solidity
function proposeVaultGaugeVoting(address _gauge) external onlyDelegateCall onlyOwner;
```

### commitVaultGaugeVoting

Commit a previously proposed `vaultGaugeVoting` once the timelock has elapsed.


```solidity
function commitVaultGaugeVoting() external onlyDelegateCall onlyOwner;
```

### cancelBoostManagerProposal

Cancel an in-flight `boostManager` proposal during the timelock window.


```solidity
function cancelBoostManagerProposal() external onlyDelegateCall onlyOwner;
```

### cancelVaultGaugeVotingProposal

Cancel an in-flight `vaultGaugeVoting` proposal during the timelock window.


```solidity
function cancelVaultGaugeVotingProposal() external onlyDelegateCall onlyOwner;
```

### disableBoostSources

Emergency circuit breaker: zero out both boost sources atomically,
no timelock. Use during incident response when a malicious
proposal has already been committed and the next safe state is
"no boost at all".

Also clears any in-flight pending proposals so a queued malicious
address can't be committed after the breaker is pulled.


```solidity
function disableBoostSources() external onlyDelegateCall onlyOwner;
```

### getBoostSourceTimelockState

Read the entire boost-source timelock state in one call.


```solidity
function getBoostSourceTimelockState()
    external
    view
    returns (
        address pendingBoostMgr,
        uint256 boostMgrEffectiveAt,
        address pendingGauge,
        uint256 gaugeEffectiveAt,
        bool armed
    );
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`pendingBoostMgr`|`address`|The pending replacement for `boostManager`, or address(0).|
|`boostMgrEffectiveAt`|`uint256`|Timestamp at which `commitBoostManager` may run, or 0 if no proposal.|
|`pendingGauge`|`address`|The pending replacement for `vaultGaugeVoting`, or address(0).|
|`gaugeEffectiveAt`|`uint256`|Timestamp at which `commitVaultGaugeVoting` may run, or 0 if no proposal.|
|`armed`|`bool`|Whether the timelock has been armed (legacy setters disabled).|


### setAuthorizedAmoeRelayer

Set the trusted off-chain relayer for AMOE entries.

Single-address allowlist. Pass address(0) to disable AMOE entirely.


```solidity
function setAuthorizedAmoeRelayer(address _relayer) external onlyDelegateCall onlyOwner;
```

### setBaseCeilingPPM

Set the pre-boost win-chance ceiling (PPM).

Bounded by `lotteryConfig.maxWinChance` (so a misconfigured ceiling
cannot widen the absolute cap) and by 100_000 PPM (10%) as a hard
sanity ceiling on the *unboosted* chance — if you ever need more,
raise this constant deliberately in a future audit.


```solidity
function setBaseCeilingPPM(uint256 _ceilingPPM) external onlyDelegateCall onlyOwner;
```

### setLotteryConfig


```solidity
function setLotteryConfig(
    uint256 _minSwap,
    uint256 _rewardPercentage,
    bool _isActive,
    uint256 _baseWinChance,
    uint256 _maxWinChance,
    uint256 _usdMultiplierBps
) external onlyDelegateCall onlyOwner;
```

### setOracleMaxStaleness


```solidity
function setOracleMaxStaleness(uint256 _maxStaleness) external onlyDelegateCall onlyOwner;
```

### setVrfResultGracePeriod


```solidity
function setVrfResultGracePeriod(uint256 _gracePeriod) external onlyDelegateCall onlyOwner;
```

### setOracleDeviationGuard


```solidity
function setOracleDeviationGuard(uint256 _maxDeviationBps, uint256 _deviationWindow)
    external
    onlyDelegateCall
    onlyOwner;
```

### setCallbackOptions


```solidity
function setCallbackOptions(uint32 dstEid, uint128 gasLimit, uint128 msgValue) external onlyDelegateCall onlyOwner;
```

### setAuthorizedRemoteOFT


```solidity
function setAuthorizedRemoteOFT(uint32 srcEid, bytes32 sender, bool authorized)
    external
    onlyDelegateCall
    onlyOwner;
```

### batchSetAuthorizedRemoteOFTs


```solidity
function batchSetAuthorizedRemoteOFTs(uint32[] calldata srcEids, bytes32[] calldata senders, bool authorized)
    external
    onlyDelegateCall
    onlyOwner;
```

### setCallbackGasLimit


```solidity
function setCallbackGasLimit(uint128 _gasLimit) external onlyDelegateCall onlyOwner;
```

### pause


```solidity
function pause() external onlyDelegateCall onlyOwner;
```

### unpause


```solidity
function unpause() external onlyDelegateCall onlyOwner;
```

### emergencyWithdraw


```solidity
function emergencyWithdraw(address token, uint256 amount) external onlyDelegateCall onlyOwner whenPaused;
```

### _refreshSponsorshipEpoch


```solidity
function _refreshSponsorshipEpoch(SponsorshipPolicy storage policy) internal;
```

### _lzReceive


```solidity
function _lzReceive(Origin calldata, bytes32, bytes calldata, address, bytes calldata) internal pure override;
```

## Events
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

### AuthorizedAmoeRelayerUpdated

```solidity
event AuthorizedAmoeRelayerUpdated(address indexed previousRelayer, address indexed newRelayer);
```

### BaseCeilingPPMUpdated

```solidity
event BaseCeilingPPMUpdated(uint256 previousCeilingPPM, uint256 newCeilingPPM);
```

### BoostManagerProposed

```solidity
event BoostManagerProposed(address indexed previous, address indexed proposed, uint256 effectiveAt);
```

### BoostManagerProposalCancelled

```solidity
event BoostManagerProposalCancelled(address indexed cancelled);
```

### BoostManagerUpdated

```solidity
event BoostManagerUpdated(address indexed previous, address indexed newManager);
```

### VaultGaugeVotingProposed

```solidity
event VaultGaugeVotingProposed(address indexed previous, address indexed proposed, uint256 effectiveAt);
```

### VaultGaugeVotingProposalCancelled

```solidity
event VaultGaugeVotingProposalCancelled(address indexed cancelled);
```

### VaultGaugeVotingUpdated

```solidity
event VaultGaugeVotingUpdated(address indexed previous, address indexed newGauge);
```

### BoostSourceTimelockArmed

```solidity
event BoostSourceTimelockArmed();
```

### BoostSourcesDisabled

```solidity
event BoostSourcesDisabled(address indexed previousBoostManager, address indexed previousVaultGaugeVoting);
```

## Errors
### ZeroAddress

```solidity
error ZeroAddress();
```

### InvalidAmount

```solidity
error InvalidAmount();
```

### OnlyDelegateCall

```solidity
error OnlyDelegateCall();
```

### TimelockNotArmed

```solidity
error TimelockNotArmed();
```

### TimelockAlreadyArmed

```solidity
error TimelockAlreadyArmed();
```

### TimelockNotExpired

```solidity
error TimelockNotExpired();
```

### NoPendingProposal

```solidity
error NoPendingProposal();
```

### LegacySetterDisabled

```solidity
error LegacySetterDisabled();
```

## Structs
### LotteryConfig

```solidity
struct LotteryConfig {
    uint256 minSwapAmount;
    uint256 rewardPercentage;
    bool isActive;
    uint256 baseWinChance;
    uint256 maxWinChance;
    uint256 usdMultiplierBps;
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
    address creatorCoin;
    uint256 amountUSD;
    uint256 effectiveWinChancePPM;
    VRFType vrfType;
    uint32 sourceChainEid;
    uint256 requestTimestamp;
}
```

### CreatorStats

```solidity
struct CreatorStats {
    uint256 entries;
    uint256 winners;
    uint256 rewardsPaid;
}
```

## Enums
### VRFType

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

