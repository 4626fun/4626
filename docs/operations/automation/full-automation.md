---
title: Full automation
sidebar_position: 1
---

# Full automation

This document describes the fully automated deployment flow for Creator Vault strategies.

**Who this is for:** Protocol engineers deploying vaults without manual intervention.

---

## Overview

The `StrategyDeploymentBatcher` enables single-transaction deployment where:
- No manual acceptance steps are required
- The creator receives immediate ownership
- Rebalance is called automatically after deployment

---

## Requirements met

| Requirement | Implementation |
|-------------|----------------|
| Full automation | Single transaction, no manual steps |
| Creator ownership | Pass creator address as `owner` parameter |
| Auto-rebalance | Called automatically after vault deployment |

---

## Implementation details

### CharmAlphaVaultDeploy contract

Location: `contracts/vault/strategies/univ3/CharmAlphaVaultDeploy.sol`

A simplified version of CharmAlphaVault with:
- Single-step governance transfer (no acceptance needed)
- `initializeAndTransfer()` function for atomic setup
- Embedded rebalance logic

```solidity
// Deploy with batcher as temp governance
constructor(pool, fee, cap, name, symbol)

// Atomically configure rebalance params + do an initial rebalance + transfer to creator
function initializeAndTransfer(
    newGovernance,
    newKeeper,
    baseThreshold,
    limitThreshold,
    maxTwapDeviation,
    twapDuration
) external onlyGovernance { /* ... */ }
```

### StrategyDeploymentBatcher updates

Location: `contracts/helpers/batchers/StrategyDeploymentBatcher.sol`

```solidity
// 1. Deploy vault (batcher is temp governance)
CharmAlphaVaultDeploy vault = new CharmAlphaVaultDeploy(...)

// 2. Atomically configure embedded rebalance params + transfer governance/keeper to creator
vault.initializeAndTransfer(creator, creator, 3000, 6000, 100, 1800)

// Creator owns everything immediately
```

---

## Usage

### Single transaction deployment

```solidity
DeploymentResult memory result = batcher.batchDeployStrategies(
    CREATOR_TOKEN,                  // Your creator token
    USDC,                           // 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
    VAULT_ADDRESS,                  // Your CreatorOVault
    AJNA_FACTORY,                   // Or address(0)
    3000,                           // 0.3% fee tier
    sqrtPriceX96,                   // Initial price
    CREATOR_ADDRESS                 // Creator owns everything
);
```

---

## Deployment flow

```
User calls batchDeployStrategies(creator)
              |
              v
STEP 1: Create/Init V3 Pool (CREATOR/USDC on Uniswap V3)
              |
              v
STEP 2: Deploy CharmAlphaVaultDeploy (Governance = batcher temporarily)
              |
              v
STEP 3: Configure embedded rebalance (Keeper = creator)
              |
              v
STEP 4: Initialize and transfer (Atomic operation)
              |
              v
STEP 5: Auto-rebalance (Trigger initial rebalance)
              |
              v
STEP 6: Deploy CreatorCharmStrategy (Owner = creator)
              |
              v
STEP 7: Initialize approvals (Enable swaps for single-sided deposits)
              |
              v
STEP 8: Deploy AjnaStrategy (Optional, Owner = creator)
              |
              v
COMPLETE - Everything owned by creator
```

---

## Ownership table

| Contract | Owner | Transfer timing |
|----------|-------|-----------------|
| CharmAlphaVaultDeploy | Creator | Immediate (no acceptance needed) |
| CreatorCharmStrategy | Creator | Immediate |
| AjnaStrategy | Creator | Immediate |

---

## Comparison: Before and after

| Aspect | Before | After |
|--------|--------|-------|
| Ownership transfer | Two-step (manual acceptance) | Single-step (automated) |
| Rebalance | Manual call needed | Automatic |
| Transactions needed | 2 (deploy + accept) | 1 (fully automated) |
| Creator involvement | Must call acceptGovernance() | None required |

---

## Verification

After deployment, verify everything worked:

```solidity
// 1. Check ownership (should all be creator)
assert(CharmAlphaVaultDeploy(charmVault).governance() == creator);
assert(CreatorCharmStrategy(creatorCharmStrategy).owner() == creator);
assert(AjnaStrategy(ajnaStrategy).owner() == creator);

// 2. Check strategy is set
assert(CharmAlphaVaultDeploy(charmVault).strategy() == charmVault);

// 3. Check rebalance was called (positions should exist)
(int24 baseLower, int24 baseUpper, , ) = CharmAlphaVaultDeploy(charmVault).getTicks();
assert(baseLower != 0 || baseUpper != 0);
```

---

## Security notes

### Single-step transfer safety

The single-step transfer is safe because:
1. The batcher verifies `owner != address(0)`
2. The transfer happens atomically (cannot be front-run)
3. The creator is explicitly specified in the transaction
4. If wrong address is passed, creator can redeploy (no funds at risk)

### Production considerations

The creator should verify their address before calling. For production deployments, consider using a multisig for additional security.

---

## Files changed

1. `contracts/vault/strategies/univ3/CharmAlphaVaultDeploy.sol` - New file
2. `contracts/helpers/batchers/StrategyDeploymentBatcher.sol` - Updated

---

## References

- [Quick start guide](./quick-start.md)
- [Completion options](./completion-options.md)
- [Pre-launch checklist](/operations/deployment/pre-launch)
