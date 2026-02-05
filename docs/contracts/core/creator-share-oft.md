---
title: CreatorShareOFT
sidebar_position: 4
---

# CreatorShareOFT

LayerZero V2 Omnichain Fungible Token for cross-chain transfers and fee collection.

## Purpose

The CreatorShareOFT:
- Enables cross-chain transfers via LayerZero V2
- Collects 6.9% fee on all DEX trades
- Routes fees to GaugeController
- Triggers lottery entries for traders

## Key Functions

### LayerZero OFT

```solidity
// Send tokens cross-chain
function send(
    SendParam calldata sendParam,
    MessagingFee calldata fee,
    address refundAddress
) external payable returns (MessagingReceipt memory);

// Quote cross-chain send fee
function quoteSend(
    SendParam calldata sendParam,
    bool payInLzToken
) external view returns (MessagingFee memory);
```

### Address Types

```solidity
// Set address type for fee calculation
function setAddressType(address addr, OperationType opType) external onlyOwner;

// Operation types:
// - Unknown (default, no fees)
// - SwapOnly (DEX pools, aggregators - triggers fees)
// - NoFees (exempt from fees)
```

### Configuration

```solidity
// Set the gauge controller for fee routing
function setGaugeController(address controller) external onlyOwner;

// Enable/disable lottery
function setLotteryEnabled(bool enabled) external onlyOwner;

// Enable/disable fees
function setFeesEnabled(bool enabled) external onlyOwner;
```

## Fee Collection Flow

```
User trades on Uniswap V4 (marked as SwapOnly)
   ↓
transfer() hook detects SwapOnly sender
   ↓
6.9% fee calculated
   ↓
Fee sent to GaugeController
   ↓
Lottery entry triggered for buyer
```

## Address Type Matrix

| From \ To | Unknown | SwapOnly | NoFees |
|-----------|---------|----------|--------|
| **Unknown** | No fee | No fee | No fee |
| **SwapOnly** | **6.9% fee + lottery** | No fee (hop) | No fee |
| **NoFees** | No fee | No fee | No fee |

## Events

```solidity
event FeesCollected(address indexed from, address indexed to, uint256 amount, uint256 fee);
event LotteryEntryCreated(address indexed buyer, uint256 amount);
event AddressTypeSet(address indexed addr, OperationType opType);
```

## DEX Aggregator Support

DEX aggregators are marked as `SwapOnly`:
- 1inch, Paraswap, LlamaSwap, CoW Swap
- Uniswap Universal Router
- Multi-hop routes

The final recipient receives the lottery entry, not the aggregator.
