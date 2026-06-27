---
title: 'Step 3: Activate vault'
sidebar_position: 4
---

# Step 3: Activate vault

Deposit creator coin and start the **fair-launch auction** for `■` tradable shares.

<div class="docs-at-a-glance">

| | |
|---|---|
| **You do** | Sign activate (Permit2 or approve + activate) |
| **4626 does** | Deposit · mint shares · seed Uniswap V4 auction |
| **Done when** | Milestone **Activated** (auction running) |
| **Deposit** | 50M–100M creator coin · auction seed 99% coin / 1% USDC |

</div>

[Launch checklist](/guides/greenfield-checklist) · [Step 2: Deploy contracts](/guides/launch-token)

## What activation does

Transfers **50M–100M** creator coin into [CreatorOVault](/contracts/core/creator-ovault), mints vault shares, wraps into `■` ShareOFT, and starts the [fair-launch auction](/contracts/strategies/cca-launch). This is **open price discovery**, not a private sale.

On finalize, wrapped `■` supply is allocated **30/30/30/10**: 30% auction · 30% creator vesting (365 days) · 30% Solana bridge · 10% LP reserve on the CCA strategy. See [Share allocation](/reference/glossary#share-allocation-at-finalize).

## Execution paths

**Permit2 (preferred):** One signature · deposit + wrap + auction in one batch.

**Approve + activate:** Approve batcher, then activate. App picks the path.

## After activation

| Phase | What to expect |
|-------|----------------|
| Auction in progress | Monitor in app · **no** open DEX trading yet |
| Auction + finalize complete | **Trading live** on Base · lottery on qualifying buys |
| Optional Solana | Bridge may follow finalize — [Optional: Solana trading](/overview/solana-share-mesh) |
| Strategies | Charm + Ajna attach automatically from launch bundle |

Base trading does **not** require Solana.

## Next

[Step 4: After activation](/guides/after-activation) — auction, finalize, trading live.

## Related

[How fees and lottery work](/overview/how-it-works) · [CCA contract](/contracts/strategies/cca-launch)
