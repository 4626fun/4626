---
title: Delayed Completion
sidebar_position: 2
---

# Delayed Completion

Handling slow or stuck transactions.

## ERC-4337 Transactions

Smart Wallet transactions go through bundlers which may take longer:

1. **Wait** - Bundlers batch transactions, may take 30-60 seconds
2. **Check status** - View pending UserOps on bundler explorer
3. **Retry** - If timeout after 5 minutes, retry the operation

## Standard Transactions

For EOA transactions:

1. **Check gas** - Ensure sufficient gas limit
2. **Increase gas** - If stuck, speed up with higher gas price
3. **Nonce issues** - Cancel pending txs if nonce is blocked

## Cross-Chain Transactions

LayerZero bridges may take time:

1. **Check LayerZero Scan** - Track message status
2. **Wait for finality** - Some chains require confirmations
3. **Retry** - If stuck >30 minutes, check DVN status
