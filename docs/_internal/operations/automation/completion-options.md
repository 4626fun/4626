---
title: Completion Options
sidebar_position: 3
---

# Auction Completion Options

Options for handling CCA auction completion.

## Manual Completion

Owner/keeper manually triggers migration:

```solidity
ccaLaunchArm.migrate();
```

## Automated Completion

Use Gelato or another external scheduler to trigger when auction ends:

```solidity
function checkUpkeep() external view returns (bool) {
  return ccaLaunchArm.isAuctionEnded() && !ccaLaunchArm.isMigrated();
}

function performUpkeep() external {
  ccaLaunchArm.migrate();
}
```

## Post-Completion

After migration:
1. Liquidity added to Uniswap V4
2. Trading becomes active
3. 6.9% fee collection starts
