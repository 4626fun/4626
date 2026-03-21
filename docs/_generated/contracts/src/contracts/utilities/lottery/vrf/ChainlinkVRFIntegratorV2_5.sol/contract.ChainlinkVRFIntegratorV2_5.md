# ChainlinkVRFIntegratorV2_5
[Git Source](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/contracts/utilities/lottery/vrf/ChainlinkVRFIntegratorV2_5.sol)

**Inherits:**
OApp, OAppOptionsType3


## State Variables
### IGNORE_REQUEST_NOT_FOUND

```solidity
bytes32 internal constant IGNORE_REQUEST_NOT_FOUND = bytes32("REQUEST_NOT_FOUND")
```


### IGNORE_ALREADY_FULFILLED

```solidity
bytes32 internal constant IGNORE_ALREADY_FULFILLED = bytes32("ALREADY_FULFILLED")
```


### IGNORE_PROVIDER_NOT_FOUND

```solidity
bytes32 internal constant IGNORE_PROVIDER_NOT_FOUND = bytes32("PROVIDER_NOT_FOUND")
```


### requestCounter

```solidity
uint64 public requestCounter
```


### defaultGasLimit

```solidity
uint32 public defaultGasLimit = 690420
```


### hubEid
Hub chain EID for VRF requests (Base by default)


```solidity
uint32 public hubEid
```


### priceOracle
Price oracle for token/USD price


```solidity
address public priceOracle
```


### lastAggregatedPrice
Last aggregated token/USD price received from Hub


```solidity
int256 public lastAggregatedPrice
```


### lastPriceTimestamp

```solidity
uint256 public lastPriceTimestamp
```


### s_requests

```solidity
mapping(uint64 => RequestStatus) public s_requests
```


### randomWordsProviders

```solidity
mapping(uint64 => address) public randomWordsProviders
```


### authorizedSponsoredCallers

```solidity
mapping(address => bool) public authorizedSponsoredCallers
```


### requestTimeout

```solidity
uint256 public requestTimeout = 1 hours
```


## Functions
### constructor

Constructor


```solidity
constructor(address _endpoint, address _owner, uint32 _hubEid) OApp(_endpoint, _owner) Ownable(_owner);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_endpoint`|`address`|LayerZero endpoint address|
|`_owner`|`address`|Owner address|
|`_hubEid`|`uint32`|Hub chain EID (e.g., Base = 30184)|


### _lzReceive

Receives random words responses from Hub VRF Consumer


```solidity
function _lzReceive(Origin calldata _origin, bytes32, bytes calldata _payload, address, bytes calldata)
    internal
    override;
```

### checkRequestStatus

Check request status


```solidity
function checkRequestStatus(uint64 requestId)
    external
    view
    returns (bool fulfilled, bool exists, address provider, uint256 randomWord, uint256 timestamp, bool expired);
```

### getRandomWord

Get random word for fulfilled request


```solidity
function getRandomWord(uint64 requestId) external view returns (uint256 randomWord, bool fulfilled);
```

### quoteFee

Quote fee for VRF request


```solidity
function quoteFee() public view returns (MessagingFee memory fee);
```

### quoteFeeWithGas

Quote fee with custom gas limit


```solidity
function quoteFeeWithGas(uint32 _gasLimit) public view returns (MessagingFee memory fee);
```

### requestRandomWords

Request random words (contract-sponsored fee)


```solidity
function requestRandomWords() external returns (MessagingReceipt memory receipt, uint64 requestId);
```

### requestRandomWordsPayable

Request random words with caller-provided fee


```solidity
function requestRandomWordsPayable(uint32 targetEid)
    external
    payable
    returns (MessagingReceipt memory receipt, uint64 requestId);
```

### requestRandomWordsPayable

Backward-compatible caller-pays request to hub


```solidity
function requestRandomWordsPayable() external payable returns (MessagingReceipt memory receipt, uint64 requestId);
```

### _requestRandomWords


```solidity
function _requestRandomWords(uint32 dstEid, bool payable_)
    internal
    returns (MessagingReceipt memory receipt, uint64 requestId);
```

### setDefaultGasLimit


```solidity
function setDefaultGasLimit(uint32 _gasLimit) external onlyOwner;
```

### setHubEid


```solidity
function setHubEid(uint32 _hubEid) external onlyOwner;
```

### setRequestTimeout


```solidity
function setRequestTimeout(uint256 _timeout) external onlyOwner;
```

### setPriceOracle


```solidity
function setPriceOracle(address _oracle) external onlyOwner;
```

### setSponsoredCallerAuthorization


```solidity
function setSponsoredCallerAuthorization(address caller, bool authorized) external onlyOwner;
```

### cleanupExpiredRequests

Clean up expired requests


```solidity
function cleanupExpiredRequests(uint64[] calldata requestIds) external;
```

### _payNative


```solidity
function _payNative(uint256 _nativeFee) internal override returns (uint256 nativeFee);
```

### withdraw


```solidity
function withdraw() external onlyOwner;
```

### receive


```solidity
receive() external payable;
```

## Events
### PriceReported

```solidity
event PriceReported(int256 priceUSD, uint256 timestamp);
```

### AggregatedPriceReceived

```solidity
event AggregatedPriceReceived(int256 aggregatedPrice, uint256 timestamp);
```

### PriceOracleSet

```solidity
event PriceOracleSet(address oracle);
```

### RandomWordsRequested

```solidity
event RandomWordsRequested(uint64 indexed requestId, address indexed requester, uint32 dstEid);
```

### MessageSent

```solidity
event MessageSent(uint64 indexed requestId, uint32 indexed dstEid, bytes message);
```

### RandomWordsReceived

```solidity
event RandomWordsReceived(uint256[] randomWords, uint64 indexed sequence, address indexed provider);
```

### CallbackFailed

```solidity
event CallbackFailed(uint64 indexed sequence, address indexed provider, string reason);
```

### CallbackSucceeded

```solidity
event CallbackSucceeded(uint64 indexed sequence, address indexed provider);
```

### RequestExpired

```solidity
event RequestExpired(uint64 indexed sequence, address indexed provider);
```

### RandomWordsResponseIgnored

```solidity
event RandomWordsResponseIgnored(uint64 indexed sequence, uint256 randomWord, bytes32 reason);
```

### RandomWordsReceivedLate

```solidity
event RandomWordsReceivedLate(
    uint64 indexed sequence, address indexed provider, uint256 requestTimestamp, uint256 receivedAt
);
```

### InvalidVrfResponsePayload

```solidity
event InvalidVrfResponsePayload(uint32 indexed srcEid, bytes32 indexed sender, uint256 payloadLength);
```

### GasLimitUpdated

```solidity
event GasLimitUpdated(uint32 oldLimit, uint32 newLimit);
```

### SponsoredCallerAuthorizationUpdated

```solidity
event SponsoredCallerAuthorizationUpdated(address indexed caller, bool authorized);
```

## Errors
### UnauthorizedSponsoredCaller

```solidity
error UnauthorizedSponsoredCaller();
```

## Structs
### RequestStatus

```solidity
struct RequestStatus {
    bool fulfilled;
    bool exists;
    address provider;
    uint256 randomWord;
    uint256 timestamp;
    bool isContract;
}
```

