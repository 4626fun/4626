---
title: LotteryManager
sidebar_position: 1
---

# CreatorLotteryManager

Shared swap-based lottery service for ALL Creator Coins.

## Purpose

The CreatorLotteryManager:
- Processes lottery entries from DEX trades
- Integrates Chainlink VRF 2.5 for randomness
- Manages cross-chain winner notifications
- Distributes prizes from ALL active vaults

## Architecture

This is a **shared service** deployed once per chain that serves ALL Creator Coins by looking up contracts from the registry.

## Win Probability

**Formula**: $1 traded = 0.0004% instant win chance

| Trade Size | Win Chance |
|------------|------------|
| $1 | 0.0004% |
| $100 | 0.04% |
| $1,000 | 0.4% |
| $10,000 | 4% |

## Key Functions

### Lottery Entry

```solidity
// Process swap-based lottery entry (called by authorized swap contracts)
function processSwapLottery(
    address buyer,
    address tokenIn,
    uint256 amountIn
) external payable returns (uint256 entryId);
```

### VRF Callbacks

```solidity
// Local VRF callback
function receiveRandomWords(uint256 requestId, uint256[] memory randomWords) external;

// Cross-chain VRF callback
function receiveRandomWords(uint256[] memory randomWords, uint256 sequence) external;
```

### Configuration

```solidity
// Set lottery parameters
function setLotteryConfig(
    uint256 minSwap,
    uint256 rewardPercentage,
    bool isActive,
    uint256 baseWinChance,
    uint256 maxWinChance,
    uint256 usdMultiplierBps
) external onlyOwner;
```

## Prize Payout

Winners receive **69% of jackpot** from **ALL active creator vaults**:

```solidity
// Internal payout function
function _payoutLocalJackpot(
    address triggeringCoin,
    address winner,
    uint16 payoutBps  // 6900 = 69%
) internal returns (uint256 totalPaidOut);
```

## Boost Integration

The lottery supports ve(3,3) boosts:

```
FinalPPM = BasePPM × PersonalBoost + LockDurationBoostPPM + VaultGaugeBoostPPM
```

## Events

```solidity
event LotteryEntryCreated(address indexed creatorCoin, address indexed user, uint256 swapAmountUSD, uint256 winChancePPM, uint256 requestId);
event LotteryWinner(address indexed creatorCoin, address indexed user, uint256 swapAmountUSD, uint256 rewardAmount, uint256 requestId);
event MultiTokenJackpotWon(address indexed triggeringCoin, address indexed winner, uint256 numVaultsPaid);
```
