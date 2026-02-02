---
title: Quick start
sidebar_position: 2
---

# Automated deployment quick start

Single-transaction deployment for Creator Vault strategies.

**Who this is for:** Developers deploying vaults quickly.

---

## Single transaction deployment

```solidity
DeploymentResult memory result = StrategyDeploymentBatcher(BATCHER_ADDRESS).batchDeployStrategies(
    CREATOR_TOKEN_ADDRESS,                             // Your token
    0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913,       // USDC on Base
    VAULT_ADDRESS,                                     // Your CreatorOVault
    AJNA_FACTORY_OR_ZERO,                              // Ajna factory (or address(0))
    3000,                                              // 0.3% fee tier
    SQRT_PRICE_X96,                                    // Initial price (99/1 ratio)
    CREATOR_ADDRESS                                    // Creator becomes owner
);
```

---

## What gets deployed

| Contract | Owner | Notes |
|----------|-------|-------|
| CharmAlphaVaultDeploy | `owner` param | Immediate ownership |
| CreatorCharmStrategy | `owner` param | Immediate ownership |
| AjnaStrategy | `owner` param | Immediate ownership |

All ownership is immediate with no manual acceptance required.

---

## Owner options

### Option 1: Creator address (recommended for creator platforms)

```solidity
owner: creatorAddress  // The person launching their token vault
```

Use when building a platform where creators own their own vaults.

### Option 2: Multisig address (recommended for protocol)

```solidity
owner: 0x7d429eCbdcE5ff516D6e0a93299cbBa97203f2d3  // Your multisig
```

Use when you want centralized control for all creator vaults.

### Option 3: Platform contract (advanced)

```solidity
owner: platformManagerAddress  // Smart contract that manages creators
```

Use when building complex platform logic.

---

## Calculating SQRT_PRICE_X96

For 99/1 CREATOR/USDC ratio:

```javascript
// 1 CREATOR = $0.01 (or 100 CREATOR per USDC)
const priceRatio = 100;
const sqrtPrice = Math.sqrt(priceRatio);
const sqrtPriceX96 = BigInt(Math.floor(sqrtPrice * 2**96));

// Adjust for decimals (CREATOR=18, USDC=6)
const decimalAdjustment = 10n ** 6n;
const adjustedSqrtPriceX96 = sqrtPriceX96 * decimalAdjustment;

console.log(adjustedSqrtPriceX96.toString());
```

---

## References

- [Full automation details](./full-automation.md)
- [Completion options](./completion-options.md)
