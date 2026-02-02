# RandomWordsRequest
[Git Source](https://github.com/creatorvault/4626/blob/fd199051169d23a9cf1f9ac62fff0899dc5c1eb1/contracts/services/lottery/vrf/CreatorVRFConsumerV2_5.sol)


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

