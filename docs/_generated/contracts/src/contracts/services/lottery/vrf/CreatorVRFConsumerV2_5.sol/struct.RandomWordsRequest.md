# RandomWordsRequest
[Git Source](https://github.com/creatorvault/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/contracts/services/lottery/vrf/CreatorVRFConsumerV2_5.sol)


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

