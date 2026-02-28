# CreatorVRFConsumerV2_5
[Git Source](https://github.com/4626/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/contracts/services/lottery/vrf/CreatorVRFConsumerV2_5.sol)

**Inherits:**
OApp, ReentrancyGuard


## State Variables
### vrfCoordinator

```solidity
IVRFCoordinatorV2Plus public vrfCoordinator
```


### registry

```solidity
ICreatorRegistry public immutable registry
```


### priceOracle

```solidity
ICreatorOracle public priceOracle
```


### BASE_EID
Base EID (hub chain where VRF lives)


```solidity
uint32 public immutable BASE_EID
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

```solidity
mapping(uint64 => uint256) public sequenceToRequestId
```


### pendingResponses

```solidity
mapping(uint64 => bool) public pendingResponses
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


### PRICE_STALENESS
Staleness threshold (2 hours)


```solidity
uint256 public constant PRICE_STALENESS = 7200
```


## Functions
### constructor

Constructor using registry for LZ endpoint


```solidity
constructor(address _registry, address _owner)
    OApp(ICreatorRegistry(_registry).getLayerZeroEndpoint(uint16(block.chainid)), _owner)
    Ownable(_owner);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_registry`|`address`|CreatorRegistry address|
|`_owner`|`address`|Owner address|


### setVRFCoordinator


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

### _sendResponseToChain


```solidity
function _sendResponseToChain(VRFRequest storage _request, MessagingFee memory _fee) internal;
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

### fundContract


```solidity
function fundContract() external payable;
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

### ChainPriceData
Price data from each chain


```solidity
struct ChainPriceData {
    int256 creatorPriceUSD;
    uint256 timestamp;
    uint256 lastUpdated;
}
```

