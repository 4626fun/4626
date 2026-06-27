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
| **Done when** | Milestone **Activated** — deposit finalized; auction scheduled or live |
| **Deposit** | 50M–100M creator coin |

</div>

[Launch checklist](/guides/greenfield-checklist) · [Step 2: Deploy contracts](/guides/launch-token)

## What activation does

Transfers **50M–100M** creator coin into [CreatorOVault](/contracts/core/creator-ovault), mints vault shares, wraps into `■` ShareOFT, and schedules the [fair-launch auction](/contracts/strategies/cca-launch). This is **open price discovery**, not a private sale. The CCA sells `■` ShareOFT for **USDC/ETH** — not a 99/1 creator-coin/USDC pool seed (that ratio applies to **Charm LP bootstrap** after Phase 3 strategies attach).

On finalize, wrapped `■` supply is allocated **30/30/30/10**: 30% auction · 30% creator vesting (365 days) · 30% Solana bridge · 10% LP reserve on the CCA strategy. See [Share allocation](/reference/glossary#share-allocation-at-finalize).

### What finalize does **not** do

Phase 2 finalize only wraps the deposit and applies the split. It does **not**:

- Deploy **Charm / Ajna** strategy TVL — that runs in the **next deploy-session UserOp (Phase 3)**: `deployPhase3Strategies` + `deployToStrategies` at **45% / 45% / 10% idle**
- **Graduate the CCA** or call `migrate()` — that runs **after the auction completes** via keeper settlement (`sweepCurrency()` → `migrate()`)

The app sends these as **separate sponsored UserOps** in order: finalize → Phase 3 strategies → Phase 4 `launchDeferredAuction` → (later) auction graduation.

## Execution paths

**Permit2 (preferred):** One signature · deposit + wrap + auction in one batch.

**Approve + activate:** Approve batcher, then activate. App picks the path.

## After activation

| Deploy step | Onchain action | Outcome |
|-------------|----------------|---------|
| **Phase 2 finalize** | `finalizePhase2` | Deposit wrapped; **30/30/30/10** split applied |
| **Phase 3** | `deployPhase3Strategies` + `deployToStrategies` | Charm **45%** · Ajna **45%** · **10% idle** (launch bundle) |
| **Phase 4** | `launchDeferredAuction` | Fair-launch auction **scheduled** (Thursday 00:00 UTC) |
| **After auction** | `sweepCurrency()` → `migrate()` | Uniswap v4 LP live → **trading live** on Base |

| Phase | What to expect |
|-------|----------------|
| Auction scheduled or live | Monitor in app · **no** open DEX trading yet |
| Phase 3 complete | Strategies funded; auction may still be pending or live |
| Auction graduates + migrate | **Trading live** on Base · lottery on qualifying buys |
| Solana bridge | Bridge runs at Phase 2 finalize — [Solana share bridge](/overview/solana-share-mesh) |

## Next

[Step 4: After activation](/guides/after-activation) — auction, finalize, trading live.

## Related

[How fees and lottery work](/overview/how-it-works) · [CCA contract](/contracts/strategies/cca-launch)
