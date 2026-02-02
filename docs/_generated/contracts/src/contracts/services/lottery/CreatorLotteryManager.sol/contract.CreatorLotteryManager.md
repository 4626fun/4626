# CreatorLotteryManager
[Git Source](https://github.com/creatorvault/4626/blob/2cd71abc97601febe38089cb23bfd133739e818d/contracts/services/lottery/CreatorLotteryManager.sol)

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


### BASE_CHAIN_ID

```solidity
uint256 public constant BASE_CHAIN_ID = 8453
```


### MSG_TYPE_WINNER_BROADCAST

```solidity
uint16 public constant MSG_TYPE_WINNER_BROADCAST = 1
```


### MSG_TYPE_WINNER_NOTIFY

```solidity
uint16 public constant MSG_TYPE_WINNER_NOTIFY = 2
```


### DEFAULT_GAS_LIMIT

```solidity
uint128 public constant DEFAULT_GAS_LIMIT = 200_000
```


### DEFAULT_MSG_VALUE

```solidity
uint128 public constant DEFAULT_MSG_VALUE = 0
```


### MAX_VE_BOOST
Maximum boost for ve4626 lockers (2.5x = 25000 bps)


```solidity
uint256 public constant MAX_VE_BOOST = 25000
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


### minVaultWeightBps
Minimum vault weight in bps (vaults with 0 votes get this minimum)


```solidity
uint256 public minVaultWeightBps = 100
```


### lotteryConfig

```solidity
LotteryConfig public lotteryConfig
```


### vrfRequests

```solidity
mapping(uint256 => VRFRequest) public vrfRequests
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


## Functions
### constructor

Deploy shared lottery manager


```solidity
constructor(address _registry, address owner_)
    OApp(ICreatorRegistryLottery(_registry).getLayerZeroEndpoint(uint16(block.chainid)), owner_)
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
function processSwapLottery(address buyer, address tokenIn, uint256 amountIn)
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
|`buyer`|`address`|User who made the swap (from tx.origin)|
|`tokenIn`|`address`|Token swapped (■TOKEN / ShareOFT)|
|`amountIn`|`uint256`|Amount swapped|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`entryId`|`uint256`|VRF request ID (0 if no entry)|


### _requestCrossChainVRF

Request cross-chain VRF


```solidity
function _requestCrossChainVRF(address creatorCoin, address buyer, uint256 swapValueUSD, uint256 winChancePPM)
    internal
    returns (uint256);
```

### _requestLocalVRF

Request local VRF


```solidity
function _requestLocalVRF(address creatorCoin, address buyer, uint256 swapValueUSD, uint256 winChancePPM)
    internal
    returns (uint256);
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
    returns (uint256 usd1e6);
```

### calculateWinChance


```solidity
function calculateWinChance(uint256 swapAmountUSD) public view returns (uint256 winChancePPM);
```

### _applyBoost

Apply ve(3,3) boosts to base win probability

ve(3,3) PROBABILITY MODEL (current implementation):
FinalPPM = BasePPM × PersonalBoost + LockDurationBoostPPM + VaultGaugeBoostPPM
Where:
- BasePPM: derived from swap size
- PersonalBoost: ve4626 (up to 2.5x)
- LockDurationBoostPPM: additional additive boost from lock duration
- VaultGaugeBoostPPM: additive boost allocated from a bounded weekly gauge budget


```solidity
function _applyBoost(address user, address vault, uint256 swapAmountUSD, uint256 baseWinChance)
    internal
    view
    returns (uint256 boostedWinChance);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`user`|`address`|The user who made the swap|
|`vault`|`address`|The vault where the swap occurred (for gauge allocation)|
|`swapAmountUSD`|`uint256`|Swap size in USD (1e6)|
|`baseWinChance`|`uint256`|Base win chance in PPM|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`boostedWinChance`|`uint256`|Final win chance after all boosts|


### _scaleGaugeBoostBySwapSize


```solidity
function _scaleGaugeBoostBySwapSize(uint256 gaugeBoostPPM, uint256 swapAmountUSD) internal view returns (uint256);
```

### _processWin


```solidity
function _processWin(address creatorCoin, address user, uint256 swapAmountUSD, uint256 requestId)
    internal
    returns (uint256);
```

### _notifyHubOfWinner


```solidity
function _notifyHubOfWinner(address creatorCoin, address winner, uint16 payoutBps) internal;
```

### _broadcastWinnerToRemoteChains


```solidity
function _broadcastWinnerToRemoteChains(address creatorCoin, address winner, uint16 payoutBps) internal;
```

### _buildOptions


```solidity
function _buildOptions(uint32 dstEid) internal view returns (bytes memory);
```

### _quoteBroadcast


```solidity
function _quoteBroadcast(uint32 dstEid, bytes memory payload, bytes memory options)
    external
    view
    returns (MessagingFee memory);
```

### _sendBroadcast


```solidity
function _sendBroadcast(uint32 dstEid, bytes memory payload, bytes memory options, MessagingFee memory fee)
    external
    payable;
```

### _lzReceive


```solidity
function _lzReceive(Origin calldata _origin, bytes32, bytes calldata _payload, address, bytes calldata)
    internal
    override;
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


### setAuthorizedSwapContract


```solidity
function setAuthorizedSwapContract(address swapContract, bool authorized) external onlyOwner;
```

### setLocalVRFConsumer


```solidity
function setLocalVRFConsumer(address _consumer) external onlyOwner;
```

### setVRFIntegrator


```solidity
function setVRFIntegrator(address _integrator) external onlyOwner;
```

### setTargetEid


```solidity
function setTargetEid(uint32 _eid) external onlyOwner;
```

### setUseLocalVRF


```solidity
function setUseLocalVRF(bool _useLocal) external onlyOwner;
```

### setBoostManager


```solidity
function setBoostManager(address _manager) external onlyOwner;
```

### setVaultGaugeVoting

Set VaultGaugeVoting for ve(3,3) probability direction


```solidity
function setVaultGaugeVoting(address _vaultGaugeVoting) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_vaultGaugeVoting`|`address`|Address of the VaultGaugeVoting contract|


### setMinVaultWeightBps

Set minimum vault weight in bps


```solidity
function setMinVaultWeightBps(uint256 _minWeightBps) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_minWeightBps`|`uint256`|Minimum weight (e.g., 100 = 1%)|


### setLotteryConfig


```solidity
function setLotteryConfig(
    uint256 _minSwap,
    uint256 _rewardPercentage,
    bool _isActive,
    uint256 _baseWinChance,
    uint256 _maxWinChance,
    uint256 _usdMultiplierBps
) external onlyOwner;
```

### setWinnerBroadcastOptions


```solidity
function setWinnerBroadcastOptions(uint32 dstEid, uint128 gasLimit, uint128 msgValue) external onlyOwner;
```

### pause


```solidity
function pause() external onlyOwner;
```

### unpause


```solidity
function unpause() external onlyOwner;
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

### quoteWinnerBroadcast


```solidity
function quoteWinnerBroadcast(uint32 dstEid, address creatorCoin, address winner, uint16 payoutBps)
    external
    view
    returns (MessagingFee memory fee);
```

### emergencyWithdraw


```solidity
function emergencyWithdraw(address token, uint256 amount) external onlyOwner;
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

### WinnerBroadcast

```solidity
event WinnerBroadcast(uint32 indexed dstEid, address indexed creatorCoin, address indexed winner, uint16 payoutBps);
```

### CrossChainBroadcastFailed

```solidity
event CrossChainBroadcastFailed(uint32 indexed dstEid, address indexed winner, string reason);
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

### WinnerNotifiedToHub

```solidity
event WinnerNotifiedToHub(address indexed creatorCoin, address indexed winner, uint16 payoutBps);
```

### HubNotificationFailed

```solidity
event HubNotificationFailed(address indexed winner, string reason);
```

### WinnerReceivedFromRemote

```solidity
event WinnerReceivedFromRemote(
    uint32 indexed srcEid, address indexed creatorCoin, address indexed winner, uint16 payoutBps
);
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

### BoostManagerUpdated

```solidity
event BoostManagerUpdated(address indexed manager);
```

### VaultGaugeVotingUpdated

```solidity
event VaultGaugeVotingUpdated(address indexed vaultGaugeVoting);
```

### MinVaultWeightUpdated

```solidity
event MinVaultWeightUpdated(uint256 minWeightBps);
```

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

### CreatorCoinNotRegistered

```solidity
error CreatorCoinNotRegistered(address token);
```

### NoOracleConfigured

```solidity
error NoOracleConfigured(address token);
```

### NoVaultConfigured

```solidity
error NoVaultConfigured(address token);
```

### NoGaugeConfigured

```solidity
error NoGaugeConfigured(address token);
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

### VRFRequest

```solidity
struct VRFRequest {
    address user;
    address creatorCoin; // Which creator coin this entry is for
    uint256 amountUSD;
    VRFType vrfType;
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
VRF request tracking - now includes creator coin


```solidity
enum VRFType {
    LOCAL,
    CROSS_CHAIN
}
```

