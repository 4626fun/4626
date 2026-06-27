---
title: How it works
sidebar_position: 2
---

# How it works

4626 wraps a **Zora creator coin** in an **ERC-4626 vault** on Base, distributes **tradable shares** through a **Continuous Clearing Auction (CCA)**, and routes trade fees and external creator revenue to share holders.

For launch procedures, see the [Launch checklist](/guides/greenfield-checklist). For product introduction, see [Getting started](/getting-started).

## Product scope

A standalone creator coin does not, by itself, provide:

- Standardized **ERC-4626 claims** on vault total value locked (TVL)
- **Open price discovery** via a fair-launch auction
- Onchain **fee sharing** with share holders

4626 deploys a per-creator vault stack, CCA launch strategy, ShareOFT, gauge, oracle, and lottery manager to address these requirements.

## Token model {#three-tokens-one-vault}

```text
  Creator coin ($TICKER)          Vault share (▢TICKER)         Tradable share (■TICKER)
  ─────────────────────          ─────────────────────         ───────────────────────
  Zora ERC-20 deposit asset      ERC-4626 vault share          LayerZero ShareOFT (DEX)
  Deposited into vault           Minted on deposit             Wrapped 1:1 from ▢ shares
  Original token address         Internal accounting token     Cross-chain tradable share
```

**Invariant:** creator coin contract address **≠** share token contract address.

## Post-launch economics

```text
  DEX buy of ■ share on Base
           │
           ▼
  ShareOFT transfer fee ──► tradeFeeCollector (gauge) ──► split / jackpot / burn
           │
           └──► Qualifying buy may enter CreatorLotteryManager

  Zora creatorCoinPayoutRecipient ──► PayoutRouter ──► Vault ──► PPS accretion for holders
```

- **Trade fees** — ShareOFT transfer fees on DEX routes flow to the gauge (`tradeFeeCollector` domain). A portion may burn vault shares on distribute.
- **External creator revenue** — Zora `payoutRecipient` earnings in router mode feed holder accretion via the payout router and vault PPS.
- **Jackpot** — The gauge **custodies** reserves (`jackpotCustodian`); [CreatorLotteryManager](/contracts/utilities/lottery-manager) (**jackpot payout authority**) selects winners on qualifying ShareOFT **buys**.

Qualified lane terminology: [Glossary](/reference/glossary).

## Launch sequence

| Step | Creator action | Onchain result |
|------|----------------|----------------|
| 1 — Pay | [Strategy bundle](/guides/strategy-bundle) (`vault_full_deploy`, $499 USDC) | Deploy gate opens |
| 2 — Deploy | [Launch vault](/guides/launch-token) | Vault, wrapper, ShareOFT, gauge, oracle, CCA deployed |
| 3 — Activate | [Activate vault](/guides/activate-vault) | Creator coin deposited; CCA seeded (99% creator coin / 1% USDC) |
| 4 — Auction | Monitor in application | CCA price discovery completes |
| 5 — Finalize | Application-orchestrated | Pipe A may bridge ~30% ShareOFT to [Solana](/overview/solana-share-mesh) |
| 6 — Strategies | Automatic with bundle | Charm 45% · Ajna 45% · 10% idle CREATOR in vault |

Steps 2–3 require creator action in the application. Steps 4–6 proceed onchain after activation.

## Solana (optional)

Base is the **hub chain**. Solana is not required for Base launch, trading, or lottery participation.

After finalize, approximately **30%** of ShareOFT supply may bridge to Solana as the same `■TICKER` symbol (Pipe A). Creator coin remains on Base. Meteora pool provisioning is operator-assisted per bundle entitlement. Details: [Solana share mesh](/overview/solana-share-mesh).

## Core contracts

Shared infrastructure (batcher, factories, registry): [addresses](/reference/addresses) (**v1.14.1**). Each creator deployment includes:

| Contract | Role |
|----------|------|
| [CreatorRegistry](/contracts/core/creator-registry) | Creator coin → vault stack resolution |
| [CreatorOVault](/contracts/core/creator-ovault) | ERC-4626 vault; holds creator coin |
| [CreatorOVaultWrapper](/contracts/core/creator-ovault-wrapper) | ▢ → ■ wrapping (1:1) |
| [CreatorShareOFT](/contracts/core/creator-share-oft) | Tradable ■ share; LayerZero OFT |
| [CreatorGaugeController](/contracts/governance/gauge-controller) | Fee split; jackpot custody |
| [CCA launch strategy](/contracts/strategies/cca-launch) | Uniswap V4 fair-launch auction |
| [CreatorLotteryManager](/contracts/utilities/lottery-manager) | Instant lottery on ShareOFT buys |
| [CreatorOracle](/contracts/utilities/creator-oracle) | TWAP pricing for lottery sizing |

Strategy impairment disclosures: [impairment v1](/reference/impairment-v1-disclosures).

## Related documentation

[Getting started](/getting-started) · [Launch checklist](/guides/greenfield-checklist) · [Contracts](/contracts)
