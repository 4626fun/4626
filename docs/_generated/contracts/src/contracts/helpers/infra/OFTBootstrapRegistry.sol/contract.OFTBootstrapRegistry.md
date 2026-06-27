# OFTBootstrapRegistry
[Git Source](https://github.com/wenakita/4626/blob/2951e17122326ff4a23b28e80356c44121ebf59c/contracts/helpers/infra/OFTBootstrapRegistry.sol)

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


## Constants
### LZ_COMMON_ENDPOINT
LayerZero v2 EndpointV2 — identical address on all EVM chains.


```solidity
address public constant LZ_COMMON_ENDPOINT = 0x1a44076050125825900e736c501f859c50fE728c
```


### BASE_CHAIN_ID
Base mainnet chain id.


```solidity
uint256 public constant BASE_CHAIN_ID = 8453
```


### BASE_EID
LayerZero EID for Base mainnet.


```solidity
uint32 public constant BASE_EID = 30184
```


## Functions
### getLayerZeroEndpoint

Return the LayerZero endpoint for any chain.

FIX: F-23 — Always returns LZ_COMMON_ENDPOINT regardless of chainId.
The chainId parameter is retained solely for ICreatorRegistry interface
compatibility. LZ v2 EndpointV2 shares a single CREATE2 address across
all EVM chains, so per-chain resolution is unnecessary.


```solidity
function getLayerZeroEndpoint(
    uint256 /* chainId — intentionally unused */
)
    external
    pure
    returns (address);
```

### getEidForChainId

Return the LayerZero EID for the provided chain id.

The deployment lane currently targets Base only; returning 0 for
unknown chain IDs preserves CreatorShareOFT's constructor guard.


```solidity
function getEidForChainId(uint256 chainId) external pure returns (uint32);
```

