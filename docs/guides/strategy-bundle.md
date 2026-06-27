---
title: Strategy bundle
sidebar_position: 1
---

# Strategy bundle

**Launch step 1:** activate **`vault_full_deploy`** before the deploy flow is available in the application.

[Getting started](/getting-started) · [Launch checklist](/guides/greenfield-checklist)

## Purpose

Greenfield vault deployments require paid entitlements beyond the core vault contract: liquidity strategies, lending, and optional Solana share mesh infrastructure. **`vault_full_deploy`** is a single **$499 USDC** payment on Base that activates the full bundle.

This fee is **independent** of the **50M–100M creator coin** activation deposit.

## Entitlements

| Entitlement | Function |
|-------------|----------|
| **Charm active LP** (`charm_active_lp`) | CREATOR/USDC liquidity management |
| **Ajna sleeve** (`ajna_sleeve`) | CREATOR lending strategy |
| **Solana share mesh** (`solana_ovault_mesh`) | Pipe A ShareOFT bridge at finalize ([policy](/overview/solana-share-mesh)) |
| **Meteora entitlement** (`solana_meteora_alpha_vault`) | Operator-provisioned Solana pool infrastructure |

Post-launch, vault CREATOR allocation targets approximately **45% Charm · 45% Ajna · 10% idle** buffer. Individual strategy keys are not sold separately for new vaults.

## Activation procedure

1. Open **[app.4626.fun/creator/strategy/features](https://app.4626.fun/creator/strategy/features)**
2. Complete payment via **USDC transfer**, **x402**, or **Stripe checkout** (as offered in the application)
3. Confirm **`vault_full_deploy`** status is **active**
4. Proceed to [Launch vault](/guides/launch-token)

The deploy page remains blocked until step 3 is confirmed.

## Exclusions

- Creator coin activation deposit (50M–100M tokens)
- Network gas (sponsored canonical smart-wallet paths may apply where configured)

## Next step

[Launch vault](/guides/launch-token) — deploy the per-creator contract stack (launch step 2).
