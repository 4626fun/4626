# IVRFCallbackReceiver
[Git Source](https://github.com/wenakita/4626/blob/e241310837fd2472040c12df9be8240c28719e34/contracts/utilities/lottery/vrf/CreatorVRFConsumerV2_5.sol)

**Title:**
CreatorVRFConsumerV2_5

**Author:**
0xakita.eth

Multi-chain VRF Consumer for Creator Coin lottery system

Accepts requests from multiple chains AND direct local requests from Base.
Sends randomness back to the originating chain or calls local callbacks.
This acts as a VRF hub on Base using Chainlink VRF 2.5.

ARCHITECTURE:
- Base (Hub): Chainlink VRF lives here
- Remote chains: Send VRF requests via LayerZero
- Hub processes VRF, sends randomness back
- Local contracts can also request VRF directly

PRICE AGGREGATION:
- Collects ■AKITA/USD prices from all chains
- Returns aggregated average price with VRF responses
- Ensures consistent pricing for lottery across all chains


## Functions
### receiveRandomWords


```solidity
function receiveRandomWords(uint256 requestId, uint256[] memory randomWords) external;
```

