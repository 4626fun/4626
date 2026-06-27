---
title: Launch a vault
sidebar_position: 3
---

# Launch a vault

**Launch step 2:** deploy the per-creator contract stack in a single atomic transaction. Creator coin is **not** transferred at this stage — funding occurs at [Activate vault](/guides/activate-vault) (step 3).

Prerequisites: [Strategy bundle](/guides/strategy-bundle) active · [Launch checklist](/guides/greenfield-checklist)

## Overview

The application invokes shared 4626 deployment infrastructure (`DeploymentBatcher`, v1.14.1) to deploy vault, wrapper, ShareOFT, gauge, oracle, and CCA contracts for your creator coin. You configure vault and share naming (e.g. `▢AKITA`, `■AKITA`).

At completion, the vault is **deployed** but **unfunded** until activation.

## Pre-deploy verification

- `vault_full_deploy` entitlement **active**
- Creator coin address confirmed in application
- **50M–100M** creator coin available in execution wallet (for subsequent activation)
- Wallet signing execution-ready per application prompts

## Application procedure

1. Navigate to **[app.4626.fun/deploy/vault](https://app.4626.fun/deploy/vault)**
2. Authenticate and confirm creator coin address
3. Configure vault and share names and symbols
4. Submit **Deploy** and await onchain confirmation

Canonical smart-wallet execution may route through sponsored ERC-4337 UserOps where paymaster policy allows.

## Deployed components

| Component | Role |
|-----------|------|
| CreatorOVault | ERC-4626 vault (deposit asset: creator coin) |
| Share tokens | `▢` vault shares and `■` ShareOFT |
| CreatorRegistry entry | Maps creator coin → deployed stack |
| CreatorGaugeController | Trade fee and jackpot routing |
| CreatorOracle | TWAP pricing |
| CCA launch strategy | Fair-launch auction |

Contract reference: [Contracts hub](/contracts) · Shared addresses: [v1.14.1](/reference/addresses)

## Next step

[Activate vault](/guides/activate-vault) — deposit creator coin and seed the CCA (launch step 3).
