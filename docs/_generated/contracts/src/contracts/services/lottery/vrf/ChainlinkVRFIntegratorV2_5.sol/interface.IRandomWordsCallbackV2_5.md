# IRandomWordsCallbackV2_5
[Git Source](https://github.com/creatorvault/4626/blob/d2887a577bbbcd8195e2d76fc50368643edd1f1a/contracts/services/lottery/vrf/ChainlinkVRFIntegratorV2_5.sol)

**Title:**
ChainlinkVRFIntegratorV2_5 - Cross-Chain VRF System

**Author:**
0xakita.eth

Ready for future cross-chain VRF implementation

Spoke chain contract that receives random words requests and forwards them to Hub chain
for Chainlink VRF 2.5 processing. Part of the CreatorVault cross-chain lottery
and random words infrastructure.

Callback interface for VRF consumers


## Functions
### receiveRandomWords


```solidity
function receiveRandomWords(uint256[] memory randomWords, uint256 requestId) external;
```

