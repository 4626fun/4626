---
title: Deployment
sidebar_position: 10
slug: /compressions/deployment
---

# Deployment Compression

CreatorVault compresses a multi-contract, multi-role setup into a single creator action, aiming for **one signature** and **no gas** when available.

## What “One Click” Actually Means

At a high level, the deploy flow bundles:

- Vault + wrapper + OFT share token
- Oracle + fair launch strategy wiring
- Registration in the registry
- Optional activation steps (depending on wallet capability and configuration)

The product intent is “one click,” but the system still needs explicit fallback paths for wallets that cannot batch or when sponsorship is unavailable.

## Execution Assumptions

- **Account abstraction (EIP-4337)**: smart accounts can be the execution surface.
- **Wallet batching (EIP-5792)**: supported wallets can execute a sequence via `wallet_sendCalls`.
- **Paymaster sponsorship**: if a paymaster is configured, gas can be sponsored; otherwise, fallback to user-paid gas.

## Next

- [Getting Started](/getting-started)
- [Account primitive](/primitives/account)
- [Architecture](/architecture)

