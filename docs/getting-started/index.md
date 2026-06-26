---
title: Getting Started
sidebar_position: 2
---

# Getting started

4626 is creator vault infrastructure on Base: ERC-4626 vaults, share tokens, auctions, and lottery mechanics wired to Zora creator coins.

## Read first

1. [Wallet architecture](/wallet-architecture) — canonical CSW, embedded signer, execution tracks
2. [Account model](/ACCOUNT_MODEL) — who can sign what
3. [Connection methods](/4626-connection-methods) — CSW, external EOA, Telegram routing

## Deploy a vault (app)

Production deploy: **[app.4626.fun/deploy/vault](https://app.4626.fun/deploy/vault)**

1. Sign in with verified email (Privy)
2. Complete parent-CSW embedded-owner signing when prompted
3. Activate **`vault_full_deploy`** at [strategy features](https://app.4626.fun/creator/strategy/features) if not already paid
4. Deposit **50M–100M** creator coin to your canonical CSW
5. Run deploy — greenfield target is **[v1.14.1](/operations/deployment/releases/current)**

Gas for canonical CSW paths is sponsored via CDP paymaster when configured; see [sponsored swap pattern](/operations/wallet/sponsored-canonical-swap-pattern) for the UserOp shape operators debug against.

## Local development

```bash
git clone https://github.com/wenakita/4626.git
cd 4626
pnpm install && pnpm -C frontend install
forge build && forge test
pnpm -C frontend dev    # http://localhost:5173
```

Node **20.19+** recommended. Copy `frontend/.env.example` for wallet/auth features.

Dry-run deploy against a mainnet fork:

```bash
pnpm -C frontend run dev:deploy-dry-run   # http://localhost:5174
```

## Next steps

| Goal | Doc |
|------|-----|
| Launch flow | [Launch token](/guides/launch-token) |
| Live infra | [Addresses](/reference/addresses) |
| Operators | [Operators hub](/operators) |
| Fee / lottery model | [Fee flow](/overview/fee-flow) |
| Contribute docs | [Publishing](/publishing) |
