---
title: Glossary
sidebar_position: 3
---

# Glossary

Product and onchain terminology for 4626 vaults. For introduction and launch flow, see [Getting started](/getting-started).

## Overview

### Creator coin vs share token

**Creator coin** is the Zora ERC-20 deposited into the vault. **Vault shares** (`▢`) and **ShareOFT** (`■`) represent claims on vault value. These are distinct contract addresses. See [Token model](/getting-started#three-names-youll-see).

### `vault_full_deploy` bundle

$499 USDC entitlement activating deploy plus Charm, Ajna, Solana share mesh (Pipe A), and Meteora provisioning. Does not include the activation deposit. [Strategy bundle](/guides/strategy-bundle).

### CCA (Continuous Clearing Auction)

Uniswap V4 fair-launch auction for share price discovery at activation. See [CCA strategy](/contracts/strategies/cca-launch).

### Pipe A

Post-auction finalize step bridging approximately 30% of ShareOFT supply to Solana (share mesh). See [Solana share mesh](/overview/solana-share-mesh).

## Tokens

**Creator coin** — The Zora ERC-20 deposited into the vault; the vault **deposit asset**. Not the same address as share tokens.

**Vault shares (`▢TICKER`)** — ERC-4626 shares from [CreatorOVault](/contracts/core/creator-ovault); pro-rata claim on vault TVL.

**Share OFT (`■TICKER`)** — LayerZero omnichain token from [CreatorShareOFT](/contracts/core/creator-share-oft); primary DEX-facing tradable share.

**Wrapper** — [CreatorOVaultWrapper](/contracts/core/creator-ovault-wrapper); converts ▢ → ■ at 1:1.

## Launch and vault

**ERC-4626** — Vault standard: deposit assets, receive shares, redeem assets.

**PPS (price per share)** — Vault assets ÷ share supply; accretes when fees and revenue enter the vault.

**Greenfield** — A new vault deploy on the current release ([addresses](/reference/addresses), v1.14.1). See [Launch checklist](/guides/greenfield-checklist).

**Deployed / Activated / Trading live** — Launch milestones defined in [Getting started](/getting-started#launch-milestones).

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
