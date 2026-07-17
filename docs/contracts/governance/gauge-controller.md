---
title: GaugeController
sidebar_position: 1
---

# CreatorGaugeController

**Product role:** Per-creator `tradeFeeCollector`: receives ShareOFT trade fees, splits them by **immutable** BPS, and custodies `jackpotReserve`. Jackpot **payout** authority is [LotteryManager4626](/contracts/utilities/lottery-manager).

[Token units](/reference/glossary#token-units)

## Fee split (immutable)

```solidity
uint256 public constant burnShareBps = 961;       // 9.61% → unwrap → ▢ burn (PPS)
uint256 public constant lotteryShareBps = 6900;   // 69% → jackpotReserve (■)
uint256 public constant creatorShareBps = 0;      // 0% → creatorTreasury (off)
uint256 public constant protocolShareBps = 2139;  // 21.39% → voter/protocol (■)
```

No `setFeeSplit` — read via `getFeeSplit()`. Conservation: [Lean §4](/audits/aristotle/lean-proof-targets#4-gauge-fee-split-conservation). Boost math: [Curve 2.5×](/audits/aristotle/curve-boost).

## Distribution flow

Primary ShareOFT path — **split in ■ first**:

```
receiveFees() → pending (■) → distribute()
  69% → jackpotReserve (■)
  21.39% → voter/protocol (■)
  creator% → creatorTreasury (■; default 0%)
  9.61% residual → unwrap → ▢ burned (PPS ↑)
```

## Key functions

```solidity
function receiveFees(uint256 amount) external;
function receiveWETHFees(uint256 amount) external;
function deposit(uint256 amount) external;
function distribute() external;
function forceDistribute() external onlyOwner;
function payJackpot(address winner, uint256 amount) external; // lottery manager only
function getJackpotReserve() external view returns (uint256);
function setCreatorTreasury(address treasury) external onlyOwner;
function getFeeSplit() external pure returns (uint256 burn, uint256 lottery, uint256 creator, uint256 protocol);
function processWETHFees() external;
```

If `creatorShareBps > 0`, treasury must be non-zero (`CreatorTreasuryRequired`).

### WETH / hook path

Alternate ingress: WETH → creator coin → vault deposit. Lottery/voter slices are wrapped back to ■; burn stays ▢. Large swaps are owner/keeper-gated by default (`setWethFeeKeeper`, `setWethProcessingConfig`).

Prev: [CreatorOVaultWrapper](/contracts/core/creator-ovault-wrapper) · Next: [Share CCA Launch Arm](/contracts/strategies/cca-launch)
