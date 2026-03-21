# Origin
[Git Source](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/contracts/interfaces/ILayerZeroEndpointV2.sol)

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

