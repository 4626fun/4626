---
title: Fees, auction, and lottery
sidebar_position: 2
---

# Fees, auction, and lottery

How a **Zora creator coin** becomes a vault with **tradable shares**, fair-launch price discovery, fee sharing, and an instant lottery on qualifying buys.

<div class="docs-at-a-glance">

**Launch path:** [Launch checklist](/guides/greenfield-checklist)

**Tokens:** creator coin (`$`) · vault share (`▢`) · tradable share (`■`) — three different addresses.

</div>

[What is 4626?](/getting-started)

## What 4626 adds

A creator coin alone does not provide:

- Standardized **ERC-4626** claims on vault TVL
- **Open** fair-launch price discovery
- Onchain **fee sharing** with share holders

4626 deploys vault, auction, ShareOFT, gauge, oracle, and lottery contracts per creator.

## Token model {#three-tokens-one-vault}

```text
  Creator coin ($TICKER)          Vault share (▢TICKER)         Tradable share (■TICKER)
  ─────────────────────          ─────────────────────         ───────────────────────
  Zora ERC-20 deposit            ERC-4626 vault share          LayerZero ShareOFT (DEX)
  Goes into vault                Minted on deposit             Wrapped 1:1 from ▢
```

**Rule:** creator coin address **≠** share token address.

## After trading is live

```text
  DEX buy of ■ share on Base
           │
           ▼
  ShareOFT fee ──► gauge (tradeFeeCollector) ──► burn / jackpot / protocol split
           │
           └──► Qualifying buy → instant lottery (VRF)

  Zora creator earnings ──► PayoutRouter ──► vault ──► PPS accretion for holders
```

- **Trade fees** — ShareOFT transfer fees on qualifying DEX routes.
- **Creator revenue** — Zora `payoutRecipient` earnings (router mode) accrue holder value via vault PPS.
- **Jackpot** — Gauge **custodies** reserves; [CreatorLotteryManager](/contracts/utilities/lottery-manager) **pays** winners on qualifying **buys**.

Lane names: [Glossary](/reference/glossary).

## Launch sequence (same on every launch doc)

| Step | Creator action | Result |
|------|----------------|--------|
| 1 | [Pay launch fee](/guides/strategy-bundle) ($499 bundle) | Deploy unlocked |
| 2 | [Deploy contracts](/guides/launch-token) | Vault stack onchain |
| 3 | [Activate vault](/guides/activate-vault) | Deposit + fair-launch auction seeded |
| 4 | Monitor auction | Price discovery |
| 5 | Finalize (app/chain) | `■` split 30% auction · 30% vesting · 30% Solana · 10% LP reserve |
| 6 | Strategies (automatic) | Charm 45% · Ajna 45% · 10% idle |

Steps 1–3 are manual in the app. Steps 4–6 follow activation.

### Share allocation at finalize

The batcher wraps the activation deposit into `■` ShareOFT, then allocates supply **30/30/30/10**:

| Leg | % | What happens |
|-----|---|--------------|
| CCA auction | 30% | Fair-launch price discovery |
| Creator vesting | 30% | 365-day linear vest to creator |
| Solana bridge | 30% | LayerZero bridge of `■` (optional lane) |
| LP reserve | 10% | Held on CCA strategy for v4 migration after graduation |

Details: [CCA launch strategy](/contracts/strategies/cca-launch) · [Glossary](/reference/glossary#share-allocation-at-finalize)

## Optional: Solana

Base is the **primary chain**. Solana is optional: same `■` share may bridge after finalize. Creator coin stays on Base.

[Optional: Solana trading](/overview/solana-share-mesh)

## Core contracts

Shared infrastructure: [Addresses](/reference/addresses) (v1.14.1). Per creator:

| Contract | Role |
|----------|------|
| [CreatorRegistry](/contracts/core/creator-registry) | Creator coin → stack lookup |
| [CreatorOVault](/contracts/core/creator-ovault) | Vault · holds creator coin |
| [CreatorOVaultWrapper](/contracts/core/creator-ovault-wrapper) | ▢ → ■ wrap |
| [CreatorShareOFT](/contracts/core/creator-share-oft) | Tradable ■ share |
| [CreatorGaugeController](/contracts/governance/gauge-controller) | Fee split · jackpot custody |
| [CCA launch strategy](/contracts/strategies/cca-launch) | Fair-launch auction |
| [CreatorLotteryManager](/contracts/utilities/lottery-manager) | Lottery on buys |
| [CreatorOracle](/contracts/utilities/creator-oracle) | TWAP for lottery sizing |

Impairment: [disclosures](/reference/impairment-v1-disclosures).

## Related

[Launch checklist](/guides/greenfield-checklist) · [Contracts](/contracts) · [Glossary](/reference/glossary)
