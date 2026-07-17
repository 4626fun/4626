---
title: Glossary
sidebar_position: 2
---

# Glossary

Public names used across docs and the app, with internal or onchain identifiers where they differ. Launch steps: [Launch checklist](/guides/launch-checklist).

## Quick definitions

**New vault launch** *(greenfield)*  
A brand-new vault on the **current** release (v1.19.1) — not a patch or migration of an older vault (e.g. AKITA).

**Solana share bridge at finalize** *(Pipe A, `solana_ovault_mesh`)*  
At Phase 2 finalize, about **30%** of tradable `■` shares bridge to Solana via LayerZero automatically. Included in the launch bundle; Base trading and the fair-launch auction do not wait on it.

**Legacy vault**  
Deployed on an **older batcher or release**. Do not assume AKITA-era addresses or flows apply to new launches.

## Public names vs internal names

| Public name (docs & app) | Internal / onchain | Notes |
|--------------------------|-------------------|--------|
| **Launch bundle ($499 USDC)** | `vault_full_deploy` | Unlocks deploy; includes Charm + Ajna + Solana mesh + Meteora |
| **New vault launch** | *Greenfield* | New deploy on current release (v1.19.1), not legacy vaults |
| **Solana bridge at finalize (~30% of ■)** | *Pipe A*, `solana_ovault_mesh` | Automatic LayerZero bridge in Phase 2 finalize — not a separate purchase |
| **Fair-launch auction** | CCA | Uniswap V4 price discovery at activation |
| **Auction schedule** | Thursday 00:00 UTC epoch | CCA bids open on the next weekly epoch after `launchDeferredAuction` |
| **Share allocation at finalize** | 30/30/30/10 split | 30% CCA · 30% vesting · 30% Solana bridge · 10% LP reserve |
| **Base (primary chain)** | *Hub chain* | Deploy, auction, trading, and lottery for new vaults |
| **Tradable share** | ShareOFT, `■TICKER` | DEX-facing token; not the Zora creator coin |
| **Vault share** | ERC-4626 share, `▢TICKER` | Internal vault accounting token |
| **Launch fee / bundle payment** | Strategy bundle activation | Paid at [Pay launch fee](/guides/strategy-bundle) |

## Tokens

**Creator coin** — Zora ERC-20 deposited into the vault (deposit asset). Distinct address from share tokens.

**Vault share (`▢TICKER`)** — ERC-4626 share from [CreatorOVault](/contracts/core/creator-ovault); pro-rata claim on vault TVL.

**Tradable share (`■TICKER`)** — LayerZero ShareOFT from [CreatorShareOFT](/contracts/core/creator-share-oft); primary DEX-facing asset.

**Wrapper** — [CreatorOVaultWrapper](/contracts/core/creator-ovault-wrapper); locks **1000 ▢ per 1 ■** (`NORMALIZATION_FACTOR = 1000`). User `deposit()` presents **~1 creator coin → ~1 ■**.

**ve■4626** — Decaying power from locking protocol **■4626** ShareOFT — not from holding a creator’s `■TICKER`. See [ve■4626](/overview/ve4626).

**ve33** — Utility from ve■4626 for gauge voting, fees, and bribes.

**veLottery** — Opt-in utility from ve■4626 for the personal lottery multiplier. Works with creator-share coverage; does not replace it.

## Token units {#token-units}

| Step | Ratio | Notes |
|------|-------|-------|
| Creator coin → ▢ | ~**1:1000** at bootstrap | Vault `_decimalsOffset() = 3` (virtual shares). After PPS drifts, follows live PPS. |
| ▢ → ■ | **1000:1** | Wrapper wrap ÷1000; unwrap ×1000. Never 1:1 in raw units. |
| Creator coin → ■ | ~**1:1** UX | Offsets cancel in `wrapper.deposit()` / `withdraw()`. **Never** means ▢ ↔ ■ is 1:1. |

**Gauge trade-fee split** (immutable BPS; split in ShareOFT ■ first):

| Slice | Unit | Destination |
|-------|------|-------------|
| 69% | ShareOFT ■ | `jackpotReserve` (gauge custodian) |
| 21.39% | ShareOFT ■ | Voter/protocol branch |
| 9.61% | Unwrap → ▢ burned | PPS ↑ for holders |
| 0% (default) | ShareOFT ■ | `creatorTreasury` when enabled |

**Lottery payout** — Winners receive **ShareOFT ■** from the triggering vault’s gauge reserve (default single-vault mode). Gauge custodies; [LotteryManager4626](/contracts/utilities/lottery-manager) calculates win chance and pays.

## Launch milestones

| Milestone | Meaning |
|-----------|---------|
| **Deployed** | Contracts onchain; vault not yet funded |
| **Activated** | Creator coin deposited; **fair-launch auction in progress** |
| **Trading live** | Auction complete and finalize done; `■` shares tradable on Base DEXs |

## Share allocation at finalize

When the batcher **finalizes** activation, wrapped `■` supply from the deposit is split **30/30/30/10**:

| Leg | Share of `■` | Destination |
|-----|--------------|-------------|
| Fair-launch auction | 30% | CCA price discovery (launched with 10% LP reserve on strategy) |
| Creator vesting | 30% | `CreatorLinearVesting` (365-day linear unlock) |
| Solana bridge | 30% | LayerZero OFT bridge (part of finalize) |
| LP reserve | 10% | Held on [CCA strategy](/contracts/strategies/cca-launch) for post-auction v4 migration |

Onchain constants: `AUCTION_PERCENT`, `VESTING_PERCENT`, `SOLANA_ALLOC_PERCENT`, `LP_RESERVE_PERCENT` on `DeploymentBatcher`. See [CCA launch strategy](/contracts/strategies/cca-launch) for auction graduation, migration, and failed-auction paths.

## Fee lanes

Use qualified names — bare `payoutRecipient` is ambiguous.

**`tradeFeeCollector`** — ShareOFT/hook **trade-fee** destination (often the gauge).

**`creatorCoinPayoutRecipient`** — Creator coin **external earnings** (Zora `payoutRecipient`); in router mode feeds holder PPS accretion.

**`creatorTreasury`** — Optional **creator ongoing** slice from gauge split (`creatorShareBps`; default 0).

**Jackpot custodian** — Gauge reserve (`jackpotReserve`); holds funds, does not pick winners.

**Jackpot payout authority** — [LotteryManager4626](/contracts/utilities/lottery-manager); selects winners and pays jackpots.

**Voter / protocol branch** — `protocolShareBps` from gauge split.

## Cross-chain & lottery

**LayerZero (LZ)** — Messaging for ShareOFT bridging.

**OFT** — Omnichain fungible token standard (ShareOFT).

**VRF** — Chainlink verifiable randomness for lottery draws.

**AMOE** — Alternative method of entry (no purchase required; attested offchain).

## Integrators

**Impairment epoch** — Side-pocket when a strategy is impaired; see [impairment disclosures](/reference/impairment-v1-disclosures).

**Legacy vault** — Deployed on an older batcher/version (e.g. AKITA); may differ from the v1.19.1 new-vault path.
