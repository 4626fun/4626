---
title: Solana share mesh
sidebar_position: 3
---

# Solana share mesh

Policy for **ShareOFT (`■TICKER`)** bridging to Solana and its relationship to lottery and trading on new vaults.

[Getting started](/getting-started) · [Launch checklist](/guides/greenfield-checklist)

## Solana requirement

**Solana is not required to launch on Base.** Base is the hub chain for deploy, CCA, secondary trading, and lottery for new vaults. Solana provides optional distribution for the **same tradable share** after finalize.

## Token mapping

| Asset | Solana presence |
|-------|-----------------|
| Creator coin (`$TICKER`) | **None** — remains on Base |
| Tradable share (`■TICKER`) | **Conditional** — ~30% of supply may bridge via Pipe A after finalize (LayerZero) |

Solana receives a bridged **ShareOFT**, not a separate creator-coin SPL. Symbol convention: `■TICKER` on both chains when bridged (e.g. `■AKITA`).

## Sequence

1. [Deploy](/guides/launch-token) and [activate](/guides/activate-vault) on Base
2. CCA completes
3. **Finalize** executes onchain; **Pipe A** may bridge a share slice to Solana
4. **Meteora** pool provisioning may follow (operator-assisted; included in [strategy bundle](/guides/strategy-bundle))

There is no separate creator-facing Solana deploy action — bridging is part of the post-auction finalize path.

## Lottery: Base vs Solana

| Chain | Status (new vaults) |
|-------|---------------------|
| **Base** | **Operational at launch** — ShareOFT DEX **buys** (`SwapOnly → non-SwapOnly`) may enter [CreatorLotteryManager](/contracts/utilities/lottery-manager) |
| **Solana** | **Planned** — policy targets secondary pool **buys** of the share mesh mint; Base lottery remains authoritative until relay is live |

Wraps, deposits, and bridge receipts do **not** generate lottery entries. Qualifying **buys** do.

## Contract reference

[CreatorShareOFT](/contracts/core/creator-share-oft) · [CreatorOVaultWrapper](/contracts/core/creator-ovault-wrapper) · [Contract addresses](/reference/addresses)
