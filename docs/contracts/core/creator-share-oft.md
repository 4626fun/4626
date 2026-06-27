---
title: CreatorShareOFT
sidebar_position: 4
---

# CreatorShareOFT

**Product role:** The tradable **■ share token** on Base (and bridged chains). DEX trades pay fees routed to the gauge; hub-chain buys can enter the instant lottery.

LayerZero V2 Omnichain Fungible Token for cross-chain transfers and fee collection.

## Purpose

The CreatorShareOFT:
- Enables cross-chain transfers via LayerZero V2
- Collects 6.9% fee on all DEX trades
- Routes fees to GaugeController
- Triggers lottery entries for traders on hub
- Queues remote-chain lottery entries for explicit buyer-paid submission

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

### Remote Lottery Entry Submission

```solidity
// Quote fee for a queued remote lottery entry
function quotePendingLotteryEntry(uint256 entryId)
    external
    view
    returns (MessagingFee memory fee);

// Submit queued entry and pay exact native LayerZero fee
function submitPendingLotteryEntry(uint256 entryId) external payable;
```

## Fee Collection Flow

```
User trades on SwapOnly venue
   ↓
transfer() hook detects buy
   ↓
6.9% fee calculated
   ↓
Hub chain: fee routed to GaugeController + local lottery trigger
Remote chain: fee accumulated + pending lottery entry queued
   ↓
Remote buyer calls submitPendingLotteryEntry(entryId) with exact msg.value
   ↓
LayerZero message sent to hub LotteryManager
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

## Emergency Mitigation

If remote lottery sponsorship risk needs immediate containment, disable lottery on affected remote ShareOFTs:

```bash
forge script script/EmergencyDisableRemoteLottery.s.sol:EmergencyDisableRemoteLottery \
  --rpc-url $RPC_URL \
  --broadcast \
  -vvvv
```

Required env vars:
- `PRIVATE_KEY`
- `SHARE_OFT` (remote deployment address)
