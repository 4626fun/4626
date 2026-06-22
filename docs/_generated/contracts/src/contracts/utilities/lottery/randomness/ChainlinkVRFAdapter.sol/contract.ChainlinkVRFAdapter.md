# ChainlinkVRFAdapter
[Git Source](https://github.com/wenakita/4626/blob/main/contracts/utilities/lottery/randomness/ChainlinkVRFAdapter.sol)

**Inherits:**
[IRandomnessSource](/contracts/utilities/lottery/randomness/IRandomnessSource.sol/interface.IRandomnessSource.md)

**Title:**
ChainlinkVRFAdapter

Wraps `CreatorVRFConsumerV2_5` behind the `IRandomnessSource`
interface. This is the REQUEST-mode side of the new selector.

No state of its own — every call passes through to the existing
consumer. That keeps the audited Chainlink path bit-identical to
what's deployed today; this adapter is a pure shape converter.


## Constants
### consumer

```solidity
IChainlinkVRFConsumerLike public immutable consumer
```


## Functions
### constructor


```solidity
constructor(IChainlinkVRFConsumerLike _consumer) ;
```

### mode


```solidity
function mode() external pure returns (SourceMode);
```

### isReady


```solidity
function isReady(uint256 key) external view returns (bool);
```

### randomWord


```solidity
function randomWord(uint256 key) external view returns (uint256);
```

### request

REQUEST-mode entrypoint. Returns the consumer's request id so
the caller can use it as the lookup key for `randomWord`.


```solidity
function request() external returns (uint256 requestId);
```

