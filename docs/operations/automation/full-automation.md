---
title: Full Automation
sidebar_position: 2
---

# Full Automation Setup

Complete automation for 4626 operations.

## Components

1. **Keeper Bot** - Profit reporting, distributions
2. **Scheduler (Gelato or equivalent)** - Scheduled tasks
3. **Monitoring** - Alert on issues

## Gelato Setup

```javascript
// Register Gelato task
await gelato.createTask({
  execAddress: keeperContract,
  execSelector: "tick()",
  resolverAddress: resolver,
  interval: 3600 // hourly
});
```

## Scheduler-Compatible Upkeep Contract

```solidity
contract VaultAutomation {
  function checkUpkeep(bytes calldata) external view returns (bool, bytes memory) {
    return (shouldPerformUpkeep(), "");
  }
  
  function performUpkeep(bytes calldata) external {
    // Execute keeper tasks
  }
}
```
