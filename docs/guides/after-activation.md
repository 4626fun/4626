---
title: After activation
sidebar_position: 5
---

# After activation

What happens onchain and in the application **after** [Activate vault](/guides/activate-vault) (launch step 3). Activation deposits creator coin and starts the CCA; it does **not** by itself make `■` shares tradable on secondary markets.

Overview: [Getting started](/getting-started) · [Launch checklist](/guides/greenfield-checklist) · [How it works](/overview/how-it-works)

## Immediate state

After a successful activation transaction:

| Item | State |
|------|--------|
| Vault | Funded with the activation deposit (50M–100M creator coin) |
| CCA | **In progress** — fair-launch auction seeded (99% creator coin / 1% USDC) |
| `■` ShareOFT | Not yet freely tradable on Base DEXs |
| Lottery | Not yet active for public secondary **buys** |
| Milestone | **Activated** (not **Trading live**) |

Monitor auction progress in **[app.4626.fun/deploy/vault](https://app.4626.fun/deploy/vault)**. No further creator action is required during the auction unless the application surfaces an error or retry.

## Phase timeline

| Phase | What happens | Creator action | Milestone |
|-------|----------------|----------------|-----------|
| **CCA in progress** | Uniswap V4 continuous clearing auction discovers clearing price | Monitor in app | Activated |
| **CCA complete** | Auction graduates; finalize orchestration runs | Usually none — application/keeper path | → Finalize |
| **Finalize** | Onchain completion; optional Pipe A Solana bridge (~30% share slice) | Confirm finalize when prompted if required | → Trading live (Base) |
| **Strategy attachment** | Charm (45%) + Ajna (45%) + idle buffer deploy per bundle | Automatic with `vault_full_deploy` | Trading live |
| **Solana (optional)** | Bridged `■` share + Meteora provisioning may follow finalize | None — operator-assisted per bundle | Optional |

Public secondary trading on Base begins after the **CCA completes and finalize succeeds**, not at activation alone.

## Trading live on Base

When the vault reaches **Trading live**:

- `■` ShareOFT is tradable on Base DEXs
- ShareOFT transfer fees on qualifying **buys** route to [CreatorGaugeController](/contracts/governance/gauge-controller)
- Qualifying ShareOFT **buys** may enter [CreatorLotteryManager](/contracts/utilities/lottery-manager)
- Zora **creator coin** external revenue (`creatorCoinPayoutRecipient`) can accrue holder value via the payout router and vault PPS

Fee and lane detail: [How it works](/overview/how-it-works) · [Glossary](/reference/glossary)

## Solana (optional)

Solana is **not** required for Base trading or lottery at launch.

After finalize, **Pipe A** may bridge approximately **30%** of ShareOFT supply to Solana as the same `■TICKER` symbol. Creator coin remains on Base. Meteora pool setup is operator-provisioned under the strategy bundle entitlement and may complete after Base is already trading live.

Policy: [Solana share mesh](/overview/solana-share-mesh)

## Common questions

### Why is secondary trading not live yet?

Activation seeds the CCA. Buyers receive `■` shares through the auction mechanism first. Open DEX secondary trading follows auction completion and finalize.

### When does the lottery start?

On hub-chain ShareOFT DEX **buys** after trading is live — not on activation, wraps, or bridge receipts. See [Lottery manager](/contracts/utilities/lottery-manager).

### Do I need to run finalize manually?

Greenfield flows are application-orchestrated. If the deploy UI shows finalize pending, follow in-app prompts. Settlement completion is gated on onchain invariants documented for operators in internal runbooks.

### What if the CCA fails or stalls?

Contact support through application channels. Failed-auction handling is contract-level; the [CCA launch strategy](/contracts/strategies/cca-launch) documents relaunch and finalization semantics.

## Related documentation

| Topic | Page |
|-------|------|
| Full launch procedure | [Launch checklist](/guides/greenfield-checklist) |
| Fee routing and economics | [How it works](/overview/how-it-works) |
| CCA contract | [CCA launch strategy](/contracts/strategies/cca-launch) |
| Share token and fees | [CreatorShareOFT](/contracts/core/creator-share-oft) |
| Contract addresses | [Addresses](/reference/addresses) (v1.14.1) |
