---
title: Launch checklist
sidebar_position: 2
---

# Launch checklist

End-to-end launch procedure for a **new** vault on Base (**v1.14.1**). Grandfathered vaults (e.g. AKITA) may follow prior deployment versions.

Overview: [Getting started](/getting-started) · Application: [app.4626.fun/deploy/vault](https://app.4626.fun/deploy/vault)

## Prerequisites

- [ ] Creator coin **live on Base** (typically via Zora)
- [ ] **50M–100M** creator coin available for activation deposit
- [ ] **4626 account** with execution-ready wallet signing
- [ ] **`vault_full_deploy` active** — [Strategy bundle](/guides/strategy-bundle) ($499 USDC); deploy remains gated until confirmed

## Launch procedure

| Step | Action | Outcome | Guide |
|------|--------|---------|-------|
| 1 | Pay **`vault_full_deploy`** | Deploy unlocked in application | [Strategy bundle](/guides/strategy-bundle) |
| 2 | Deploy contract stack | Vault, ShareOFT, gauge, oracle, CCA deployed | [Launch vault](/guides/launch-token) |
| 3 | Activate vault | Creator coin deposited; CCA started | [Activate vault](/guides/activate-vault) |
| 4 | CCA auction | Price discovery in progress | — |
| 5 | Finalize | Onchain completion; optional Pipe A Solana bridge | [Solana share mesh](/overview/solana-share-mesh) |
| 6 | Strategy attachment | Charm + Ajna deployed per bundle weights | [How it works](/overview/how-it-works) |

## Milestones

| Stage | State | Public trading on Base |
|-------|-------|------------------------|
| **Deployed** | Contracts onchain; vault unfunded | No |
| **Activated** | Deposit complete; CCA **in progress** | No — auction must complete |
| **Trading live** | CCA **complete**; `■` shares on DEX | Yes — fees and lottery on qualifying **buys** |

Activation alone does not constitute a trading-live state. Public secondary trading begins after the CCA completes.

## Base (hub chain) readiness

When trading live on Base:

- `■` ShareOFT is tradable on Base DEXs
- Qualifying ShareOFT **buys** may enter [CreatorLotteryManager](/contracts/utilities/lottery-manager)
- Trade fees route through [CreatorGaugeController](/contracts/governance/gauge-controller)

## Solana (optional)

Solana integration may follow Base launch and is not required for Base trading or lottery:

- Bridged asset is **`■` share**, not creator coin
- Pipe A bridge and Meteora provisioning may lag finalize
- Base lottery remains authoritative until Solana buy-relay is fully operational

## Contract reference

- Per-creator stack registered in [CreatorRegistry](/contracts/core/creator-registry) at deploy
- Shared infrastructure: [Contract addresses](/reference/addresses) (v1.14.1)

## Related documentation

[Getting started](/getting-started) · [How it works](/overview/how-it-works)
