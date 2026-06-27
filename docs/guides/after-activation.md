---
title: 'Step 4: After activation'
sidebar_position: 5
---

# Step 4: After activation

What happens **after** [Step 3: Activate vault](/guides/activate-vault). Activation finalizes your deposit and share split; it does **not** immediately open secondary DEX trading.

<div class="docs-at-a-glance">

**Activated ≠ trading live.** Public DEX trading starts after the **fair-launch auction** completes and **finalize** succeeds on Base.

**Monitor:** [app.4626.fun/deploy/vault](https://app.4626.fun/deploy/vault)

</div>

[Launch checklist](/guides/greenfield-checklist) · [What is 4626?](/getting-started)

## Right after activation

| Item | State |
|------|--------|
| Vault | Funded (50M–100M creator coin) |
| Fair-launch auction | **Scheduled or live** (Thursday 00:00 UTC epoch) |
| `■` ShareOFT on DEX | **Not yet** |
| Lottery | **Not yet** (needs qualifying live **buys**) |
| Milestone | **Activated** |

### Share allocation (on finalize)

When activation **finalizes**, the batcher wraps the deposit into `■` and enforces a fixed split:

| Leg | % | Notes |
|-----|---|--------|
| CCA auction | 30% | Fair-launch price discovery |
| Creator vesting | 30% | Linear unlock over 365 days |
| Solana bridge | 30% | LayerZero OFT bridge (part of finalize) |
| LP reserve | 10% | Held on CCA strategy for v4 migration |

The 30% Solana bridge leg runs at **Phase 2 finalize** as part of deployment — no separate Solana step. [Solana share bridge](/overview/solana-share-mesh)

## Timeline

Deploy-session steps (sponsored UserOps, same activation flow):

| Step | What happens | Your action | Milestone |
|------|----------------|-------------|-----------|
| **Phase 2 finalize** | Wrap deposit; **30/30/30/10** split | Sign in app | Activated |
| **Phase 3 strategies** | Charm **45%** · Ajna **45%** · **10% idle** TVL | Sign in app (automatic bundle) | Activated |
| **Phase 4 launch** | `launchDeferredAuction` — auction scheduled | Sign in app | Activated |

After Phase 4, the **auction runs** on its own schedule:

| Phase | What happens | Your action | Milestone |
|-------|----------------|-------------|-----------|
| **Auction scheduled** | CCA created; bids open at next Thursday 00:00 UTC | Monitor app | Activated |
| **Auction live** | Uniswap V4 auction finds clearing price | Monitor app | Activated |
| **Auction graduates** | Minimum raise met; settlement eligible | Usually none | → Settlement |
| **Settlement** | `sweepCurrency()` → `migrate()` (Uniswap v4 LP) | Keeper / app if prompted | → **Trading live** |
| **Solana bridge + Meteora** | Bridged `■` at finalize; pool may follow | None — included in bundle |

## Trading live on Base

<a id="when-is-trading-live-on-base"></a>

Public DEX trading and lottery are **not** guaranteed the moment activation finalizes. Base is **trading live** when all of the following have succeeded:

| Step | Onchain action | Notes |
|------|----------------|-------|
| 1 | CCA auction **graduates** | Minimum raise met; clearing price set |
| 2 | `sweepCurrency()` | Auction proceeds swept per CCA lifecycle |
| 3 | `migrate()` | Uniswap v4 LP position created from auction + LP reserve |
| 4 | Hook config aligned | Tax hook / `tradeFeeCollector` must match intended gauge routing — separate from `migrate()` |

If the auction **fails**, `finalizeFailedAuction()` / `sweepUnsoldTokens()` clears strategy state so a relaunch can proceed. Details: [CCA launch strategy](/contracts/strategies/cca-launch).

Once live:

- `■` shares tradable on Base DEXs
- Fees on qualifying **buys** → [CreatorGaugeController](/contracts/governance/gauge-controller)
- Lottery entries on qualifying **buys** → [CreatorLotteryManager](/contracts/utilities/lottery-manager)
- Zora creator revenue can accrue vault PPS via payout router

[How fees and lottery work](/overview/how-it-works)

## Solana share bridge

The Solana bridge is **included in every greenfield launch** and runs at Phase 2 finalize (~30% of `■` supply). Creator coin stays on Base. Meteora pools are operator-provisioned and may complete after finalize.

[Solana share bridge](/overview/solana-share-mesh)

## FAQ

### Why isn’t trading live yet?

Buyers receive shares through the **auction** first. Open DEX trading follows auction completion + finalize.

### When does the lottery start?

After **trading live**, on qualifying ShareOFT DEX **buys** on Base — not on activation, wraps, or bridge receipts.

### Do I run finalize manually?

New vault flows are app-orchestrated. Follow in-app prompts if finalize is pending.

### Auction stuck or failed?

Use in-app support. Onchain relaunch semantics: [CCA strategy](/contracts/strategies/cca-launch).

## Related

| Topic | Page |
|-------|------|
| Full checklist | [Launch checklist](/guides/greenfield-checklist) |
| Economics | [How fees and lottery work](/overview/how-it-works) |
| Share token | [CreatorShareOFT](/contracts/core/creator-share-oft) |
| Addresses | [Addresses](/reference/addresses) |
