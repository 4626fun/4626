---
title: GaugeController
sidebar_position: 1
---

# CreatorGaugeController

Fee splitter and gauge controller for creator vaults.

## Purpose

The GaugeController:
- Receives trading fees from ShareOFT
- Splits fees according to configured percentages
- Routes fees to lottery, burn, and voter rewards
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
```

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
   - 9.61% → voterRewardsDistributor
```

## Events

```solidity
event FeesReceived(address indexed from, uint256 amount);
event FeesDistributed(uint256 burned, uint256 toLottery, uint256 toCreator, uint256 toProtocol, uint256 newPPS);
event JackpotPaid(address indexed winner, uint256 shares);
```
