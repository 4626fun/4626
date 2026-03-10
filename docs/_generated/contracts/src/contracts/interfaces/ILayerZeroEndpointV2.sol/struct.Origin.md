# Origin
[Git Source](https://github.com/wenakita/4626/blob/a7a73da3f7c497451de25d8aa13ad38808135355/contracts/interfaces/ILayerZeroEndpointV2.sol)

**Title:**
ILayerZeroEndpointV2

**Author:**
LayerZero Labs

Interface for the LayerZero v2 endpoint.

Used by 4626 OFT integrations.


```solidity
struct Origin {
uint32 srcEid;
bytes32 sender;
uint64 nonce;
}
```

