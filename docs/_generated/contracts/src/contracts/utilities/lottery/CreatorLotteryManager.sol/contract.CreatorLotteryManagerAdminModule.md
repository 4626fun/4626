# CreatorLotteryManagerAdminModule
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


### _self

```solidity
address private immutable _self
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


```solidity
function setBoostManager(address _manager) external onlyDelegateCall onlyOwner;
```

### setVaultGaugeVoting


```solidity
function setVaultGaugeVoting(address _vaultGaugeVoting) external onlyDelegateCall onlyOwner;
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

