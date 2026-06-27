---
title: Getting started
sidebar_position: 1
---

# Getting started

This page introduces the 4626 product model, launch prerequisites, and recommended reading order. For step-by-step execution, use the [Launch checklist](/guides/greenfield-checklist). For fee and lottery mechanics, see [How it works](/overview/how-it-works).

## Audience

4626 is designed for creators with a **creator coin on Base** (typically issued via Zora) who intend to:

- Deposit creator coin into an **ERC-4626 vault**
- Distribute **tradable shares** through a **Continuous Clearing Auction (CCA)**
- Route **trade fees** and **external creator revenue** to share holders via onchain infrastructure

## Product overview

1. Creator coin is **deposited** into a vault smart contract.
2. The vault mints **vault shares** representing pro-rata claims on vault assets.
3. A portion of supply is allocated to a **fair-launch auction** for price discovery.
4. After the auction, **tradable shares** (`■TICKER`) are available on Base DEXs (Solana bridging is optional and may follow finalize).
5. **Trade fees** and qualified **creator revenue** can accrue to the vault, benefiting share holders through price-per-share (PPS) accretion and gauge mechanics.

The **creator coin** and **share tokens** are separate assets with distinct contract addresses.

## Token model {#three-names-youll-see}

| Token | Description | Example |
|-------|-------------|---------|
| **Creator coin** | Existing Zora ERC-20; vault deposit asset | `$JESSE` |
| **Vault share (`▢TICKER`)** | ERC-4626 share minted by the vault | `▢JESSE` |
| **Tradable share (`■TICKER`)** | LayerZero ShareOFT; primary DEX-facing asset | `■JESSE` |

The [CreatorOVaultWrapper](/contracts/core/creator-ovault-wrapper) converts vault shares to tradable shares at **1:1**. Do not conflate creator coin addresses with share token addresses.

Further detail: [How it works — token model](/overview/how-it-works#three-tokens-one-vault).

## Prerequisites

| Requirement | Purpose |
|-------------|---------|
| Creator coin **deployed on Base** | Vault deposit asset |
| **50M–100M** creator coin available at activation | Required vault deposit (minimum shown in app) |
| **4626 account** with execution-ready wallet signing | Deploy and activate transactions |
| **`vault_full_deploy` active** ($499 USDC) | Deploy gate; includes strategy and Solana entitlements — [Strategy bundle](/guides/strategy-bundle) |

## Launch sequence

The sequence below matches the [Launch checklist](/guides/greenfield-checklist).

| Step | Action | Documentation |
|------|--------|---------------|
| 1 | Activate **`vault_full_deploy`** ($499 USDC) | [Strategy bundle](/guides/strategy-bundle) |
| 2 | Deploy per-creator contract stack | [Launch vault](/guides/launch-token) |
| 3 | Activate vault (deposit + auction seed) | [Activate vault](/guides/activate-vault) |
| 4 | Monitor CCA until completion | [After activation](/guides/after-activation) |
| 5 | Finalize (onchain completion; optional Solana bridge via Pipe A) | [Solana share mesh](/overview/solana-share-mesh) |
| 6 | Strategy attachment (Charm + Ajna from bundle) | [How it works](/overview/how-it-works) |

Solana integration is **optional**. Base serves as the hub chain for launch, trading, and lottery for new vaults.

## Launch milestones

| Milestone | Definition |
|-----------|------------|
| **Deployed** | Per-creator contracts deployed; vault not yet funded |
| **Activated** | Creator coin deposited; CCA **in progress** |
| **Trading live** | CCA **complete**; `■` shares tradable on Base; qualifying **buys** may enter the lottery |

Public secondary trading on Base begins after the auction completes, not at activation alone.

## Frequently asked questions

### What does the $499 USDC fee cover?

The **`vault_full_deploy`** bundle unlocks deploy and enables Charm active LP, Ajna sleeve, Solana share mesh (Pipe A), and Meteora entitlement. It does **not** include the creator coin vault deposit. See [Strategy bundle](/guides/strategy-bundle).

### Why is the activation deposit 50M–100M creator coin?

Greenfield vaults require a substantial creator coin deposit at activation, allocated to the vault and CCA seeding. The application displays the configured minimum and maximum for your deployment version.

### What asset do buyers receive?

Buyers receive **`■` tradable shares** (ShareOFT), not the Zora creator coin. Creator coin is the vault deposit asset; shares represent claims on vault value.

### Is Solana required?

No. Base is the hub chain. Solana receives a bridged **`■` share** slice after finalize when Pipe A is enabled; creator coin remains on Base. See [Solana share mesh](/overview/solana-share-mesh).

### What wallet configuration is required?

A 4626 account with execution-ready signing in the application (including Coinbase Smart Wallet / Base App paths where applicable). Complete wallet setup before deploy if prompted.

## Application entry point

**[app.4626.fun/deploy/vault](https://app.4626.fun/deploy/vault)**

Sign in, confirm `vault_full_deploy` is active, then proceed through Deploy and Activate.

## Related documentation

| Topic | Page |
|-------|------|
| Fee lanes and lottery | [How it works](/overview/how-it-works) |
| Launch procedure | [Launch checklist](/guides/greenfield-checklist) |
| After activation | [After activation](/guides/after-activation) |
| Shared contract addresses | [Addresses](/reference/addresses) |
| Terminology | [Glossary](/reference/glossary) |
