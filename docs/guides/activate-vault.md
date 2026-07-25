---
title: 'Step 3: Activate vault'
sidebar_position: 4
---

# Step 3: Activate vault

Deposit creator coin, attach strategies, and schedule the **share auction** for `■` tradable shares.

<div class="docs-at-a-glance">

| | |
|---|---|
| **You do** | Sign activate (Permit2 or approve + activate) |
| **4626 does** | Deposit · mint · wrap · seed auction |
| **Done when** | **Activated** — deposit finalized; auction scheduled or live |
| **Deposit** | 50M–100M creator coin |

</div>

## What activation does

Transfers **50M–100M** creator coin into [CreatorOVault](/contracts/core/creator-ovault), mints shares, wraps into `■` ShareOFT, and schedules the [share auction](/contracts/strategies/cca-launch). This is **open price discovery**, not a private sale. The auction sells `■` for **USDC/ETH**.

On finalize, wrapped `■` splits **30/30/30/10**: auction · vesting (365d) · Solana bridge · LP reserve. [Share allocation](/reference/glossary#share-allocation-at-finalize).

## What finalize does **not** do

Phase 2 `finalizePhase2` wraps the deposit and enforces the **30/30/30/10** split. It does **not**:

- Fund Charm / Ajna — that is **Phase 3** (`deployPhase3Strategies` + `deployToStrategies` at **45% / 45% / 10% idle**)
- Graduate the auction or call `migrate()` — that runs **after** the auction completes

App order: finalize → Phase 3 strategies → Phase 4 `launchDeferredAuction` → (later) settlement.

## Paths

**Permit2 (preferred):** one signature for deposit + wrap + auction seed.  
**Approve + activate:** approve batcher, then activate. The app picks the path.

## After you sign

| Step | Onchain | Outcome |
|------|---------|---------|
| Phase 2 finalize | `finalizePhase2` | Deposit wrapped; **30/30/30/10** |
| Phase 3 | strategy deploy | Charm **45%** · Ajna **45%** · **10% idle** |
| Phase 4 | `launchDeferredAuction` | Auction scheduled (Thursday 00:00 UTC) |
| After auction | `sweepCurrency()` → `migrate()` | Uniswap v4 LP → **trading live** |

No open DEX trading until the auction settles. Solana bridge runs at Phase 2 finalize. [Solana share bridge](/overview/solana-share-mesh).

Prev: [Step 2: Deploy contracts](/guides/launch-token) · Next: [Step 4: After activation](/guides/after-activation)
