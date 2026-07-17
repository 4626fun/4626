---
title: Launch checklist
sidebar_position: 1
slug: /guides/launch-checklist
---

# Launch checklist

End-to-end checklist for a **new vault on Base** (v1.19.1).

<div class="docs-at-a-glance">

Creator coin on Base · 50M–100M for activation · signing ready · launch bundle paid.

[app.4626.fun/deploy/vault](https://app.4626.fun/deploy/vault)

</div>

## Prerequisites

- [ ] Creator coin **live on Base** (typically Zora)
- [ ] **50M–100M** creator coin for activation
- [ ] **4626 account** with execution-ready signing
- [ ] **Launch bundle active** ($499 USDC) — [Pay launch fee](/guides/strategy-bundle)

## Procedure

| Step | Action | Outcome | Guide |
|------|--------|---------|-------|
| 1 | Pay launch bundle | Deploy unlocked | [Pay launch fee](/guides/strategy-bundle) |
| 2 | Deploy stack | Vault, shares, gauge, oracle, auction | [Deploy](/guides/launch-token) |
| 3 | Activate | Deposit + strategies + auction scheduled | [Activate](/guides/activate-vault) |
| 4 | Auction → settle | Price discovery → Uniswap v4 LP | [After activation](/guides/after-activation) |

**Trading live** = auction graduated + `sweepCurrency()` + `migrate()` + hook alignment — not activation alone.

## Milestones

| Stage | State | Trading on Base? |
|-------|-------|------------------|
| **Deployed** | Contracts onchain; unfunded | No |
| **Activated** | Deposited; auction scheduled or live | No |
| **Trading live** | Auction settled + `migrate()` done | Yes |

## When trading is live

- `■` tradable on Base DEXs
- Qualifying **buys** may enter the [lottery](/contracts/utilities/lottery-manager)
- Trade fees route via the [gauge](/contracts/governance/gauge-controller)

## Solana bridge

Included in the bundle (~30% of `■` at Phase 2 finalize). Creator coin stays on Base. [Solana share bridge](/overview/solana-share-mesh).

[What is 4626?](/getting-started) · [Addresses](/reference/addresses) · [Glossary](/reference/glossary)
