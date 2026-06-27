---
title: How it works
sidebar_position: 2
---

# How 4626 works

4626 wraps your **Zora creator coin** in an **ERC-4626 vault** on Base, sells vault shares through a **CCA auction**, and routes trading fees plus external creator revenue to **share holders**.

## The two-token rule

| Token | What it is |
|-------|------------|
| **Creator coin** | Your existing Zora ERC-20 — vault **deposit asset** only |
| **Vault share (`▢TICKER`)** | ERC-4626 claim on vault TVL |
| **Share OFT (`■TICKER`)** | Tradable cross-chain share (LayerZero); **this** is what DEX buyers hold |

Creator coin address **≠** share token address. Never treat them as the same asset.

## End-to-end phases

| Phase | You do | Onchain result |
|-------|--------|----------------|
| **0** | Pay [strategy bundle](/guides/strategy-bundle) | Deploy gate opens ($499 USDC bundle) |
| **1** | [Launch vault](/guides/launch-token) | Vault, wrapper, ShareOFT, gauge, oracle, CCA deploy |
| **2** | [Activate vault](/guides/activate-vault) | Creator coin deposited; CCA auction seeded |
| **2b** | App/finalize after auction | Pipe A may bridge ~30% ShareOFT to [Solana mesh](/overview/solana-share-mesh) |
| **3** | Automatic with bundle | Charm (45%) + Ajna (45%) + 10% idle CREATOR |

Printable checklist: [Greenfield checklist](/guides/greenfield-checklist).

## Core contracts (per creator)

| Contract | Role |
|----------|------|
| [CreatorRegistry](/contracts/core/creator-registry) | Maps creator coin → vault stack addresses |
| [CreatorOVault](/contracts/core/creator-ovault) | Holds creator coin; mints ▢ shares |
| [CreatorOVaultWrapper](/contracts/core/creator-ovault-wrapper) | Wraps ▢ → ■ 1:1 |
| [CreatorShareOFT](/contracts/core/creator-share-oft) | Tradable ■ share; trade fees → gauge |
| [CreatorGaugeController](/contracts/governance/gauge-controller) | Fee split, jackpot custody |
| [CCA strategy](/contracts/strategies/cca-launch) | Fair-launch auction |
| [CreatorLotteryManager](/contracts/utilities/lottery-manager) | Instant lottery on hub-chain ShareOFT **buys** |
| [CreatorOracle](/contracts/utilities/creator-oracle) | TWAP for lottery USD sizing |

Shared factories and batcher: [live addresses](/reference/addresses) (v1.14.1).

## Fee lanes (holder-facing)

- **Trade fees** — ShareOFT transfers on DEX routes to `tradeFeeCollector` (gauge); part burns vault shares.
- **External creator revenue** — Zora `payoutRecipient` → payout router → holder PPS accretion.
- **Jackpot** — Gauge **custodies** reserves; lottery manager **picks winners** and pays out.

Qualified lane names: [glossary](/reference/glossary).

## Next steps

- New vault: [Getting started](/getting-started) → [Greenfield checklist](/guides/greenfield-checklist)
- Contract detail: [Contracts hub](/contracts)
- Integrators / impairment: [Impairment disclosures](/reference/impairment-v1-disclosures)
