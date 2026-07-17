---
title: 'Solana share bridge'
sidebar_label: Solana share bridge
sidebar_position: 3
slug: /overview/solana-share-mesh
---

# Solana share bridge

How tradable shares (`■TICKER`) reach Solana on a new vault launch — and what stays on Base.

<div class="docs-at-a-glance">

Every new vault bridges ~30% of `■` to Solana at Phase 2 finalize (LayerZero). Creator coin stays on Base. [Glossary](/reference/glossary#quick-definitions).

</div>

## Included in the launch bundle

No separate Solana purchase or app step.

| What | When | Creator action |
|------|------|----------------|
| **Bridge (~30% of `■`)** | Phase 2 finalize | None — automatic |
| **Meteora pool** | After finalize (operator) | None — in bundle |

Base trading and lottery do **not** wait for Meteora.

## What exists where

| Asset | Base | Solana |
|-------|------|--------|
| Creator coin (`$TICKER`) | Yes | **No** |
| Tradable share (`■TICKER`) | Yes (after trading live) | Yes (~30% at finalize) |

Solana gets bridged **ShareOFT**, not a separate creator-coin SPL. Symbol stays `■TICKER` on both chains.

## Timeline

1. [Deploy](/guides/launch-token) + [activate](/guides/activate-vault) on Base.
2. Phase 2 finalize — **30/30/30/10** split includes the Solana bridge.
3. Share auction runs → settle → **trading live** on Base.
4. Meteora may complete after finalize (operator-assisted).

## Lottery

| Chain | Status |
|-------|--------|
| **Base** | Live when trading is live — qualifying DEX **buys** |
| **Solana** | Planned — Base stays authoritative until relay is live |

Wraps, deposits, and bridge receipts do **not** create lottery entries.

[CreatorShareOFT](/contracts/core/creator-share-oft) · [Addresses](/reference/addresses) · [After activation](/guides/after-activation)
