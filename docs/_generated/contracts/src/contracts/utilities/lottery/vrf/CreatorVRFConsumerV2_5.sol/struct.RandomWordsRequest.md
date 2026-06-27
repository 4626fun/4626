# RandomWordsRequest
[Git Source](https://github.com/wenakita/4626/blob/2951e17122326ff4a23b28e80356c44121ebf59c/contracts/utilities/lottery/vrf/CreatorVRFConsumerV2_5.sol)


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

