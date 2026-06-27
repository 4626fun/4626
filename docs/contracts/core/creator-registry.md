---
title: CreatorRegistry
sidebar_position: 1
---

# CreatorRegistry

**Product role:** Onchain **index** from a creator coin address to that vault’s contract stack (vault, wrapper, ShareOFT, gauge). Integrators and the application resolve which contracts belong to a given coin via the registry.

Central registry for platform contract lookups and shared chain config.

## Purpose

The CreatorRegistry:
- Maps Creator Coins → (Vault, Wrapper, OFT, GaugeController, Lottery)
- Stores chain configurations (LayerZero endpoints, DEX infrastructure)
- Provides lookup functions for all platform contracts
- Manages per-creator and shared infrastructure references

## Key Functions

### Registration

```solidity
// Register a new creator coin and its contracts
function registerCreatorCoin(
    address creatorCoin,
    address vault,
    address wrapper,
    address shareOFT,
    address gaugeController
) external onlyOwner;
```

### Lookup

```solidity
// Get vault for a creator coin
function getVaultForToken(address creatorCoin) external view returns (address);

// Get ShareOFT for a creator coin
function getShareOFTForToken(address creatorCoin) external view returns (address);

// Check if a creator coin is registered
function isCreatorCoinRegistered(address creatorCoin) external view returns (bool);

// Get all registered creator coins
function getAllCreatorCoins() external view returns (address[] memory);
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
event CreatorCoinRegistered(
    address indexed creatorCoin,
    address vault,
    address wrapper,
    address shareOFT,
    address gaugeController
);
```
