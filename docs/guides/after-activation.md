---
title: 'Step 4: After activation'
sidebar_position: 5
---

# Step 4: After activation

What happens after [Activate](/guides/activate-vault). Activation finalizes your deposit and share split — it does **not** open secondary DEX trading.

<div class="docs-at-a-glance">

Public DEX trading starts after the share auction completes and settlement succeeds on Base. Monitor in the [deploy app](https://app.4626.fun/deploy/vault).

</div>

## Right after activation

| Item | State |
|------|--------|
| Vault | Funded (50M–100M creator coin) |
| Share auction | **Scheduled or live** (Thursday 00:00 UTC epoch) |
| `■` on DEX | **Not yet** |
| Lottery | **Not yet** (needs qualifying live **buys**) |
| Milestone | **Activated** |

### Share allocation

| Leg | % | Notes |
|-----|---|--------|
| Auction | 30% | Open price discovery |
| Creator vesting | 30% | 365-day linear unlock |
| Solana bridge | 30% | LayerZero at finalize |
| LP reserve | 10% | Post-auction v4 migration |

## Timeline

| Step | What happens | Your action |
|------|----------------|-------------|
| Phase 2 finalize | Wrap + **30/30/30/10** | Sign in app |
| Phase 3 strategies | Charm 45% · Ajna 45% · 10% idle | Sign in app |
| Phase 4 launch | Auction scheduled | Sign in app |
| Auction live | Clearing price discovery | Monitor |
| Settlement | `sweepCurrency()` → `migrate()` | Keeper / app if prompted → **Trading live** |

## Trading live on Base {#when-is-trading-live-on-base}

Base is **trading live** when all succeed:

1. Auction **graduates** (minimum raise met)
2. `sweepCurrency()`
3. `migrate()` (Uniswap v4 LP from auction + LP reserve)
4. Hook / `tradeFeeCollector` aligned with gauge routing

Failed auction: `finalizeFailedAuction()` / `sweepUnsoldTokens()` clears state for relaunch. [CCA arm](/contracts/strategies/cca-launch).

Once live: `■` trades on Base DEXs; fees → [gauge](/contracts/governance/gauge-controller); lottery on qualifying **buys** → [LotteryManager](/contracts/utilities/lottery-manager); Zora earnings can accrue PPS via `creatorCoinPayoutRecipient`.

## FAQ

**Why isn’t trading live?** Buyers get shares through the auction first; open DEX trading follows settlement.

**When does lottery start?** After trading live, on qualifying ShareOFT DEX **buys** — not on activation or bridge receipts.

**Do I finalize manually?** New vaults are app-orchestrated; follow in-app prompts.

**Auction stuck?** Use in-app support. Onchain: [CCA arm](/contracts/strategies/cca-launch).

[Launch checklist](/guides/launch-checklist) · [Fees & lottery](/overview/how-it-works) · [Solana bridge](/overview/solana-share-mesh)
