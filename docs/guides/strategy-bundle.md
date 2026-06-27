---
title: Strategy bundle
sidebar_position: 3
---

# Strategy bundle

Greenfield vault deploy requires a paid **`vault_full_deploy`** bundle before the app unlocks deploy.

## What you buy

One **$499 USDC** payment on Base activates:

| Included | Role |
|----------|------|
| **Charm active LP** | CREATOR/USDC liquidity strategy |
| **Ajna sleeve** | CREATOR lending sleeve |
| **Solana share mesh** | Phase 2b Pipe A — bridged ■ share slice at finalize (not Phase 3 TVL) |
| **Meteora entitlement** | Operator-provisioned Solana pool infra post-deploy |

Phase 3 weights with the bundle: **45% Charm · 45% Ajna · 10% idle** CREATOR buffer on the vault.

À-la-carte strategy keys are not sold separately for new vaults.

## How to activate

1. Open **[app.4626.fun/creator/strategy/features](https://app.4626.fun/creator/strategy/features)**
2. Pay with **USDC transfer**, **x402**, or **Stripe checkout** (app surfaces the path)
3. Confirm **`vault_full_deploy`** shows active before [Launch vault](/guides/launch-token)

The deploy page blocks dry-run until the bundle is active.

## What it does not cover

- Your **50M–100M creator coin** deposit (separate from the $499 fee)
- Gas — canonical smart-wallet deploy paths may be sponsored when paymaster is configured
- Grandfathered vaults (e.g. AKITA) may predate the bundle; new greenfield deploys use v1.14.1 + bundle gate

## Related

- [Launch vault](/guides/launch-token)
- [How it works — strategies & fees](/overview/how-it-works)
- [CreatorOVault](/contracts/core/creator-ovault)
