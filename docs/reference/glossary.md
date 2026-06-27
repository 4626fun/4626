---
title: Glossary
sidebar_position: 3
---

# Glossary

Product and onchain terms for 4626 vaults.

**New here?** Read [Getting started](/getting-started) first.

## Common questions

**Creator coin vs share?** — Creator coin is your Zora token (goes *into* the vault). Shares (`▢` / `■`) are *claims on* the vault. Different addresses. See [Getting started — three names](/getting-started#three-names-youll-see).

**What’s the $499 bundle?** — Pays to unlock deploy plus Charm, Ajna, Solana bridge entitlement, and Meteora setup. Not your token deposit. [Strategy bundle](/guides/strategy-bundle).

**Fair auction / CCA?** — Continuous Clearing Auction: open price discovery for shares at launch. [CCA strategy](/contracts/strategies/cca-launch).

**Pipe A?** — Post-auction step that bridges ~30% of shares to Solana. [Solana share mesh](/overview/solana-share-mesh).

## Tokens

**Creator coin** — Your Zora ERC-20; the vault **deposit asset**. Not the same address as share tokens.

**Vault shares (`▢TICKER`)** — ERC-4626 shares from [CreatorOVault](/contracts/core/creator-ovault); claim on vault TVL.

**Share OFT (`■TICKER`)** — LayerZero omnichain token from [CreatorShareOFT](/contracts/core/creator-share-oft); tradable cross-chain share.

**Wrapper** — [CreatorOVaultWrapper](/contracts/core/creator-ovault-wrapper); converts ▢ → ■ 1:1.

## Launch & vault

**CCA (Continuous Clearing Auction)** — Uniswap V4 fair-launch auction; see [CCA strategy](/contracts/strategies/cca-launch).

**ERC-4626** — Vault standard: deposit assets, receive shares, redeem assets.

**PPS (price per share)** — Vault assets ÷ share supply; accretes when fees and revenue enter the vault.

**Pipe A** — After the auction, finalize can bridge ~30% of shares to Solana ([share mesh](/overview/solana-share-mesh)).

## Fee lanes

Use qualified names — bare `payoutRecipient` is ambiguous.

**`tradeFeeCollector`** — ShareOFT/hook **trade-fee** destination (often the gauge). Native transfer-fee plane + optional hook plane.

**`creatorCoinPayoutRecipient`** — Creator coin **external earnings** (`payoutRecipient` on Zora); in router mode feeds holder PPS accretion.

**`creatorTreasury`** — Optional **creator ongoing** slice from gauge split (`creatorShareBps`; default 0).

**Jackpot custodian** — Gauge reserve (`jackpotReserve`) in vault-share units; holds funds, does not pick winners.

**Jackpot payout authority** — [CreatorLotteryManager](/contracts/utilities/lottery-manager); selects winners and calls `payJackpot`.

**Voter / protocol branch** — `protocolShareBps` from gauge split; preferred route is voter rewards distributor.

## Cross-chain & lottery

**LayerZero (LZ)** — Messaging for ShareOFT bridging.

**OFT** — Omnichain fungible token standard (ShareOFT).

**VRF** — Chainlink verifiable randomness for lottery draws.

**AMOE** — Alternative method of entry for lottery (no purchase required; attested offchain).

## Integrators

**Impairment epoch** — Side-pocket when a strategy is impaired; see [impairment disclosures](/reference/impairment-v1-disclosures).

**Greenfield** — A **brand-new** vault deploy on the current release ([addresses](/reference/addresses), v1.14.1). See [Launch checklist](/guides/greenfield-checklist).
