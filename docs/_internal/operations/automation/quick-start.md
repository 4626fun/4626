---
title: Quick Start
sidebar_position: 1
---

# Automation Quick Start

Get started with automated operations.

## Keeper Bot

Set up a keeper to:
- Report strategy profits
- Trigger fee distributions
- Complete auctions

## Setup

1. Deploy keeper contract or use EOA
2. Grant keeper role on vault
3. Schedule periodic calls

## Basic Script

```javascript
// Keeper script example
async function keeperTick() {
  // Check if distribution needed
  if (await gaugeController.shouldDistribute()) {
    await gaugeController.distribute();
  }
  
  // Report strategy profits
  for (const strategy of strategies) {
    await strategy.report();
  }
}
```
