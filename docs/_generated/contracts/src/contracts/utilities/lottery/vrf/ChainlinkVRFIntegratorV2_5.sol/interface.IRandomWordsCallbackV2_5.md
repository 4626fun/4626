# IRandomWordsCallbackV2_5
[Git Source](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/contracts/utilities/lottery/vrf/ChainlinkVRFIntegratorV2_5.sol)

**Title:**
ChainlinkVRFIntegratorV2_5 - Cross-Chain VRF System

**Author:**
0xakita.eth

Ready for future cross-chain VRF implementation

Spoke chain contract that receives random words requests and forwards them to Hub chain
for Chainlink VRF 2.5 processing. Part of the 4626 cross-chain lottery
and random words infrastructure.

Callback interface for VRF consumers


## Functions
### receiveRandomWords


```solidity
function receiveRandomWords(uint256[] memory randomWords, uint256 requestId) external;
```

