# IRandomWordsCallbackV2_5
[Git Source](https://github.com/wenakita/4626/blob/a7a73da3f7c497451de25d8aa13ad38808135355/contracts/utilities/lottery/vrf/ChainlinkVRFIntegratorV2_5.sol)

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

