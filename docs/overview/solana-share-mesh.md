---
title: Solana share mesh
sidebar_position: 3
---

# Solana share mesh

**Do I need Solana to launch?** **No.** Launch and trade on Base first. Solana is optional extra reach for the **same ■ share**.

[Getting started](/getting-started) · [Launch checklist](/guides/greenfield-checklist)

## Remember this

| Token | On Solana? |
|-------|------------|
| Creator coin (`$TICKER`) | **No** — stays on Base |
| Tradable share (`■TICKER`) | **Maybe** — ~30% can bridge after finalize |

Solana gets a **bridged copy of your share**, not your Zora creator coin. Example: `■AKITA` on both chains when bridged.

## When it happens

1. You [deploy](/guides/launch-token) and [activate](/guides/activate-vault) on Base  
2. The **auction finishes**  
3. **Finalize** runs onchain — part of share supply can bridge via LayerZero  
4. **Meteora** pool trading may follow (included in [launch bundle](/guides/strategy-bundle))  

There is no separate “Solana deploy” button — this follows the auction.

## Lottery: Base vs Solana

| Chain | For new vaults |
|-------|----------------|
| **Base** | **Live** — DEX **buys** of ■ shares can enter the [lottery](/contracts/utilities/lottery-manager) |
| **Solana** | **Later** — target is pool **buys** on Solana; until then use Base |

Wraps, deposits, and receiving bridged tokens are **not** lottery entries. **Buys** are.

## Developers

[CreatorShareOFT](/contracts/core/creator-share-oft) · [Wrapper](/contracts/core/creator-ovault-wrapper) · [Addresses](/reference/addresses)
