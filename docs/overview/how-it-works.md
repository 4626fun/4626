---
title: Fees, auction, and lottery
sidebar_position: 2
---

# Fees, auction, and lottery

How a **Zora creator coin** becomes a vault with **tradable shares**, fair-launch price discovery, fee sharing, and an instant lottery on qualifying buys.

<div class="docs-at-a-glance">

[Launch checklist](/guides/launch-checklist) · Creator coin, vault share, and tradable share are three separate token addresses.

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
  Creator coin ($TICKER)          Vault share (▢TICKER)              Tradable share (■TICKER)
  ─────────────────────          ─────────────────────              ───────────────────────
  Zora ERC-20; vault deposit     ERC-4626 internal claim            LayerZero ShareOFT (DEX)
  ~1 → 1000 ▢ at bootstrap       Minted on deposit (1000× offset)  1000 ▢ → 1 ■ via wrapper
                                 (hidden from default UX)           ≈ 1 creator coin via deposit()
```

**Rule:** creator coin address **≠** share token address. Full ratios: [Token units](/reference/glossary#token-units).

## After trading is live

```text
  DEX buy of ■ share on Base
           │
           ▼
  ShareOFT fee ──► gauge (tradeFeeCollector) ──► burn / jackpot / protocol split
           │
           └──► Qualifying buy → instant lottery (VRF)

  Zora creator earnings ──► creatorCoinPayoutRecipient / CreatorPayoutRouter ──► vault PPS
```

- **Trade fees** — ShareOFT fees on qualifying DEX routes → gauge split.
- **Creator revenue** — `creatorCoinPayoutRecipient` (Zora `payoutRecipient` field) accrues holder PPS in router mode.
- **Jackpot** — Gauge **custodies**; [LotteryManager4626](/contracts/utilities/lottery-manager) **pays** on qualifying **buys**.
Personal boost journey: [ve■4626, ve33, and veLottery](/overview/ve4626). Lane names: [Glossary](/reference/glossary). Formal math: [proven 2.5× boost](/audits/aristotle/curve-boost) · [next Lean targets](/audits/aristotle/lean-proof-targets).

## Launch sequence

| Step | Creator action | Result |
|------|----------------|--------|
| 1 | [Pay launch fee](/guides/strategy-bundle) ($499 bundle) | Deploy unlocked |
| 2 | [Deploy contracts](/guides/launch-token) | Vault stack onchain |
| 3 | [Activate vault](/guides/activate-vault) | Deposit + fair-launch auction seeded |
| 4 | Monitor auction | Price discovery |
| 5 | Finalize (app/chain) | `■` split 30% auction · 30% vesting · 30% Solana · 10% LP reserve |
| 6 | Strategies (automatic) | Charm 45% · Ajna 45% · 10% idle |

Steps 1–3 are manual in the app. Steps 4–6 follow activation.

**Trading live on Base** requires auction graduation, sweep, migrate, and hook alignment — not activation alone. [Completion checklist](/guides/after-activation#when-is-trading-live-on-base)

### Share allocation at finalize

The batcher wraps the activation deposit into `■` ShareOFT, then allocates supply **30/30/30/10**:

| Leg | % | What happens |
|-----|---|--------------|
| CCA auction | 30% | Fair-launch price discovery |
| Creator vesting | 30% | 365-day linear vest to creator |
| Solana bridge | 30% | LayerZero bridge of `■` (at finalize) |
| LP reserve | 10% | Held on CCA strategy for v4 migration after graduation |

Details: [CCA launch strategy](/contracts/strategies/cca-launch) · [Glossary](/reference/glossary#share-allocation-at-finalize)

## Solana share bridge

Base is the **primary chain** for deploy, auction, and lottery. **Solana is still part of every greenfield deployment:** ~30% of `■` supply bridges at Phase 2 finalize (included in the launch bundle). Creator coin stays on Base.

[Solana share bridge](/overview/solana-share-mesh)

## Core contracts

Shared infrastructure: [Addresses](/reference/addresses) (v1.19.1). Per creator:

| Contract | Role |
|----------|------|
| [Registry4626](/contracts/core/creator-registry) | Creator coin → stack lookup |
| [CreatorOVault](/contracts/core/creator-ovault) | Vault · holds creator coin |
| [CreatorOVaultWrapper](/contracts/core/creator-ovault-wrapper) | 1000 ▢ → 1 ■ wrap |
| [CreatorShareOFT](/contracts/core/creator-share-oft) | Tradable ■ share |
| [CreatorGaugeController](/contracts/governance/gauge-controller) | Fee split · jackpot custody |
| [CCA launch strategy](/contracts/strategies/cca-launch) | Fair-launch auction |
| [LotteryManager4626](/contracts/utilities/lottery-manager) | Lottery on buys |
| [CreatorOracle](/contracts/utilities/creator-oracle) | TWAP for lottery sizing |

Impairment: [disclosures](/reference/impairment-v1-disclosures).

## Related

[Launch checklist](/guides/launch-checklist) · [Contracts](/contracts) · [Glossary](/reference/glossary)
