---
title: Launch checklist
sidebar_position: 1
slug: /guides/launch-checklist
---

# Launch checklist

End-to-end checklist for a **new vault on Base** (v1.14.1). For **legacy vaults** (older releases, e.g. AKITA), infrastructure may differ. See [Glossary — new vault launch](/reference/glossary#quick-definitions).

<div class="docs-at-a-glance">

Creator coin on Base · 50M–100M tokens for activation · signing ready · launch bundle paid.

[app.4626.fun/deploy/vault](https://app.4626.fun/deploy/vault)

</div>

## Prerequisites

- [ ] Creator coin **live on Base** (typically Zora)
- [ ] **50M–100M** creator coin for activation deposit
- [ ] **4626 account** with execution-ready signing
- [ ] **Launch bundle active** ($499 USDC) — [Pay launch fee](/guides/strategy-bundle)

## Launch procedure

| Step | Action | Outcome | Guide |
|------|--------|---------|-------|
| 1 | Pay **launch bundle** | Deploy unlocked in app | [Pay launch fee](/guides/strategy-bundle) |
| 2 | Deploy contract stack | Vault, shares, gauge, oracle, auction live | [Deploy contracts](/guides/launch-token) |
| 3 | Activate vault | Deposit + fair-launch auction **scheduled** (Phase 2–4 UserOps) | [Activate vault](/guides/activate-vault) |
| 4 | Phase 3 strategies | Charm **45%** · Ajna **45%** · **10% idle** (same activation session) | [Activate vault](/guides/activate-vault) |
| 5 | Auction runs | Price discovery (scheduled → live → graduate) | [After activation](/guides/after-activation) |
| 6 | Settlement | `sweepCurrency()` + `migrate()` → Uniswap v4 LP | [After activation](/guides/after-activation#when-is-trading-live-on-base) |

**Trading live** requires auction graduation + sweep + migrate + hook alignment — not activation alone. [After activation](/guides/after-activation#when-is-trading-live-on-base)

## Milestones

| Stage | State | Public trading on Base? |
|-------|-------|-------------------------|
| **Deployed** | Contracts onchain; vault unfunded | No |
| **Activated** | Deposited; **Phase 2–4 complete**; auction scheduled or live | No |
| **Trading live** | Auction graduated + `migrate()` complete | Yes — fees & lottery on qualifying **buys** |

Activation alone is **not** trading live. DEX secondary trading starts after the auction completes.

## When trading is live on Base

- `■` ShareOFT tradable on Base DEXs
- Qualifying **buys** may enter [CreatorLotteryManager](/contracts/utilities/lottery-manager)
- Trade fees route via [CreatorGaugeController](/contracts/governance/gauge-controller)

## Solana share bridge

Included in the launch bundle — not a separate add-on:

- **~30% of `■`** bridges automatically at Phase 2 finalize (LayerZero)
- Only the **share** crosses — not creator coin
- Meteora pool setup may complete after finalize
- Base trading and lottery do not wait for Meteora

Details: [Solana share bridge](/overview/solana-share-mesh)

## Contracts

- Per-creator stack: [CreatorRegistry](/contracts/core/creator-registry)
- Shared infra: [Addresses](/reference/addresses) (v1.14.1)

## Related

[What is 4626?](/getting-started) · [After activation](/guides/after-activation) · [Glossary](/reference/glossary)
