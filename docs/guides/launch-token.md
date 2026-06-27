---
title: Launch a vault
sidebar_position: 3
---

# Launch a vault

**Step 2:** create vault and share contracts in **one transaction**. No creator coin moves yet — that’s [Step 3: Activate](/guides/activate-vault).

Prerequisites: [Launch bundle paid](/guides/strategy-bundle) · [Checklist](/guides/greenfield-checklist)

## What deploy creates

The app uses shared 4626 infrastructure to deploy **your** stack on Base: vault, share tokens, fee controller, oracle, and auction. You choose names/symbols (e.g. `▢AKITA`, `■AKITA`).

After deploy you’re **deployed** but not **activated** — the vault is empty until activation.

## Before Deploy

- Launch bundle shows **active**  
- Correct creator coin address in app  
- **50M–100M** coin in wallet (for activation next)  
- Wallet signing ready  

## In the app

1. **[app.4626.fun/deploy/vault](https://app.4626.fun/deploy/vault)**  
2. Sign in; confirm creator coin  
3. Set vault / share names and symbols  
4. Submit **Deploy**; wait for confirmation  

## What’s created

| Piece | Role |
|-------|------|
| Vault | Will hold creator coin after activation |
| Share tokens | ▢ internal + ■ tradable |
| Registry entry | Links coin → your contracts |
| Gauge, oracle, auction | Fees, pricing, fair launch |

Details: [Contracts hub](/contracts) · Shared infra: [addresses](/reference/addresses) v1.14.1

## Next

**[Activate vault](/guides/activate-vault)** — deposit coin and start the auction.
