---
title: Troubleshooting
sidebar_position: 4
---

# Troubleshooting

Common issues and solutions when working with the 4626 protocol.

---

## Guides

| Guide | Description |
|-------|-------------|
| [Compilation status](./compilation-status) | Build and compile errors |
| [Delayed completion](./delayed-completion) | Slow or stuck transactions |
| [UserOp signature errors](./userop-signature-errors) | ERC-4337 signing issues |
| [ERC-4337 debugging](/reference/erc4337-debugging) | Account abstraction deep dive |

---

## Quick fixes

### Transaction stuck pending

1. Check gas price is sufficient
2. Verify nonce is correct
3. Ensure wallet has enough ETH for gas

### Vault deposit failing

1. Verify token approval
2. Check minimum deposit requirements
3. Ensure vault is not paused

### Withdrawal reverting

1. Check flash loan delay (1 block minimum)
2. Verify withdrawal amount is available
3. For large withdrawals, use queue system

### Buy fees not collecting

1. Verify address types are set correctly
2. Check GaugeController is linked to ShareOFT
3. Ensure transaction is classified as "buy"

---

## Error messages

### `WithdrawTooSoon`

```
Cause: Attempting withdrawal in same block as deposit
Fix: Wait at least 1 block after deposit
```

### `InsufficientLiquidity`

```
Cause: Not enough idle assets for withdrawal
Fix: Wait for strategy rebalance or use queue
```

### `InvalidAddressType`

```
Cause: Address classification not set
Fix: Call shareOFT.setAddressType(addr, type)
```

### `SlippageExceeded`

```
Cause: Price moved beyond tolerance
Fix: Increase slippage or retry
```

---

## Getting help

If you're stuck:

1. Check [API reference](/api) for function details
2. Review [contract source](https://github.com/4626) 
3. Search existing issues

---

## Related

- [ERC-4337 debugging](/reference/erc4337-debugging) - Account abstraction issues
- [Glossary](/reference/glossary) - Term definitions
