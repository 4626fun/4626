# OFTBootstrapRegistry
[Git Source](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/contracts/helpers/infra/OFTBootstrapRegistry.sol)

**Title:**
OFTBootstrapRegistry

**Author:**
0xakita.eth

Minimal registry for CreatorShareOFT construction.

Used only during OFT deployment to resolve the LayerZero endpoint.
The endpoint is the canonical LZ v2 EndpointV2, deployed at the same
address on all EVM chains via CREATE2. No mutable state is needed or
permitted — this contract is intentionally write-free to eliminate the
endpoint poisoning attack surface.


## State Variables
### LZ_COMMON_ENDPOINT
LayerZero v2 EndpointV2 — identical address on all EVM chains.


```solidity
address public constant LZ_COMMON_ENDPOINT = 0x1a44076050125825900e736c501f859c50fE728c
```


## Functions
### getLayerZeroEndpoint

Return the LayerZero endpoint for any chain.

Always returns LZ_COMMON_ENDPOINT. The chain ID parameter is
accepted for interface compatibility but has no effect.


```solidity
function getLayerZeroEndpoint(uint256) external pure returns (address);
```

