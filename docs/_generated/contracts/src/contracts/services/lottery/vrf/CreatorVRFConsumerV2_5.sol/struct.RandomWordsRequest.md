# RandomWordsRequest
[Git Source](https://github.com/creatorvault/4626/blob/d2887a577bbbcd8195e2d76fc50368643edd1f1a/contracts/services/lottery/vrf/CreatorVRFConsumerV2_5.sol)


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

