# Origin
[Git Source](https://github.com/creatorvault/4626/blob/fd199051169d23a9cf1f9ac62fff0899dc5c1eb1/contracts/interfaces/ILayerZeroEndpointV2.sol)

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

