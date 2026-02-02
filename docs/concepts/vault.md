---
title: Vault
sidebar_position: 1
---

# ERC-4626 vault

The vault accepts creator coin deposits and issues shares representing proportional ownership of all vault assets.

---

## How it works

1. User deposits TOKEN into vault
2. Vault issues ▢TOKEN shares proportional to deposit
3. Vault deploys idle capital to yield strategies
4. As strategies generate returns, share value increases
5. User redeems shares for TOKEN plus accumulated yield

---

## Share pricing

Shares represent a claim on underlying assets:

```
shareValue = totalAssets / totalSupply
```

As the vault earns yield, `totalAssets` increases while `totalSupply` stays constant, increasing `shareValue`.

---

## Strategy deployment

The vault allocates capital to yield strategies:

| Allocation | Destination |
|------------|-------------|
| Configurable % | Yield strategies (Charm, Ajna, V4) |
| Remainder | Idle buffer for withdrawals |

Keepers call `deployToStrategies()` to move idle capital into strategies.

---

## Withdrawal mechanics

**Small withdrawals:** Instant from idle buffer or strategies.

**Large withdrawals:** Queued for MEV protection. User calls `queueWithdrawal()`, waits, then claims.

**Flash loan protection:** Minimum 1 block delay between deposit and withdrawal.

---

## Profit unlocking

Profits unlock gradually over 7 days to prevent sandwich attacks on price-per-share.

---

## Security

| Protection | Purpose |
|------------|---------|
| Decimals offset | Prevents inflation attacks |
| Minimum first deposit | Prevents dust manipulation |
| Price change limit | Prevents PPS manipulation |
| Withdrawal delay | Prevents flash loans |

---

## Related

- [CreatorOVault API](/contracts/core/creator-ovault) - Function signatures and state
- [Token Model](/overview/token-model) - ▢TOKEN explained
- [Strategies](/contracts/strategies) - Strategy implementations
