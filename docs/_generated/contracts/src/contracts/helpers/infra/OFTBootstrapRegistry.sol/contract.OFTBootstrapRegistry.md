# OFTBootstrapRegistry
[Git Source](https://github.com/creatorvault/4626/blob/2cd71abc97601febe38089cb23bfd133739e818d/contracts/helpers/infra/OFTBootstrapRegistry.sol)

**Title:**
OFTBootstrapRegistry

**Author:**
0xakita.eth

Minimal registry for CreatorShareOFT construction.

Used only during OFT deployment to resolve the LayerZero endpoint.


## State Variables
### LZ_COMMON_ENDPOINT
LayerZero v2 common endpoint (used as a fallback).
This is the same value used by CreatorRegistry (`layerZeroCommonEndpoint`).


```solidity
address public constant LZ_COMMON_ENDPOINT = 0x1a44076050125825900e736c501f859c50fE728c
```


### layerZeroEndpoints

```solidity
mapping(uint16 => address) public layerZeroEndpoints
```


## Functions
### setLayerZeroEndpoint

Set (or update) the LayerZero endpoint for a chain.

Permissionless by design — safe because it is only used during OFT construction,
and our AA batch sets the value atomically immediately before deployment.


```solidity
function setLayerZeroEndpoint(uint16 chainId, address endpoint) external;
```

### getLayerZeroEndpoint

Return the LayerZero endpoint for a chain, with a common fallback.


```solidity
function getLayerZeroEndpoint(uint16 chainId) external view returns (address);
```

## Events
### LayerZeroEndpointUpdated

```solidity
event LayerZeroEndpointUpdated(uint16 indexed chainId, address endpoint);
```

## Errors
### ZeroAddress

```solidity
error ZeroAddress();
```

