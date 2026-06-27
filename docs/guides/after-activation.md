---
title: 'Step 4: After activation'
sidebar_position: 5
---

# Step 4: After activation

What happens **after** [Step 3: Activate vault](/guides/activate-vault). Activation starts the auction; it does **not** open secondary DEX trading.

<div class="docs-at-a-glance">

**Activated ≠ trading live.** Public DEX trading starts after the **fair-launch auction** completes and **finalize** succeeds on Base.

**Monitor:** [app.4626.fun/deploy/vault](https://app.4626.fun/deploy/vault)

</div>

[Launch checklist](/guides/greenfield-checklist) · [What is 4626?](/getting-started)

## Right after activation

| Item | State |
|------|--------|
| Vault | Funded (50M–100M creator coin) |
| Fair-launch auction | **In progress** |
| `■` ShareOFT on DEX | **Not yet** |
| Lottery | **Not yet** (needs qualifying live **buys**) |
| Milestone | **Activated** |

### Share allocation (on finalize)

When activation **finalizes**, the batcher wraps the deposit into `■` and enforces a fixed split:

| Leg | % | Notes |
|-----|---|--------|
| CCA auction | 30% | Fair-launch price discovery |
| Creator vesting | 30% | Linear unlock over 365 days |
| Solana bridge | 30% | LayerZero OFT bridge (optional) |
| LP reserve | 10% | Held on CCA strategy for v4 migration |

Solana is optional for Base trading — the 30% bridge leg may complete after finalize. [Optional: Solana trading](/overview/solana-share-mesh)

## Timeline

| Phase | What happens | Your action | Milestone |
|-------|----------------|-------------|-----------|
| **Auction running** | Uniswap V4 auction finds clearing price | Monitor app | Activated |
| **Auction complete** | Finalize orchestration runs | Usually none | → Finalize |
| **Finalize** | Base settlement; optional Solana bridge (~30% `■`) | Follow app if prompted | → **Trading live** |
| **Strategies** | Charm 45% · Ajna 45% · idle buffer | Automatic (launch bundle) | Trading live |
| **Solana (optional)** | Bridged `■` + Meteora may follow | None | Optional |

## Trading live on Base

- `■` shares tradable on Base DEXs
- Fees on qualifying **buys** → [CreatorGaugeController](/contracts/governance/gauge-controller)
- Lottery entries on qualifying **buys** → [CreatorLotteryManager](/contracts/utilities/lottery-manager)
- Zora creator revenue can accrue vault PPS via payout router

[How fees and lottery work](/overview/how-it-works)

## Optional: Solana

Solana is **not** required for Base trading or lottery.

After finalize, the **post-auction Solana bridge** may send ~30% of `■` supply to Solana (same ticker). Creator coin stays on Base. Meteora pools are operator-provisioned and may complete later.

[Optional: Solana trading](/overview/solana-share-mesh)

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
