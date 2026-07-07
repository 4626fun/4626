---
title: CreatorRegistry
sidebar_position: 1
---

# Registry4626 (formerly CreatorRegistry)

**Product role:** Onchain **index** from a lane token address (creator coin or agent token) to that vault’s contract stack (vault, wrapper, ShareOFT, gauge). Integrators and the application resolve which contracts belong to a given token via the registry.

Central registry for platform contract lookups and shared chain config.

## Purpose

The Registry4626:
- Maps lane tokens → (Vault, Wrapper, OFT, GaugeController, Lottery)
- Stores chain configurations (LayerZero endpoints, DEX infrastructure)
- Provides lookup functions for all platform contracts
- Manages per-creator and shared infrastructure references

## Key Functions

### Registration

```solidity
// Register a new lane token (creator coin or agent token)
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
// Get vault for a creator coin
function getVaultForToken(address creatorCoin) external view returns (address);

// Get ShareOFT for a creator coin
function getShareOFTForToken(address creatorCoin) external view returns (address);

// Check if a token is registered
function isTokenRegistered(address token) external view returns (bool);

// Get all registered tokens
function getAllTokens() external view returns (address[] memory);
```

### Chain Configuration

```solidity
// Get LayerZero endpoint for a chain
function getLayerZeroEndpoint(uint16 chainId) external view returns (address);

// Get endpoint ID for a chain
function getEidForChainId(uint256 chainId) external view returns (uint32);

// Check if current chain is hub
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
