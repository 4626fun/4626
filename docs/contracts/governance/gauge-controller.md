---
title: CreatorGaugeController
sidebar_position: 1
---

# CreatorGaugeController

Fee collection and distribution hub for creator vaults.

**Source:** `contracts/governance/CreatorGaugeController.sol`

---

## Overview

CreatorGaugeController receives trading fees from ShareOFT and distributes them to lottery, burn, and voter allocations. It serves as the central fee routing contract.

---

## Fee flow

```
■TOKEN fees (6.9% of buys)
        │
        ▼
┌─────────────────────┐
│  GaugeController    │
│   receiveFees()     │
└─────────────────────┘
        │
        │ When threshold reached:
        ▼
┌─────────────────────┐
│    distribute()     │
└─────────────────────┘
        │
        ├─► 69% → LotteryManager.addToJackpot()
        │
        ├─► 21.39% → Unwrap → Vault.burnSharesForPriceIncrease()
        │
        └─► 9.61% → VoterRewardsDistributor.notifyRewards()
```

---

## Functions

### Fee reception

```solidity
// Called by ShareOFT when fees collected
function receiveFees(uint256 amount) external;

// Receive WETH from V4 tax hook
function receiveWETHFees() external payable;
```

### Distribution

```solidity
// Manual distribution trigger
function distribute() external;

// Force distribution (management)
function forceDistribute() external;

// Distribute WETH fees
function distributeWETH() external;
```

### Configuration

```solidity
// Set fee split (management)
function setFeeSplit(
    uint256 _burnShareBps,
    uint256 _lotteryShareBps,
    uint256 _creatorShareBps,
    uint256 _protocolShareBps
) external;

// Set distribution parameters
function setDistributionThreshold(uint256 threshold) external;
function setDistributionInterval(uint256 interval) external;

// Set recipients
function setLotteryManager(address manager) external;
function setCreatorTreasury(address treasury) external;
function setProtocolTreasury(address treasury) external;
function setVoterRewardsDistributor(address distributor) external;
```

### View functions

```solidity
// Current pending fees
function pendingFees() external view returns (uint256);
function pendingWETH() external view returns (uint256);

// Jackpot reserve
function jackpotReserve() external view returns (uint256);

// Lifetime stats
function totalFeesReceived() external view returns (uint256);
function totalSharesBurned() external view returns (uint256);
function totalLotteryFunded() external view returns (uint256);
```

---

## State

### Fee allocation

```solidity
uint256 public burnShareBps = 2139;      // 21.39%
uint256 public lotteryShareBps = 6900;   // 69%
uint256 public creatorShareBps = 0;      // 0%
uint256 public protocolShareBps = 961;   // 9.61%
```

### Distribution parameters

```solidity
uint256 public distributionThreshold = 100e18;  // 100 ■TOKEN
uint256 public distributionInterval = 1 hours;
uint256 public lastDistribution;
```

### Recipients

```solidity
ICreatorLotteryManager public lotteryManager;
IVoterRewardsDistributor public voterRewardsDistributor;
address public creatorTreasury;
address public protocolTreasury;
```

### Accounting

```solidity
uint256 public pendingFees;
uint256 public pendingWETH;
uint256 public jackpotReserve;

uint256 public totalFeesReceived;
uint256 public totalSharesBurned;
uint256 public totalLotteryFunded;
uint256 public totalCreatorEarned;
uint256 public totalProtocolEarned;
```

---

## Distribution logic

### Threshold check

```solidity
function _shouldDistribute() internal view returns (bool) {
    return pendingFees >= distributionThreshold &&
           block.timestamp >= lastDistribution + distributionInterval;
}
```

### Split calculation

```solidity
function distribute() external {
    uint256 fees = pendingFees;
    pendingFees = 0;
    
    uint256 burnAmount = (fees * burnShareBps) / MAX_BPS;
    uint256 lotteryAmount = (fees * lotteryShareBps) / MAX_BPS;
    uint256 voterAmount = (fees * protocolShareBps) / MAX_BPS;
    
    // Burn shares to increase PPS
    _burnForPriceIncrease(burnAmount);
    
    // Add to lottery jackpot
    _addToLottery(lotteryAmount);
    
    // Notify voter rewards
    _distributeToVoters(voterAmount);
}
```

---

## WETH handling

For V4 tax hook fees paid in ETH:

```solidity
function distributeWETH() external {
    uint256 wethAmount = pendingWETH;
    pendingWETH = 0;
    
    // Swap WETH → TOKEN
    uint256 tokenAmount = _swapWETHForToken(wethAmount);
    
    // Deposit to vault
    uint256 shares = vault.deposit(tokenAmount, address(this));
    
    // Distribute as vault shares
    _distributeShares(shares);
}
```

---

## Events

```solidity
event FeesReceived(uint256 amount);
event WETHFeesReceived(uint256 amount);
event FeesDistributed(
    uint256 burned,
    uint256 lottery,
    uint256 voters,
    uint256 creator
);
event JackpotFunded(uint256 amount);
event SharesBurned(uint256 amount, uint256 newPPS);
```

---

## Integration

### For ShareOFT

```solidity
// In ShareOFT._processBuy()
_approve(address(this), gaugeController, feeAmount);
gaugeController.receiveFees(feeAmount);
```

### For keepers

```solidity
// Check if distribution needed
if (gaugeController.pendingFees() >= threshold) {
    gaugeController.distribute();
}

// Distribute WETH if accumulated
if (gaugeController.pendingWETH() > 0) {
    gaugeController.distributeWETH();
}
```

---

## Related

- [Fee Flow](/overview/fee-flow) - Distribution explained
- [Lottery](/concepts/lottery) - Jackpot mechanics
- [VaultGaugeVoting](./vault-gauge-voting) - Voter rewards
