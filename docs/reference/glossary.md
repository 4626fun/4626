---
title: Glossary
sidebar_position: 2
---

# Glossary

Plain-language names used in public docs, with internal or onchain identifiers where they differ. For launch steps, see [Launch checklist](/guides/greenfield-checklist).

## Public names vs internal names

| Public name (docs & app) | Internal / onchain | Notes |
|--------------------------|-------------------|--------|
| **Launch bundle ($499 USDC)** | `vault_full_deploy` | Unlocks deploy; includes strategies + optional Solana entitlement |
| **New vault launch** | *Greenfield* | New deploy on current release (v1.14.1), not legacy vaults |
| **Fair-launch auction** | CCA | Uniswap V4 price discovery at activation |
| **Optional Solana trading** | *Solana share mesh*, `solana_ovault_mesh` | Same `■` share may trade on Solana after finalize |
| **Post-auction Solana bridge** | *Pipe A* | ~30% of `■` supply bridged at finalize (LayerZero) |
| **Share allocation at finalize** | 30/30/30/10 split | 30% CCA · 30% vesting · 30% Solana bridge · 10% LP reserve |
| **Base (primary chain)** | *Hub chain* | Deploy, auction, trading, and lottery for new vaults |
| **Tradable share** | ShareOFT, `■TICKER` | DEX-facing token; not the Zora creator coin |
| **Vault share** | ERC-4626 share, `▢TICKER` | Internal vault accounting token |
| **Launch fee / bundle payment** | Strategy bundle activation | Paid at [Pay launch fee](/guides/strategy-bundle) |

## Tokens

**Creator coin** — The Zora ERC-20 deposited into the vault; the vault **deposit asset**. Distinct contract address from share tokens.

**Vault share (`▢TICKER`)** — ERC-4626 share from [CreatorOVault](/contracts/core/creator-ovault); pro-rata claim on vault TVL.

**Tradable share (`■TICKER`)** — LayerZero ShareOFT from [CreatorShareOFT](/contracts/core/creator-share-oft); primary DEX-facing asset.

**Wrapper** — [CreatorOVaultWrapper](/contracts/core/creator-ovault-wrapper); converts ▢ → ■ at 1:1.

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
| Solana bridge | 30% | LayerZero OFT bridge (optional trading lane) |
| LP reserve | 10% | Held on [CCA strategy](/contracts/strategies/cca-launch) for post-auction v4 migration |

Onchain constants: `AUCTION_PERCENT`, `VESTING_PERCENT`, `SOLANA_ALLOC_PERCENT`, `LP_RESERVE_PERCENT` on `DeploymentBatcher`. See [CCA launch strategy](/contracts/strategies/cca-launch) for auction graduation, migration, and failed-auction paths.

## Fee lanes

Use qualified names — bare `payoutRecipient` is ambiguous.

**`tradeFeeCollector`** — ShareOFT/hook **trade-fee** destination (often the gauge).

**`creatorCoinPayoutRecipient`** — Creator coin **external earnings** (Zora `payoutRecipient`); in router mode feeds holder PPS accretion.

**`creatorTreasury`** — Optional **creator ongoing** slice from gauge split (`creatorShareBps`; default 0).

**Jackpot custodian** — Gauge reserve (`jackpotReserve`); holds funds, does not pick winners.

**Jackpot payout authority** — [CreatorLotteryManager](/contracts/utilities/lottery-manager); selects winners and pays jackpots.

**Voter / protocol branch** — `protocolShareBps` from gauge split.

## Cross-chain & lottery

**LayerZero (LZ)** — Messaging for ShareOFT bridging.

**OFT** — Omnichain fungible token standard (ShareOFT).

**VRF** — Chainlink verifiable randomness for lottery draws.

**AMOE** — Alternative method of entry (no purchase required; attested offchain).

## Integrators

**Impairment epoch** — Side-pocket when a strategy is impaired; see [impairment disclosures](/reference/impairment-v1-disclosures).

**Legacy vault** — Deployed on an older batcher/version (e.g. AKITA); may differ from v1.14.1 new-vault path.
