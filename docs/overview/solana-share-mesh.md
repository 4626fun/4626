---
title: Solana share mesh
sidebar_position: 3
---

# Solana share mesh

**Do I need this to launch?** **No.** Base is the hub. Most creators go live on Base first; Solana is extra reach for the **same share token**.

Read [Getting started](/getting-started) if you’re new.

## The one thing to remember

Solana gets a **copy of your tradable share** (`■TICKER`) — **not** a copy of your Zora **creator coin**.

| Token | On Solana? |
|-------|------------|
| Creator coin (`$TICKER`) | **No** — stays on Base |
| Tradable share (`■TICKER`) | **Maybe** — after launch finalize bridges ~30% via LayerZero |

Same symbol idea: `■AKITA` on Base and `■AKITA` on Solana when bridged.

## When it happens

After your **auction finishes**, finalize can run **Pipe A**: part of your share supply bridges to Solana. **Meteora** pool setup (included in your [strategy bundle](/guides/strategy-bundle)) may follow so people can trade there.

You don’t click a separate “Solana deploy” — it’s part of the post-auction onchain path.

## Lottery: Base vs Solana

| Chain | Status for new vaults |
|-------|------------------------|
| **Base** | **Live at launch** — buying ■ shares on a Base DEX can enter the [lottery](/contracts/utilities/lottery-manager) |
| **Solana** | **Later** — goal is to mirror lottery on Solana pool **buys**; until then, use Base |

Wraps, deposits, and “I received bridged tokens” do **not** count as lottery entries — **buys** do.

## Simple timeline

1. [Deploy](/guides/launch-token) + [activate](/guides/activate-vault) on Base  
2. Auction completes  
3. Finalize may bridge shares to Solana  
4. Meteora trading may go live (operator-assisted)  
5. Base trading + lottery work the whole time  

Full checklist: [Launch checklist](/guides/greenfield-checklist).

## For developers

- [CreatorShareOFT](/contracts/core/creator-share-oft) · [Wrapper](/contracts/core/creator-ovault-wrapper)  
- [Contract addresses](/reference/addresses)
