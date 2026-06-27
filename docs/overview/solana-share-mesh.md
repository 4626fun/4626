---
title: 'Optional: Solana trading'
sidebar_position: 3
slug: /overview/solana-share-mesh
---

# Optional: Solana trading

How **tradable shares (`■TICKER`)** may appear on Solana after a new vault launch — and what stays on Base only.

<div class="docs-at-a-glance">

**In one sentence:** Base is required; Solana is optional distribution of the **same share token** after the fair-launch auction completes and finalize runs.

**Internal names:** *Solana share mesh*, *Pipe A* (post-auction bridge). See [Glossary](/reference/glossary).

</div>

[Launch checklist](/guides/greenfield-checklist) · [After activation](/guides/after-activation)

## Is Solana required?

**No.** Base is the **primary chain** for deploy, fair-launch auction, secondary trading, and lottery on new vaults. Solana is an optional follow-on for the same tradable share.

## What exists on each chain

| Asset | Base | Solana |
|-------|------|--------|
| Creator coin (`$TICKER`) | Yes — vault deposit asset | **No** — creator coin stays on Base |
| Tradable share (`■TICKER`) | Yes — after trading is live | **Optional** — ~30% of supply may bridge after finalize |

Solana receives a bridged **ShareOFT**, not a separate creator-coin SPL token. Symbol stays `■TICKER` on both chains when bridged (e.g. `■AKITA`).

## Timeline (after activation)

| Order | Event | Creator action |
|-------|--------|----------------|
| 1 | [Deploy](/guides/launch-token) and [activate](/guides/activate-vault) on Base | Required |
| 2 | Fair-launch auction runs | Monitor in app |
| 3 | **Finalize** completes on Base | Usually automatic / in-app |
| 4 | **Post-auction Solana bridge** may send ~30% of `■` supply to Solana | None — part of finalize |
| 5 | Meteora pool setup may follow | None — operator-assisted (included in launch bundle) |

There is no separate “deploy to Solana” step in the application.

## Lottery: Base vs Solana

| Chain | Status (new vaults) |
|-------|---------------------|
| **Base** | **Live when trading is live** — qualifying ShareOFT DEX **buys** may enter [CreatorLotteryManager](/contracts/utilities/lottery-manager) |
| **Solana** | **Planned** — policy targets pool **buys** of the bridged share; Base lottery stays authoritative until relay is live |

Wraps, deposits, and bridge receipts do **not** create lottery entries. Qualifying **buys** do.

## Contract reference

[CreatorShareOFT](/contracts/core/creator-share-oft) · [CreatorOVaultWrapper](/contracts/core/creator-ovault-wrapper) · [Addresses](/reference/addresses)
