---
title: How it works
sidebar_position: 2
---

# How 4626 works

4626 turns a **Zora creator coin** into an **ERC-4626 vault** on Base with a fair-launch auction, cross-chain **share tokens**, and onchain fee routing to holders.

## Two tokens per creator

| Token | Role |
|-------|------|
| **Creator coin** | Your existing Zora ERC-20 — vault **deposit asset** |
| **Vault share** (`▢TICKER`) | ERC-4626 share — represents ownership of vault TVL |
| **Share OFT** (`■TICKER`) | LayerZero OFT — tradable share representation; Solana mesh uses the bridged share |

Creator coin address ≠ share token address. Never treat them as interchangeable.

## Launch flow (high level)

1. **Deploy** — one greenfield batch deploys vault, wrapper, ShareOFT, gauge, oracle, and CCA strategy ([launch guide](/guides/launch-token)).
2. **Activate** — deposit creator coin, wrap shares, seed the CCA auction ([activate guide](/guides/activate-vault)).
3. **Auction** — continuous clearing auction (CCA) sells vault shares for USDC.
4. **Strategies** — paid bundle deploys Charm + Ajna sleeves; Solana share mesh bridges a slice at finalize.
5. **Fees & lottery** — trade fees and external creator-coin revenue accrue to holders via the gauge and payout router ([glossary](/reference/glossary) for lane names).

## Core contracts (one stack per creator)

| Contract | Purpose |
|----------|---------|
| [CreatorOVault](/contracts/core/creator-ovault) | ERC-4626 vault — holds creator coin, mints shares |
| [CreatorOVaultWrapper](/contracts/core/creator-ovault-wrapper) | Wraps vault shares for OFT bridging |
| [CreatorShareOFT](/contracts/core/creator-share-oft) | Cross-chain share token |
| [CreatorGaugeController](/contracts/governance/gauge-controller) | Routes trade fees and jackpot reserves |
| [CCA launch strategy](/contracts/strategies/cca-launch) | Fair-launch auction |
| [CreatorLotteryManager](/contracts/utilities/lottery-manager) | Instant lottery payouts |

Shared factories, batcher, and registry addresses: [live addresses](/reference/addresses).

## Fee lanes (short)

- **Trade fees** — ShareOFT / hook transfers route to `tradeFeeCollector` (gauge); part burns vault shares.
- **External creator revenue** — Zora `payoutRecipient` → payout router → holder PPS accretion.
- **Jackpot** — gauge custodies reserves; lottery manager selects winners.

Details and exact identifiers: [glossary](/reference/glossary).

## Where to go next

- [Launch a vault](/guides/launch-token) · [Activate after deploy](/guides/activate-vault)
- [Contract addresses](/reference/addresses) · [Contract docs](/contracts)
