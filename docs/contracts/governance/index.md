---
title: Governance
sidebar_position: 3
---

# Governance contracts

Smart contract documentation for the ve(3,3) governance system.

For user-facing documentation, see [Governance](/governance).

---

## Contracts

| Contract | Purpose |
|----------|---------|
| [CreatorGaugeController](./gauge-controller) | Fee collection and distribution |
| [VaultGaugeVoting](./vault-gauge-voting) | Weekly epoch voting |
| [ve4626](./ve4626) | Vote-escrowed token |
| VoterRewardsDistributor | Epoch reward claims |
| BribeDepot | External vote incentives |

---

## Contract relationships

```
ve4626 holders
      │
      │ Vote for vaults
      ▼
┌─────────────────┐
│ VaultGaugeVoting│
│ (weekly epochs) │
└─────────────────┘
      │
      │ Directs probability
      ▼
┌─────────────────┐      ┌─────────────────┐
│ LotteryManager  │      │ GaugeController │
│ (jackpot draws) │◄─────│ (fee routing)   │
└─────────────────┘      └─────────────────┘
                                │
                                ▼
                         ┌─────────────────┐
                         │ VoterRewards    │
                         │ Distributor     │
                         └─────────────────┘
```

---

## Related

- [Governance](/governance) - User-facing documentation
- [Fee Flow](/overview/fee-flow) - Distribution mechanics
- [Lottery](/concepts/lottery) - Probability direction
