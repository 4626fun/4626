---
title: Troubleshooting
sidebar_position: 4
---

# Troubleshooting

Common issues and solutions.

## Guides

| Issue | Guide |
|-------|-------|
| Compilation errors | [Compilation Status](/guides/troubleshooting/compilation-status) |
| Slow transactions | [Delayed Completion](/guides/troubleshooting/delayed-completion) |
| ERC-4337 errors | [UserOp Signature Errors](/guides/troubleshooting/userop-signature-errors) |

## Quick Fixes

### Transaction Stuck

1. Check gas price on [BaseScan](https://basescan.org)
2. If using Smart Wallet, wait for bundler confirmation
3. If timeout, retry with higher gas

### Deployment Failed

1. Ensure sufficient token balance (50M minimum)
2. Check approval status
3. Verify wallet connection

### Lottery Not Triggering

1. Verify DEX pool is marked as `SwapOnly`
2. Check lottery is enabled
3. Ensure trade meets minimum ($1 USD)
