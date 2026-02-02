# Origin
[Git Source](https://github.com/creatorvault/4626/blob/d2887a577bbbcd8195e2d76fc50368643edd1f1a/contracts/interfaces/ILayerZeroEndpointV2.sol)

**Title:**
ILayerZeroEndpointV2

**Author:**
LayerZero Labs

Interface for the LayerZero v2 endpoint.

Used by CreatorVault OFT integrations.


```solidity
struct Origin {
uint32 srcEid;
bytes32 sender;
uint64 nonce;
}
```

