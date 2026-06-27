---
title: Launch checklist
sidebar_position: 1
---

# Launch checklist

End-to-end checklist for a **new vault on Base** (v1.14.1). For legacy vaults, infrastructure may differ.

<div class="docs-at-a-glance">

**Prerequisites:** creator coin on Base · 50M–100M tokens for activation · signing ready · **launch bundle paid**.

**App:** [app.4626.fun/deploy/vault](https://app.4626.fun/deploy/vault)

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
| 3 | Activate vault | Deposit + **fair-launch auction** started | [Activate vault](/guides/activate-vault) |
| 4 | Auction runs | Price discovery in progress | [After activation](/guides/after-activation) |
| 5 | Finalize | Base settlement; `■` split 30/30/30/10 (incl. optional Solana bridge) | [After activation](/guides/after-activation) |
| 6 | Strategies attach | Charm 45% · Ajna 45% · 10% idle (automatic) | [How fees work](/overview/how-it-works) |

## Milestones

| Stage | State | Public trading on Base? |
|-------|-------|-------------------------|
| **Deployed** | Contracts onchain; vault unfunded | No |
| **Activated** | Deposited; **auction in progress** | No |
| **Trading live** | Auction + finalize complete | Yes — fees & lottery on qualifying **buys** |

Activation alone is **not** trading live. DEX secondary trading starts after the auction completes.

## When trading is live on Base

- `■` ShareOFT tradable on Base DEXs
- Qualifying **buys** may enter [CreatorLotteryManager](/contracts/utilities/lottery-manager)
- Trade fees route via [CreatorGaugeController](/contracts/governance/gauge-controller)

## Optional: Solana

Not required for Base launch or lottery:

- Only **`■` share** may bridge — not creator coin
- Bridge may complete after finalize; Meteora may lag
- Base lottery stays authoritative until Solana buy-relay is live

Details: [Optional: Solana trading](/overview/solana-share-mesh)

## Contracts

- Per-creator stack: [CreatorRegistry](/contracts/core/creator-registry)
- Shared infra: [Addresses](/reference/addresses) (v1.14.1)

## Related

[What is 4626?](/getting-started) · [After activation](/guides/after-activation) · [Glossary](/reference/glossary)
