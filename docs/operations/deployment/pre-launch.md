---
title: Pre-launch verification
sidebar_position: 1
---

# Pre-launch verification

This checklist is the source of truth for launching a Creator Vault on Base.

**Who this is for:** Protocol operators preparing for vault launch.

---

## 1. Contract addresses

Verify `frontend/src/config/contracts.ts` contains correct addresses for:

| Contract | Config key |
|----------|------------|
| Creator token | `AKITA.token` |
| Vault | `AKITA.vault` |
| Wrapper | `AKITA.wrapper` |
| Share OFT | `AKITA.shareOFT` |
| Gauge controller | `AKITA.gaugeController` |
| CCA strategy | `AKITA.ccaStrategy` |
| Oracle | `AKITA.oracle` |
| Vault activation batcher | `CONTRACTS.vaultActivationBatcher` |
| Strategy deployment batcher | `CONTRACTS.strategyDeploymentBatcher` |
| Pool manager | `CONTRACTS.poolManager` |
| Tax hook | `CONTRACTS.taxHook` |

---

## 2. Symbol grammar (blocking)

Confirm on-chain metadata matches the standard:

| Token type | Symbol format | Example |
|------------|---------------|---------|
| Vault shares | `▢{COIN}` | ▢AKITA |
| Wrapped share token (ShareOFT) | `■{COIN}` | ■AKITA |

---

## 3. Strategy deployment and configuration

Strategies must be deployed and added before the initial deposit.

### Admin UI (recommended)

- Route: `/admin/deploy-strategies`
- Requires vault management permissions

### Required parameters

| Parameter | Default value |
|-----------|---------------|
| Charm (CREATOR/USDC) weight | 6900 |
| Ajna weight | 2139 |
| Minimum total idle | 4,805,000 × 10^18 (9.61% of 50M) |

### On-chain verification

```solidity
vault.getStrategyCount()              // Expected: 2
vault.strategyWeights(charmStrategy)  // Expected: 6900
vault.strategyWeights(ajnaStrategy)   // Expected: 2139
vault.minimumTotalIdle()              // Expected: 4_805_000e18
```

---

## 4. Activation flow

Activation uses the on-chain `VaultActivationBatcher` via the `LaunchVaultAA` frontend component.

### Why this matters

- The vault uses ERC-4626 virtual shares/offsets
- You cannot safely hardcode `wrap(depositAmount)` client-side
- The batcher correctly uses the returned share amount from `deposit()` and wraps that

### User flow

1. Approve creator token to `VaultActivationBatcher`
2. Call `VaultActivationBatcher.batchActivate(...)` (batched in AA when supported)

---

## 5. Post-activation yield deployment

Activation does not call `vault.deployToStrategies()`.

After launch, a keeper/owner/management should call:
- `vault.deployToStrategies()` or `vault.tend()`

---

## 6. Day 7+ completion

After the auction is graduated:

1. Call `CCALaunchStrategy.sweepCurrency()` (permissionless)
2. Configure the tax hook via `TaxHook.setTaxConfig(...)` (token owner required)

The frontend `CompleteAuction.tsx` implements this flow.

---

## 6b. LBPStrategyWithTaxHook path (alternative)

If using the Liquidity Launcher-style path:

1. Sweep raised currency from auction to strategy: `auction.sweepCurrency()`
2. Migrate liquidity into V4: `LBPStrategyWithTaxHook.migrate()` after `migrationBlock`
3. Configure tax hook using pool ID derived from exact V4 `PoolKey`

---

## References

- [Approvals checklist](./approvals-checklist.md)
- [CCA verification](./cca-verification.md)
- [Launch verification](./launch/verification.md)
