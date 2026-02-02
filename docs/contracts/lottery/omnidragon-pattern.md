---
title: omniDRAGON pattern
sidebar_position: 1
---

# Lottery integration - omniDRAGON pattern

This document describes the lottery trigger pattern based on omniDRAGON.

**Who this is for:** Protocol engineers implementing lottery mechanics.

---

## Overview

The lottery trigger was simplified from 4 parameters to 3 parameters, matching the omniDRAGON pattern.

```solidity
// Old (4 params)
processSwapLottery(creatorCoin, trader, tokenIn, amountIn)

// New (3 params)
processSwapLottery(buyer, tokenIn, amountIn)
```

---

## Changes implemented

### 1. CreatorShareOFT.sol - Simplified lottery trigger

Key changes:
- Uses `tx.origin` to get actual buyer (not router)
- Removed `creatorCoin` parameter - lottery manager derives it
- Simplified interface
- Same security model as omniDRAGON

```solidity
/**
 * @dev Trigger lottery entry for buyer
 * @param amount Amount of tokens bought
 * @notice Uses tx.origin to get actual buyer since msg.sender is the DEX router.
 *         Only EOAs can win - prevents gaming via contracts.
 *         Users should only interact with trusted DEX frontends.
 */
function _triggerLottery(address, uint256 amount) internal {
    if (!lotteryEnabled) return;
    if (address(registry) == address(0)) return;
    
    // Use tx.origin to get actual buyer (recipient is router, not user)
    address buyer = tx.origin;
    
    // Only EOAs can win lottery - prevents gaming via contracts
    if (buyer.code.length > 0) return;
    
    address mgr = registry.getLotteryManager(uint16(block.chainid));
    if (mgr == address(0)) return;
    
    try ICreatorLotteryManager(mgr).processSwapLottery(buyer, address(this), amount) returns (uint256 id) {
        if (id > 0) emit LotteryTriggered(buyer, amount, id);
    } catch {
        // Lottery failure should not block the transfer
    }
}
```

### 2. CreatorLotteryManager.sol

Function signature:

```solidity
function processSwapLottery(
    address buyer,      // From tx.origin (actual user)
    address tokenIn,    // ShareOFT being bought (■AKITA)
    uint256 amountIn    // Amount purchased
) external payable returns (uint256 entryId)
```

Internal logic:

```solidity
// Derive creator coin from ■TOKEN (reverse lookup)
address creatorCoin = registry.getTokenForShareOFT(tokenIn);
if (creatorCoin == address(0)) {
    return 0;  // Silently skip unregistered
}
// Rest of lottery logic unchanged
```

### 3. CreatorRegistry.sol

Uses existing function:

```solidity
/// @notice Get token address from ShareOFT
function getTokenForShareOFT(address _shareOFT) external view returns (address) {
    return shareOFTToToken[_shareOFT];
}
```

### 4. Interface updates

**ICreatorLotteryManager:**

```solidity
interface ICreatorLotteryManager {
    function processSwapLottery(
        address buyer,
        address tokenIn,
        uint256 amountIn
    ) external payable returns (uint256);
}
```

**ICreatorRegistryLottery:**

```solidity
interface ICreatorRegistryLottery {
    function getTokenForShareOFT(address _shareOFT) external view returns (address);
    function getLotteryManager(uint16 _chainId) external view returns (address);
}
```

---

## Comparison

### Before (4 parameters)

```solidity
// ShareOFT had to know creatorCoin
address creatorCoin = ICreatorOVault(vault).asset();
processSwapLottery(creatorCoin, recipient, address(this), amount);
```

### After (3 parameters)

```solidity
// Lottery manager derives creatorCoin
address buyer = tx.origin;
processSwapLottery(buyer, address(this), amount);
```

---

## Benefits

1. **Simpler** - One less parameter to pass
2. **Correct buyer** - Uses `tx.origin` to get real user (not router)
3. **Cleaner separation** - ShareOFT doesn't need vault reference
4. **Consistent** - Matches omniDRAGON pattern exactly
5. **Safer** - Lottery manager controls coin resolution

---

## Flow diagram

```
User buys ■AKITA on Uniswap
  |
  v
Router calls ShareOFT.transfer()
  msg.sender = Router (0xabc...)
  tx.origin  = User (0xdef...)
  |
  v
ShareOFT._processBuy() [6.9% fee]
  |
  v
ShareOFT._triggerLottery()
  buyer = tx.origin (actual user)
  tokenIn = address(this) (■AKITA)
  amount = tokens bought
  |
  v
LotteryManager.processSwapLottery(buyer, tokenIn, amount)
  |
  v
creatorCoin = registry.getTokenForShareOFT(tokenIn)
  returns AKITA
  |
  v
Create lottery entry for AKITA ecosystem
```

---

## References

- [Multi-token jackpot](./multi-token-jackpot.md)
- [Integration fix](./integration-fix.md)
