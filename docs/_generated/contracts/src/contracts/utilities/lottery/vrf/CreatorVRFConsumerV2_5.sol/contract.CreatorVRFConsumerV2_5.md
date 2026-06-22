# CreatorVRFConsumerV2_5
[Git Source](https://github.com/wenakita/4626/blob/main/contracts/utilities/lottery/vrf/CreatorVRFConsumerV2_5.sol)

**Inherits:**
OApp, ReentrancyGuard


## Constants
### registry

```solidity
ICreatorRegistry public immutable registry
```


### BASE_EID
Base EID (hub chain where VRF lives)


```solidity
uint32 public immutable BASE_EID
```


### MAX_PRICE_REPORTING_CHAINS
Maximum number of distinct remote chains permitted to
push price updates. Bounds the cost of
`getAggregatedCreatorPrice()` which iterates
`priceReportingChains` in O(N).

FIX: L-09 (4626-357) — previously unbounded; a malicious
set of LayerZero sources could register arbitrarily many EIDs
and DoS the aggregation read path.


```solidity
uint256 public constant MAX_PRICE_REPORTING_CHAINS = 20
```


### PRICE_STALENESS
Staleness threshold (2 hours)


```solidity
uint256 public constant PRICE_STALENESS = 7200
```


### IGNORE_REASON_DUPLICATE_SEQUENCE

```solidity
uint8 private constant IGNORE_REASON_DUPLICATE_SEQUENCE = 1
```


### IGNORE_REASON_VRF_NOT_CONFIGURED

```solidity
uint8 private constant IGNORE_REASON_VRF_NOT_CONFIGURED = 2
```


### IGNORE_REASON_INVALID_PAYLOAD

```solidity
uint8 private constant IGNORE_REASON_INVALID_PAYLOAD = 3
```


### IGNORE_REASON_RATE_LIMITED

```solidity
uint8 private constant IGNORE_REASON_RATE_LIMITED = 4
```


### VRF_COORDINATOR_TIMELOCK

```solidity
uint256 public constant VRF_COORDINATOR_TIMELOCK = 2 days
```


## State Variables
### vrfCoordinator

```solidity
IVRFCoordinatorV2Plus public vrfCoordinator
```


### priceOracle

```solidity
ICreatorOracle public priceOracle
```


### supportedChains
Supported chains for cross-chain VRF


```solidity
mapping(uint32 => bool) public supportedChains
```


### chainGasLimits

```solidity
mapping(uint32 => uint32) public chainGasLimits
```


### registeredChainEids

```solidity
uint32[] public registeredChainEids
```


### chainNames

```solidity
mapping(uint32 => string) public chainNames
```


### subscriptionId
VRF configuration


```solidity
uint256 public subscriptionId
```


### keyHash

```solidity
bytes32 public keyHash
```


### callbackGasLimit

```solidity
uint32 public callbackGasLimit = 2500000
```


### requestConfirmations

```solidity
uint16 public requestConfirmations = 3
```


### numWords

```solidity
uint32 public numWords = 1
```


### nativePayment

```solidity
bool public nativePayment = false
```


### vrfRequests

```solidity
mapping(uint256 => VRFRequest) public vrfRequests
```


### sequenceToRequestId
Cross-chain requests are uniquely keyed by (srcEid, sequence).

A global `sequence` key enables cross-chain collisions and DoS.


```solidity
mapping(uint32 => mapping(uint64 => uint256)) public sequenceToRequestId
```


### pendingResponses

```solidity
mapping(uint32 => mapping(uint64 => bool)) public pendingResponses
```


### authorizedRelayers

```solidity
mapping(address => bool) public authorizedRelayers
```


### chainRateLimits

```solidity
mapping(uint32 => RateLimitState) public chainRateLimits
```


### chainMaxRequestsPerWindow

```solidity
mapping(uint32 => uint64) public chainMaxRequestsPerWindow
```


### rateLimitWindowSeconds

```solidity
uint64 public rateLimitWindowSeconds = 60
```


### defaultMaxRequestsPerWindow

```solidity
uint64 public defaultMaxRequestsPerWindow = 10
```


### rateLimitingEnabled

```solidity
bool public rateLimitingEnabled = true
```


### localRequestCounter
Local request tracking


```solidity
uint256 public localRequestCounter
```


### userLocalRequests

```solidity
mapping(address => uint256[]) public userLocalRequests
```


### authorizedLocalCallers

```solidity
mapping(address => bool) public authorizedLocalCallers
```


### minimumBalance
Gas configuration


```solidity
uint256 public minimumBalance = 0.005 ether
```


### defaultGasLimit

```solidity
uint32 public defaultGasLimit = 2500000
```


### chainPrices

```solidity
mapping(uint32 => ChainPriceData) public chainPrices
```


### priceReportingChains

```solidity
uint32[] public priceReportingChains
```


### hasPriceReported

```solidity
mapping(uint32 => bool) public hasPriceReported
```


### remotePriceReportingEnabled
If false, ignore any remote price piggybacking in `_lzReceive`.

Safe-by-default: remote chains can otherwise push arbitrary values.


```solidity
bool public remotePriceReportingEnabled = false
```


### localCreatorPriceUSD
Local price from Base's oracle


```solidity
int256 public localCreatorPriceUSD
```


### localPriceTimestamp

```solidity
uint256 public localPriceTimestamp
```


### twapPeriod
TWAP period (default 5 minutes)


```solidity
uint32 public twapPeriod = 300
```


### pendingVrfCoordinator

```solidity
address public pendingVrfCoordinator
```


### vrfCoordinatorTimelockExpiry

```solidity
uint256 public vrfCoordinatorTimelockExpiry
```


## Functions
### constructor

Constructor using registry for LZ endpoint


```solidity
constructor(address _registry, address _owner)
    OApp(ICreatorRegistry(_registry).getLayerZeroEndpoint(block.chainid), _owner)
    Ownable(_owner);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_registry`|`address`|CreatorRegistry address|
|`_owner`|`address`|Owner address|


### queueVRFCoordinatorChange


```solidity
function queueVRFCoordinatorChange(address _vrfCoordinator) external onlyOwner;
```

### executeVRFCoordinatorChange


```solidity
function executeVRFCoordinatorChange() external onlyOwner;
```

### setVRFCoordinator

Kept for initial setup only (when coordinator is zero)


```solidity
function setVRFCoordinator(address _vrfCoordinator) external onlyOwner;
```

### setVRFConfig


```solidity
function setVRFConfig(
    uint256 _subscriptionId,
    bytes32 _keyHash,
    uint32 _callbackGasLimit,
    uint16 _requestConfirmations
) external onlyOwner;
```

### setPriceOracle


```solidity
function setPriceOracle(address _oracle) external onlyOwner;
```

### setRemotePriceReportingEnabled


```solidity
function setRemotePriceReportingEnabled(bool enabled) external onlyOwner;
```

### _lzReceive

Receive VRF request from remote chain

Decodes piggybacked price data if present


```solidity
function _lzReceive(Origin calldata _origin, bytes32, bytes calldata _message, address, bytes calldata)
    internal
    override;
```

### requestRandomWords

Request random words locally on Base


```solidity
function requestRandomWords() external returns (uint256 requestId);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`requestId`|`uint256`|The VRF request ID|


### requestRandomWordsLocal


```solidity
function requestRandomWordsLocal() external returns (uint256 requestId);
```

### _requestRandomWordsLocal


```solidity
function _requestRandomWordsLocal() internal returns (uint256 requestId);
```

### rawFulfillRandomWords

Callback from VRF Coordinator


```solidity
function rawFulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) external;
```

### _handleLocalCallback


```solidity
function _handleLocalCallback(uint256 requestId, VRFRequest storage request, uint256[] calldata randomWords)
    internal;
```

### _handleCrossChainResponse


```solidity
function _handleCrossChainResponse(uint256 requestId, VRFRequest storage request, uint256[] calldata) internal;
```

### relayPendingResponse


```solidity
function relayPendingResponse(uint32 srcEid, uint64 sequence) external payable nonReentrant;
```

### _quoteResponseFee


```solidity
function _quoteResponseFee(VRFRequest storage request)
    internal
    view
    returns (MessagingFee memory fee, uint32 targetGasLimit);
```

### _sendResponseToChain


```solidity
function _sendResponseToChain(VRFRequest storage _request, MessagingFee memory _fee) internal;
```

### _consumeRateLimit


```solidity
function _consumeRateLimit(uint32 sourceChainEid, uint64 sequence, bytes32 sender) internal returns (bool);
```

### _updateChainPrice


```solidity
function _updateChainPrice(uint32 chainEid, int256 price, uint256 timestamp) internal;
```

### updateLocalPrice


```solidity
function updateLocalPrice() public;
```

### getAggregatedCreatorPrice


```solidity
function getAggregatedCreatorPrice() public view returns (int256 avgPrice, uint256 numChains);
```

### setLocalCallerAuthorization


```solidity
function setLocalCallerAuthorization(address caller, bool authorized) external onlyOwner;
```

### setRelayerAuthorization


```solidity
function setRelayerAuthorization(address relayer, bool authorized) external onlyOwner;
```

### setRateLimitDefaults


```solidity
function setRateLimitDefaults(uint64 windowSeconds, uint64 maxRequestsPerWindow, bool enabled) external onlyOwner;
```

### setChainRateLimit


```solidity
function setChainRateLimit(uint32 chainEid, uint64 maxRequestsPerWindow) external onlyOwner;
```

### clearChainRateLimit


```solidity
function clearChainRateLimit(uint32 chainEid) external onlyOwner;
```

### setSupportedChain


```solidity
function setSupportedChain(uint32 chainEid, bool supported, uint32 gasLimit) external onlyOwner;
```

### addNewChain


```solidity
function addNewChain(uint32 chainEid, string calldata chainName, uint32 gasLimit) external onlyOwner;
```

### setDefaultGasLimit


```solidity
function setDefaultGasLimit(uint32 _gasLimit) external onlyOwner;
```

### setTwapPeriod


```solidity
function setTwapPeriod(uint32 _period) external onlyOwner;
```

### removePriceReportingChain


```solidity
function removePriceReportingChain(uint32 chainEid) external onlyOwner;
```

### fundContract


```solidity
function fundContract() external payable;
```

### getChainMaxRequestsPerWindow


```solidity
function getChainMaxRequestsPerWindow(uint32 chainEid) public view returns (uint64);
```

### quotePendingResponseFee


```solidity
function quotePendingResponseFee(uint32 srcEid, uint64 sequence)
    external
    view
    returns (uint256 nativeFee, bool relayable);
```

### getPendingResponseStatus


```solidity
function getPendingResponseStatus(uint32 srcEid, uint64 sequence)
    external
    view
    returns (
        uint256 requestId,
        bool pending,
        bool fulfilled,
        bool responseSent,
        uint32 sourceChainEid,
        uint256 quotedFee
    );
```

### getLocalRequest


```solidity
function getLocalRequest(uint256 requestId)
    external
    view
    returns (address requester, bool fulfilled, bool callbackSent, uint256 randomWord, uint256 timestamp);
```

### getUserLocalRequests


```solidity
function getUserLocalRequests(address user) external view returns (uint256[] memory);
```

### getRequestStats


```solidity
function getRequestStats() external view returns (uint256 totalLocal, uint256 totalCrossChain);
```

### getAllChainPrices


```solidity
function getAllChainPrices()
    external
    view
    returns (uint32[] memory chainEids, int256[] memory prices, uint256[] memory timestamps);
```

### getContractStatus


```solidity
function getContractStatus()
    external
    view
    returns (
        uint256 balance,
        uint256 minBalance,
        bool canSendResponses,
        uint32 gasLimit,
        uint256 supportedChainsCount
    );
```

### withdraw


```solidity
function withdraw() external onlyOwner nonReentrant;
```

### receive


```solidity
receive() external payable;
```

## Events
### RandomWordsRequested

```solidity
event RandomWordsRequested(
    uint256 indexed requestId, uint32 indexed srcEid, bytes32 indexed requester, uint64 sequence, uint256 timestamp
);
```

### LocalRandomWordsRequested

```solidity
event LocalRandomWordsRequested(uint256 indexed requestId, address indexed requester, uint256 timestamp);
```

### VRFRequestSent

```solidity
event VRFRequestSent(uint256 indexed originalRequestId, uint256 indexed vrfRequestId, uint32 sourceChain);
```

### RandomnessFulfilled

```solidity
event RandomnessFulfilled(uint256 indexed requestId, uint256[] randomWords, uint32 targetChain);
```

### ResponseSentToChain

```solidity
event ResponseSentToChain(uint64 indexed sequence, uint256 randomWord, uint32 targetChain, uint256 fee);
```

### ResponsePending

```solidity
event ResponsePending(uint64 indexed sequence, uint256 indexed requestId, uint32 targetChain, string reason);
```

### LocalCallbackSent

```solidity
event LocalCallbackSent(uint256 indexed requestId, address indexed requester, uint256 randomWord);
```

### LocalCallbackFailed

```solidity
event LocalCallbackFailed(uint256 indexed requestId, address indexed requester, string reason);
```

### VRFConfigUpdated

```solidity
event VRFConfigUpdated(
    uint256 subscriptionId, bytes32 keyHash, uint32 callbackGasLimit, uint16 requestConfirmations
);
```

### ChainSupportUpdated

```solidity
event ChainSupportUpdated(uint32 chainEid, bool supported, uint32 gasLimit);
```

### ContractFunded

```solidity
event ContractFunded(address indexed funder, uint256 amount, uint256 newBalance);
```

### LocalCallerAuthorized

```solidity
event LocalCallerAuthorized(address indexed caller, bool authorized);
```

### RelayerAuthorizationUpdated

```solidity
event RelayerAuthorizationUpdated(address indexed relayer, bool authorized);
```

### ResponseQueuedForRelay

```solidity
event ResponseQueuedForRelay(
    uint64 indexed sequence, uint256 indexed requestId, uint32 targetChain, uint256 quotedFee
);
```

### PendingResponseRelayed

```solidity
event PendingResponseRelayed(
    uint64 indexed sequence, uint256 indexed requestId, address indexed relayer, uint256 feePaid
);
```

### ChainPriceReceived

```solidity
event ChainPriceReceived(uint32 indexed chainEid, int256 creatorPriceUSD, uint256 timestamp);
```

### LocalPriceUpdated

```solidity
event LocalPriceUpdated(int256 creatorPriceUSD, uint256 timestamp);
```

### AggregatedPriceCalculated

```solidity
event AggregatedPriceCalculated(int256 avgPrice, uint256 numChains, uint256 timestamp);
```

### PriceOracleSet

```solidity
event PriceOracleSet(address oracle);
```

### RemotePriceReportingEnabled

```solidity
event RemotePriceReportingEnabled(bool enabled);
```

### CrossChainRequestRateLimited

```solidity
event CrossChainRequestRateLimited(
    uint64 indexed sequence,
    uint32 indexed srcEid,
    bytes32 indexed sender,
    uint64 windowStart,
    uint64 requestCount,
    uint64 maxRequests
);
```

### RateLimitConfigUpdated

```solidity
event RateLimitConfigUpdated(
    uint32 indexed chainEid, uint64 maxRequestsPerWindow, uint64 windowSeconds, bool enabled
);
```

### CrossChainRequestIgnored
Emitted when a cross-chain request is intentionally ignored without reverting.

Reverting in `_lzReceive` can lock the LayerZero inbound lane for that srcEid.


```solidity
event CrossChainRequestIgnored(
    uint32 indexed srcEid, bytes32 indexed sender, uint64 indexed sequence, uint8 reason
);
```

### VRFCoordinatorChangeQueued

```solidity
event VRFCoordinatorChangeQueued(address indexed newCoordinator, uint256 effectiveAt);
```

### VRFCoordinatorChangeExecuted

```solidity
event VRFCoordinatorChangeExecuted(address indexed newCoordinator);
```

### PriceReportingChainRejected
Emitted when a new chain EID is refused registration
because MAX_PRICE_REPORTING_CHAINS is already full.

FIX: L-09 (4626-357).


```solidity
event PriceReportingChainRejected(uint32 indexed chainEid);
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

### InvalidChain

```solidity
error InvalidChain();
```

### DuplicateSequence

```solidity
error DuplicateSequence();
```

### InsufficientBalance

```solidity
error InsufficientBalance();
```

### InvalidRequest

```solidity
error InvalidRequest();
```

### UnauthorizedRelayer

```solidity
error UnauthorizedRelayer();
```

### NotPendingResponse

```solidity
error NotPendingResponse();
```

### ResponseNotReady

```solidity
error ResponseNotReady();
```

### ResponseAlreadySent

```solidity
error ResponseAlreadySent();
```

### RelayFeeMismatch

```solidity
error RelayFeeMismatch(uint256 provided, uint256 expected);
```

### MissingLayerZeroEid

```solidity
error MissingLayerZeroEid(uint256 chainId);
```

### InvalidRateLimitConfig

```solidity
error InvalidRateLimitConfig();
```

### CrossChainRateLimitExceeded

```solidity
error CrossChainRateLimitExceeded(uint32 sourceChainEid, uint64 sequence);
```

## Structs
### VRFRequest
VRF request tracking


```solidity
struct VRFRequest {
    uint64 sequence;
    uint32 sourceChainEid;
    bytes32 sourcePeer;
    address localRequester;
    bool isLocalRequest;
    uint256 randomWord;
    bool fulfilled;
    bool responseSent;
    bool callbackSent;
    uint256 timestamp;
}
```

### RateLimitState

```solidity
struct RateLimitState {
    uint64 windowStart;
    uint64 requestCount;
}
```

### ChainPriceData
Price data from each chain


```solidity
struct ChainPriceData {
    int256 creatorPriceUSD;
    uint256 timestamp;
    uint256 lastUpdated;
}
```

