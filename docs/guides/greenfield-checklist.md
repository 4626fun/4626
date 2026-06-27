---
title: Greenfield checklist
sidebar_position: 2
---

# Greenfield checklist

End-to-end path for a **new** creator vault on Base (v1.14.1). Grandfathered vaults (e.g. AKITA) may differ.

## Before the app

| # | Requirement |
|---|-------------|
| 1 | **Creator coin** live on Base (typically via Zora) |
| 2 | **50M–100M** creator coin available for the vault deposit |
| 3 | **4626 account** with wallet signing ready in the app |
| 4 | **`vault_full_deploy`** active — [Strategy bundle](/guides/strategy-bundle) ($499 USDC) |

## Deploy journey

| Phase | What happens | Guide |
|-------|----------------|-------|
| **0 — Pay** | Activate strategy bundle in app | [Strategy bundle](/guides/strategy-bundle) |
| **1 — Deploy** | Atomic batch: vault, wrapper, ShareOFT, gauge, oracle, CCA | [Launch vault](/guides/launch-token) |
| **2 — Activate** | Deposit creator coin, wrap shares, start CCA auction | [Activate vault](/guides/activate-vault) |
| **2b — Finalize** | Auction completes; **~30% ShareOFT** can bridge to Solana (Pipe A) | [Solana share mesh](/overview/solana-share-mesh) |
| **3 — Strategies** | Charm + Ajna sleeves attach (paid bundle weights) | [How it works](/overview/how-it-works) |

Phases 1–2 are creator-driven in the app. Finalize and strategy attachment are onchain steps the app orchestrates after activation.

## What “live” means

**Base (always the hub)**

- Vault accepts deposits and mints ▢ shares
- CCA auction ran or is running
- **■ ShareOFT** trades on Base — **buys** can enter the [instant lottery](/contracts/utilities/lottery-manager)
- Trade fees route through the [gauge](/contracts/governance/gauge-controller)

**Solana (share mesh, optional depth)**

- Tradable Solana token is the **bridged ■ share**, not your creator coin
- Meteora pool + trading may follow Pipe A finalize
- Solana pool **buys** mirroring Base lottery is a later milestone — see [Solana share mesh](/overview/solana-share-mesh)

You do **not** need Solana lottery relay to launch on Base.

## Lookup & addresses

- Per-creator vault stack is registered in [CreatorRegistry](/contracts/core/creator-registry) at deploy
- Shared batcher, factories, modules: [live addresses](/reference/addresses) (v1.14.1)

## Related

- [Getting started](/getting-started) · [How it works](/overview/how-it-works)
- [Impairment disclosures](/reference/impairment-v1-disclosures) (integrators)
