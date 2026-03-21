# Origin
[Git Source](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/contracts/interfaces/ILayerZeroEndpointV2.sol)

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

