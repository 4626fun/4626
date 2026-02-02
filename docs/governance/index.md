---
title: Governance
sidebar_position: 5
---

# Governance

The protocol uses ve(3,3) governance where token holders lock assets for voting power and direct lottery probability to vaults.

---

## Why participate

| Benefit | Mechanism |
|---------|-----------|
| Voting power | Direct lottery probability to preferred vaults |
| Fee share | Earn 9.61% of trading fees pro-rata |
| Bribes | Protocols pay for your votes |

---

## How it works

1. **Lock** ■TOKEN or ▢TOKEN in ve4626 (7 days to 4 years)
2. **Vote** for vaults each epoch (weekly)
3. **Earn** rewards from fees and bribes
4. **Claim** after epoch ends

Voting power decays linearly over the lock period.

---

## Epochs

Voting operates in 7-day epochs starting Thursday 00:00 UTC.

- Vote during the epoch
- Votes determine probability for that epoch
- Claim rewards after epoch ends

---

## Probability direction

Vaults with more votes give their buyers higher lottery win rates.

```
Vault votes / Total votes = Probability boost
```

---

## Contracts

| Contract | Purpose | Documentation |
|----------|---------|---------------|
| ve4626 | Lock tokens, get voting power | [API](/contracts/governance/ve4626) |
| VaultGaugeVoting | Cast and track votes | [API](/contracts/governance/vault-gauge-voting) |
| VoterRewardsDistributor | Claim fee rewards | [API](/api/contracts) |
| BribeDepot | External vote incentives | [API](/api/contracts) |

---

## Related

- [Fee Flow](/overview/fee-flow) - How fees are distributed
- [Lottery](/concepts/lottery) - Probability mechanics
