---
title: UserOp Signature Errors
sidebar_position: 3
---

# UserOp Signature Errors

Debugging ERC-4337 signature issues.

## Common Errors

### AA24: Signature Error

The signature doesn't match the expected signer:

1. **Check wallet** - Ensure correct Smart Wallet is connected
2. **Check chain** - Verify you're on the correct network
3. **Refresh** - Disconnect and reconnect wallet

### AA21: Didn't Pay Prefund

Insufficient gas funds:

1. **Check balance** - Ensure account has gas (or paymaster is active)
2. **Check paymaster** - Verify paymaster configuration
3. **Use fallback** - Try without paymaster if issues persist

### AA25: Invalid Signature

Signature format issues:

1. **Update wallet** - Ensure latest wallet version
2. **Clear cache** - Clear browser/wallet cache
3. **Check encoding** - Verify calldata encoding

## Debugging Tips

```bash
# Check UserOp on bundler explorer
# Verify paymaster is responding
# Test with EOA to isolate issue
```

## Reference

See [ERC-4337 Debugging](/reference/erc4337-debugging) for more details.
