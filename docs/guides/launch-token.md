---
title: 'Step 2: Deploy contracts'
sidebar_position: 3
---

# Step 2: Deploy contracts

Deploy the per-creator contract stack in one transaction. **No creator coin moves yet** — funding is [Step 3](/guides/activate-vault).

<div class="docs-at-a-glance">

| | |
|---|---|
| **You do** | Configure names · submit Deploy in app |
| **4626 does** | Deploy vault, shares, gauge, oracle, auction via shared batcher (v1.14.1) |
| **Done when** | Milestone **Deployed** — vault exists, unfunded |
| **Requires** | Launch bundle active |

</div>

[Launch checklist](/guides/greenfield-checklist) · [Step 1: Pay launch fee](/guides/strategy-bundle)

## Before deploy

- Launch bundle **active**
- Creator coin address confirmed in app
- **50M–100M** creator coin available for step 3
- Wallet signing ready

## In the app

1. **[app.4626.fun/deploy/vault](https://app.4626.fun/deploy/vault)**
2. Sign in · confirm creator coin
3. Set vault / share names (e.g. `▢AKITA`, `■AKITA`)
4. Submit **Deploy** · wait for confirmation

Sponsored smart-wallet execution may apply where configured.

## What gets deployed

| Component | Role |
|-----------|------|
| CreatorOVault | ERC-4626 vault |
| Share tokens | `▢` vault shares + `■` ShareOFT |
| CreatorRegistry | Maps creator coin → stack |
| CreatorGaugeController | Fees & jackpot routing |
| CreatorOracle | TWAP pricing |
| CCA strategy | Fair-launch auction |

[Contracts](/contracts) · [Addresses](/reference/addresses)

## Onchain phases

Deploy is **Phase 1** only. Later app steps map to batcher phases:

| Phase | App step | Effect |
|-------|----------|--------|
| 1 | **Deploy** (this page) | Stack exists; vault unfunded |
| 2 | [Activate](/guides/activate-vault) | Deposit + wrap `■` + **30/30/30/10** split |
| 3 | Automatic | Charm 45% · Ajna 45% · 10% idle |
| 4 | After activation | CCA auction (Thursday 00:00 UTC schedule) |

[Deploy phases overview](/contracts#deploy-phases)

## Next

[Step 3: Activate vault](/guides/activate-vault)
