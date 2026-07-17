---
title: 'Step 2: Deploy contracts'
sidebar_position: 3
---

# Step 2: Deploy contracts

Deploy the per-creator stack in one transaction. **No creator coin moves yet** — funding is [Step 3](/guides/activate-vault).

<div class="docs-at-a-glance">

| | |
|---|---|
| **You do** | Set names · submit Deploy |
| **4626 does** | Deploy vault, shares, gauge, oracle, auction (v1.19.1 batcher) |
| **Done when** | **Deployed** — vault exists, unfunded |
| **Requires** | Launch bundle active |

</div>

## Before deploy

- Launch bundle **active**
- Creator coin address confirmed
- **50M–100M** ready for activation
- Wallet signing ready

## In the app

1. Open **[app.4626.fun/deploy/vault](https://app.4626.fun/deploy/vault)**
2. Confirm creator coin
3. Set vault / share names (e.g. `▢AKITA`, `■AKITA`)
4. Submit **Deploy** · wait for confirmation

## What gets deployed

| Component | Role |
|-----------|------|
| CreatorOVault | ERC-4626 vault |
| Share tokens | `▢` vault shares + `■` ShareOFT |
| Registry4626 | Creator coin → stack |
| CreatorGaugeController | Fees & jackpot |
| CreatorOracle | TWAP |
| CCA launch arm | Share auction |

Stack reference: [Contracts](/contracts) · [Addresses](/reference/addresses).

## Deploy phases

| Phase | App step | Effect |
|-------|----------|--------|
| 1 | **Deploy** (this page) | Stack exists; unfunded |
| 2 | [Activate](/guides/activate-vault) | Deposit + wrap + **30/30/30/10** |
| 3 | Automatic | Charm 45% · Ajna 45% · 10% idle |
| 4 | After activation | Auction scheduled → live → graduate |

Prev: [Step 1: Pay launch fee](/guides/strategy-bundle) · Next: [Step 3: Activate vault](/guides/activate-vault)
