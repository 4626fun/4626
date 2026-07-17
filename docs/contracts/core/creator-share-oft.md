---
title: CreatorShareOFT
sidebar_position: 4
---

# CreatorShareOFT

**Product role:** The tradable **■ share token** on Base (and, when bridged, on remote chains). DEX trades may incur ShareOFT transfer fees routed to the gauge; qualifying hub-chain **buys** may enter the instant lottery.

LayerZero V2 omnichain fungible token. Enables cross-chain transfers, collects a **6.9%** transfer fee on qualifying DEX routes (SwapOnly → non-SwapOnly), routes fees to [CreatorGaugeController](/contracts/governance/gauge-controller), and emits lottery entries for qualifying hub-chain **buys**. Remote-chain entries queue for explicit buyer-paid submission.

## Key Functions

```solidity
function send(SendParam calldata sendParam, MessagingFee calldata fee, address refundAddress)
    external payable returns (MessagingReceipt memory);
function quoteSend(SendParam calldata sendParam, bool payInLzToken) external view returns (MessagingFee memory);

function setAddressType(address addr, OperationType opType) external onlyOwner;
function setGaugeController(address controller) external onlyOwner;
function setLotteryEnabled(bool enabled) external onlyOwner;
function setFeesEnabled(bool enabled) external onlyOwner;

function quotePendingLotteryEntry(uint256 entryId) external view returns (MessagingFee memory fee);
function submitPendingLotteryEntry(uint256 entryId) external payable;
```

Operation types: `Unknown` (no fees), `SwapOnly` (DEX — triggers fees), `NoFees` (exempt).

## Fee Collection Flow

```
User trades on SwapOnly venue → transfer() hook detects buy → 6.9% fee
   ↓
Hub: fee → GaugeController + local lottery trigger
Remote: fee accumulated + pending lottery entry queued
   ↓
Remote buyer calls submitPendingLotteryEntry(entryId) with exact msg.value → hub LotteryManager
```

## Address Type Matrix

| From \ To | Unknown | SwapOnly | NoFees |
|-----------|---------|----------|--------|
| **Unknown** | No fee | No fee | No fee |
| **SwapOnly** | **6.9% fee + lottery** | No fee (hop) | No fee |
| **NoFees** | No fee | No fee | No fee |

DEX aggregators (1inch, Paraswap, LlamaSwap, CoW Swap, Uniswap Universal Router) are marked `SwapOnly`. The final recipient receives the lottery entry, not the aggregator.

## Sell-side fees

Native ShareOFT transfer fees apply on the **buy** path (`SwapOnly` → non-`SwapOnly`) by default. **Sell-side** fees require an enabled tax hook aligned to the same `tradeFeeCollector` — do not assume sell fees are active unless hook configuration is verified onchain.

## Emergency Mitigation

Disable lottery on affected remote ShareOFTs:

```bash
forge script script/EmergencyDisableRemoteLottery.s.sol:EmergencyDisableRemoteLottery \
  --rpc-url $RPC_URL --broadcast -vvvv
```

Required env: `PRIVATE_KEY`, `SHARE_OFT` (remote deployment address).
