---
title: ERC-4337 Debugging
sidebar_position: 4
---

# ERC-4337 Debugging

Guide to debugging account abstraction issues.

## Common Error Codes

| Code | Meaning | Solution |
|------|---------|----------|
| AA10 | Sender not deployed | Deploy account first |
| AA21 | Insufficient prefund | Add gas funds or use paymaster |
| AA24 | Signature validation failed | Check signer/wallet connection |
| AA25 | Invalid nonce | Refresh nonce or wait for pending tx |
| AA31 | Paymaster deposit too low | Paymaster needs funding |
| AA34 | Signature validation failed | Check signature format |

## Debugging Steps

### 1. Check Wallet Connection

```javascript
const address = await wallet.getAddress();
console.log("Connected:", address);
```

### 2. Verify Nonce

```javascript
const nonce = await entryPoint.getNonce(account, 0);
console.log("Current nonce:", nonce);
```

### 3. Test Paymaster

```javascript
const paymasterData = await paymaster.getPaymasterData(userOp);
console.log("Paymaster response:", paymasterData);
```

### 4. Simulate UserOp

```javascript
try {
  await entryPoint.simulateValidation(userOp);
} catch (e) {
  console.log("Simulation error:", e.errorName);
}
```

## Tools

- [Jiffyscan](https://jiffyscan.xyz) - UserOp explorer
- [Bundler debug mode](https://docs.stackup.sh) - Verbose logging
- [Tenderly](https://tenderly.co) - Transaction simulation
