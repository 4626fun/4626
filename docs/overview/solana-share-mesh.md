---
title: 'Solana share bridge'
sidebar_label: Solana share bridge
sidebar_position: 3
slug: /overview/solana-share-mesh
---

# Solana share bridge

How **tradable shares (`■TICKER`)** reach Solana as part of a new vault deployment — and what stays on Base only.

<div class="docs-at-a-glance">

**In one sentence:** Every greenfield launch includes a **Solana share bridge** at Phase 2 finalize — ~30% of `■` supply crosses to Solana via LayerZero. Creator coin stays on Base.

**Internal names:** *Solana share mesh*, *Pipe A*. See [Glossary](/reference/glossary).

</div>

[Launch checklist](/guides/greenfield-checklist) · [After activation](/guides/after-activation)

## Part of deployment, not an add-on

The **$499 launch bundle** includes Solana mesh + Meteora entitlement. There is no separate “enable Solana” purchase and no extra app step.

| What | When | Creator action |
|------|------|----------------|
| **Solana bridge leg** (~30% of `■`) | **Phase 2 finalize** (same activation session) | None — automatic |
| **Meteora pool** on bridged `■` | Operator-provisioned after finalize | None — included in bundle |

Base DEX trading and lottery do **not** wait for Meteora — they follow auction graduation on Base. The Solana bridge still runs at finalize as part of the standard deploy path.

## What exists on each chain

| Asset | Base | Solana |
|-------|------|--------|
| Creator coin (`$TICKER`) | Yes — vault deposit asset | **No** — creator coin stays on Base |
| Tradable share (`■TICKER`) | Yes — after trading is live | Yes — bridged share at finalize (~30% of split) |

Solana receives a bridged **ShareOFT**, not a separate creator-coin SPL token. Symbol stays `■TICKER` on both chains (e.g. `■AKITA`).

## Timeline (after activation)

| Order | Event | Creator action |
|-------|--------|----------------|
| 1 | [Deploy](/guides/launch-token) and [activate](/guides/activate-vault) on Base | Required |
| 2 | **Phase 2 finalize** — **30/30/30/10** split includes Solana bridge | Sign in app |
| 3 | Fair-launch auction runs | Monitor in app |
| 4 | Settlement → **trading live** on Base | Usually automatic / in-app |
| 5 | Meteora pool on bridged `■` may complete | None — operator-assisted |

There is no separate “deploy to Solana” step in the application.

## Lottery: Base vs Solana

| Chain | Status (new vaults) |
|-------|---------------------|
| **Base** | **Live when trading is live** — qualifying ShareOFT DEX **buys** may enter [CreatorLotteryManager](/contracts/utilities/lottery-manager) |
| **Solana** | **Planned** — policy targets pool **buys** of the bridged share; Base lottery stays authoritative until relay is live |

Wraps, deposits, and bridge receipts do **not** create lottery entries. Qualifying **buys** do.

## Contract reference

[CreatorShareOFT](/contracts/core/creator-share-oft) · [CreatorOVaultWrapper](/contracts/core/creator-ovault-wrapper) · [Addresses](/reference/addresses)
