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
