---
title: Registry4626
sidebar_position: 1
---

# Registry4626

**Product role:** Onchain **index** from a lane token address (creator coin or agent token) to that vault's contract stack (vault, wrapper, ShareOFT, gauge).

Central registry for platform contract lookups and shared chain config. Maps lane tokens → (Vault, Wrapper, OFT, GaugeController, Lottery), stores LayerZero endpoints and DEX infrastructure, and exposes lookup for all platform contracts.

## Key Functions

### Registration

```solidity
function registerToken(
    address token,
    string calldata name,
    string calldata symbol,
    address creator,
    address pool,
    uint24 poolFee
) external;
```

### Lookup

```solidity
function getVaultForToken(address creatorCoin) external view returns (address);
function getShareOFTForToken(address creatorCoin) external view returns (address);
function isTokenRegistered(address token) external view returns (bool);
function getAllTokens() external view returns (address[] memory);
```

### Chain Configuration

```solidity
function getLayerZeroEndpoint(uint16 chainId) external view returns (address);
function getEidForChainId(uint256 chainId) external view returns (uint32);
function isHubChain() external view returns (bool);
```

## Events

```solidity
event TokenRegistered(
    address indexed token,
    string name,
    string symbol,
    address indexed creator,
    address vault,
    address shareOFT,
    address wrapper
);
```

Prev: [Smart contracts](/contracts) · Next: [CreatorOVault](/contracts/core/creator-ovault)
