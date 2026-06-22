# IChainlinkVRFConsumerLike
[Git Source](https://github.com/wenakita/4626/blob/main/contracts/utilities/lottery/randomness/ChainlinkVRFAdapter.sol)

Minimal interface to call into the existing
`CreatorVRFConsumerV2_5` without importing the full file.


## Functions
### requestRandomWords


```solidity
function requestRandomWords() external returns (uint256 requestId);
```

### getRequestStatus


```solidity
function getRequestStatus(uint256 requestId)
    external
    view
    returns (address requester, bool fulfilled, bool callbackSent, uint256 randomWord, uint256 timestamp);
```

