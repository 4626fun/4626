# RandomWordsRequest
[Git Source](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/contracts/utilities/lottery/vrf/CreatorVRFConsumerV2_5.sol)


```solidity
struct RandomWordsRequest {
bytes32 keyHash;
uint256 subId;
uint16 requestConfirmations;
uint32 callbackGasLimit;
uint32 numWords;
bytes extraArgs;
}
```

