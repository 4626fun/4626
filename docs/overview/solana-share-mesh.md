---
title: Solana share mesh
sidebar_position: 3
---

# Solana share mesh

How **■ share tokens** reach Solana and how that relates to lottery and trading.

## One sentence

Solana gets a **bridged copy of your Base ShareOFT** (`■TICKER`) — not a separate creator-coin SPL and not a re-deposit of creator coin.

## What creators should know

| Topic | Policy |
|-------|--------|
| **Symbol** | `■` + ticker on Base and Solana (e.g. `■AKITA`) |
| **When it bridges** | **Pipe A** at Phase 2 **finalize** — about **30%** of ShareOFT supply can auto-bridge when batcher OVault runtime is enabled |
| **Creator coin on Solana** | Your Zora creator coin stays **Base-only** today; do not expect `$TICKER` creator SPL as the tradable share |
| **Meteora** | Pools use the **share mesh mint**; operator-provisioned post-deploy (included in [strategy bundle](/guides/strategy-bundle)) |

## Lottery: Base vs Solana

**Base (live at launch)** — [CreatorLotteryManager](/contracts/utilities/lottery-manager) entries fire on **ShareOFT DEX buys** on Base (`SwapOnly → non-SwapOnly`). Wraps, deposits, and bridge receipts do **not** enter.

**Solana (later milestone)** — Policy is to mirror **secondary pool buys** of the tradable share mesh token, not primary mint or bridge receipt. Until that relay path is fully live, treat **Base lottery as canonical** for your vault.

Details: [Greenfield checklist — what live means](/guides/greenfield-checklist#what-live-means).

## Two lanes (do not mix them)

```text
Share mesh (active)     Base ShareOFT ──LayerZero──► Solana ■ share ──► Meteora trading
Compose deposit (dormant) Would bridge creator coin → Base shares; not configured for greenfield today
```

Legacy bridge-wrapped **creator SPL** (old adapter path) is **not** the share-lottery surface.

## Creator checklist tie-in

1. [Deploy](/guides/launch-token) + [activate](/guides/activate-vault) on Base  
2. CCA auction completes → finalize can run Pipe A bridge  
3. Solana pool/trading may follow (operator + Meteora entitlement)  
4. Base ShareOFT trading + lottery work without waiting on Solana relay  

Full deploy order: [Greenfield checklist](/guides/greenfield-checklist).

## Contracts & infra

- [CreatorShareOFT](/contracts/core/creator-share-oft) · [Wrapper](/contracts/core/creator-ovault-wrapper)
- Shared adapter + batcher: [addresses](/reference/addresses)
