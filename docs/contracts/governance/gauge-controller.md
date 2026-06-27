---
title: GaugeController
sidebar_position: 1
---

# CreatorGaugeController

**Product role:** Receives ShareOFT **trade fees** and splits them across vault-share burn, jackpot reserve, optional creator treasury, and protocol/voter branches — the onchain fee router for holders.

Fee splitter and gauge controller for creator vaults.

## Purpose

The GaugeController:
- Receives trading fees from ShareOFT
- Splits fees according to configured percentages
- Routes fees to lottery, burn, optional creator treasury, and voter/protocol branch
- Manages jackpot reserve for lottery payouts

## Fee Split Configuration

```solidity
// Default configuration (in basis points, 10000 = 100%)
uint256 public burnShareBps = 2139;      // 21.39%
uint256 public lotteryShareBps = 6900;   // 69%
uint256 public creatorShareBps = 0;      // 0%
uint256 public protocolShareBps = 961;   // 9.61%
```

## Key Functions

### Receiving Fees

```solidity
// Receive OFT fees from ShareOFT
function receiveFees(uint256 amount) external;

// Receive WETH fees from V4 Tax Hook
function receiveWETHFees(uint256 amount) external;

// Direct deposit
function deposit(uint256 amount) external;
```

### WETH Fee Processing

WETH fees accumulate in `pendingWETHFees` and are processed via a swap (WETH → CreatorCoin) then deposited into the vault and distributed as vault shares.

```solidity
// Process pending WETH fees: WETH → CreatorCoin → Vault → Distribute
function processWETHFees() external;
```

Default MEV hardening behavior:
- Large WETH swaps are not permissionless by default (owner/keeper only).
- Permissionless execution can be enabled for small batches via a cap.
- Auto-processing on fee intake is disabled by default.

Relevant config (owner-only):
- `setWethFeeKeeper(address keeper)` (optional)
- `setWethProcessingConfig(uint256 maxPermissionlessWethProcess, bool autoProcessWethFees)`

### Distribution

```solidity
// Distribute accumulated fees (permissionless)
function distribute() external;

// Force distribution (owner only, bypasses time check)
function forceDistribute() external onlyOwner;
```

### Jackpot Management

```solidity
// Pay jackpot to lottery winner (only lottery manager)
function payJackpot(address winner, uint256 shares) external;

// Get available jackpot reserve
function getJackpotReserve() external view returns (uint256);
```

### Configuration

```solidity
// Update fee split (must total 100%)
function setFeeSplit(
    uint256 burnBps,
    uint256 lotteryBps,
    uint256 creatorBps,
    uint256 protocolBps
) external onlyOwner;

// Update creator treasury (can be zero only when creatorShareBps == 0)
function setCreatorTreasury(address treasury) external onlyOwner;
```

Invariant guard:
- If `creatorBps > 0`, creator treasury must be non-zero (`CreatorTreasuryRequired`).

## Distribution Flow

```
ShareOFT sends fees
   ↓
receiveFees() accumulates pending
   ↓
distribute() triggered (threshold or manual)
   ↓
Unwrap OFT → vault shares
   ↓
Split according to configuration:
   - 69% → jackpotReserve
   - 21.39% → burn (increases PPS)
   - creator% → creatorTreasury (if enabled)
   - protocol/voter branch → voterRewardsDistributor, protocol treasury, or fallback (config-dependent)
```

## Events

```solidity
event FeesReceived(address indexed from, uint256 amount);
event FeesDistributed(uint256 burned, uint256 toLottery, uint256 toCreator, uint256 toProtocol, uint256 newPPS);
event JackpotPaid(address indexed winner, uint256 shares);
```
