# ERC-4337 Signature Verification Debugging - Summary

## Problem
UserOp signature verification was failing with error:
```
"Invalid UserOp signature or paymaster signature" (code: -32507)
```

## Architecture

### Smart Wallet Setup
- **Canonical Smart Wallet**: `0xab6d5c10b03300326cd7fab7267ae192842967b5` (Coinbase Smart Wallet on Base)
- **Privy Embedded EOA**: `0xD1780Fc23F810b52d8cF277E54842DD8803c9361` (owner at index 3)
- **Privy Smart Wallet**: `0x9Ff6B2e920E7DC10Cb2dbd4A8EE526b2fBee3Ba6` (owner at index 4)
- **EntryPoint**: v0.6 (`0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789`)
- **Paymaster**: CDP Paymaster (gas sponsorship)

### Signing Flow
1. `DeployVault.tsx` creates `embeddedWalletClientAdapter` using Privy's embedded EOA
2. `sendCoinbaseSmartWalletUserOperation` in `coinbaseErc4337.ts`:
   - Finds owner index via `findCoinbaseSmartWalletOwnerIndex`
   - Creates owner account via `createWalletBackedLocalAccount`
   - Creates Coinbase Smart Account via viem's `toCoinbaseSmartAccount`
   - Sends UserOp via bundler with CDP paymaster

### Coinbase Smart Wallet Signature Verification
On-chain verification uses `SignatureCheckerLib.isValidSignatureNow`:
1. Computes `replaySafeHash = EIP712(ReplaySafeHash(userOpHash))`
2. Tries `ecrecover(replaySafeHash, sig)` - raw ECDSA
3. Tries `ecrecover(toEthSignedMessageHash(replaySafeHash), sig)` - EIP-191 prefixed

viem's `toCoinbaseSmartAccount` handles the ReplaySafeHash wrapping internally before calling the owner's `sign` method.

## Issues Found & Fixed

### 1. Privy Signature Response Format (LIKELY ROOT CAUSE)
**File**: `frontend/src/pages/DeployVault.tsx`

**Problem**: Privy's embedded wallet returns signatures as an object:
```json
{
  "method": "personal_sign",
  "data": {
    "signature": "0x3545c51...",
    "encoding": "hex"
  }
}
```
But our code was passing the entire object to viem instead of extracting the signature string.

**Fix**: Extract signature from response object:
```typescript
const rawResult = await embeddedProvider.request({
  method: 'personal_sign',
  params: [hashToSign, signerAddr],
})
// Privy may return { signature, encoding } or raw string
const sig = typeof rawResult === 'object' && rawResult?.signature 
  ? rawResult.signature 
  : rawResult
return sig
```

### 2. TWAP Oracle History Unavailable
**File**: `frontend/src/lib/cca/marketFloor.ts`

**Problem**: ZORA reference V3 pools didn't have enough oracle observation history for TWAP calculation.

**Fix**: Added fallback to use spot price from `slot0` when TWAP fails:
```typescript
// Added slot0 to ABI
{
  type: 'function',
  name: 'slot0',
  stateMutability: 'view',
  inputs: [],
  outputs: [
    { name: 'sqrtPriceX96', type: 'uint160' },
    { name: 'tick', type: 'int24' },
    // ...
  ],
}

// Added getV3SpotTick function and fallback in getZoraReferenceV3Ticks
```

### 3. Double EIP-712 Wrapping (Attempted Fix - Not the Issue)
**Problem**: Initially suspected viem wasn't wrapping with ReplaySafeHash, so we added our own wrapping. This caused double-wrapping.

**Resolution**: viem's `toCoinbaseSmartAccount` DOES handle ReplaySafeHash wrapping. Our adapter should NOT wrap again - just sign what viem passes.

### 4. Signing Method Selection
**File**: `frontend/src/pages/DeployVault.tsx`

**Current approach**:
1. Try `eth_sign` first (raw signature over hash)
2. Fall back to `personal_sign` if `eth_sign` fails (EIP-191 prefixed)

Both are accepted by `SignatureCheckerLib`.

## Key Files

### `frontend/src/pages/DeployVault.tsx`
- `DeployVaultBatcher` component handles multi-phase deployment
- `sendPhaseCalls` function has 3 paths:
  - PATH 1: Direct Coinbase Wallet (uses `useSendCalls`)
  - PATH 2: Privy embedded EOA as signer (uses `sendCoinbaseSmartWalletUserOperation`)
  - PATH 3: Connected EOA as signer (uses `sendCoinbaseSmartWalletUserOperation`)
- `embeddedWalletClientAdapter` wraps Privy's embedded provider

### `frontend/src/lib/aa/coinbaseErc4337.ts`
- `sendCoinbaseSmartWalletUserOperation`: Main function for ERC-4337 UserOps
- `createWalletBackedLocalAccount`: Creates viem LocalAccount for signing
- `findCoinbaseSmartWalletOwnerIndex`: Finds owner's index on smart wallet
- `verifyBundlerSupportsV06`: Ensures bundler supports EntryPoint v0.6

### `frontend/src/lib/cca/marketFloor.ts`
- `computeMarketFloorQuote`: Calculates market floor price for CCA
- `getZoraReferenceV3Ticks`: Gets TWAP ticks from V3 pools (with spot fallback)

## Configuration

### Privy App Config (`docs/cmk411efm034jl50cs618o8cy.json`)
- `smart_wallet_type`: "coinbase_smart_wallet"
- `smart_wallet_version`: "1.1"

### Owner Indices on Canonical Smart Wallet
- Index 2: `0xb73997c9be39879feb11bb63eb8c36444acb208f`
- Index 3: `0xD1780Fc23F810b52d8cF277E54842DD8803c9361` (Privy embedded EOA)
- Index 4: `0x9Ff6B2e920E7DC10Cb2dbd4A8EE526b2fBee3Ba6` (Privy Smart Wallet)

## Debugging Logs Added

```typescript
// In coinbaseErc4337.ts
console.log('[sendCoinbaseSmartWalletUserOperation] Owner index lookup', {
  smartWallet,
  ownerAddress,
  ownerIndex,
})

console.log('[createWalletBackedLocalAccount] sign called', {
  hash,
  hashLength: hash?.length,
  address,
})

// In DeployVault.tsx
logger.info('[DeployVault] eth_sign called', {
  signer: signerAddr,
  hashToSign,
  hashLength: hashToSign?.length,
})
```

## Testing Checklist

1. Verify owner index is found correctly (should be 3 for embedded EOA)
2. Verify hash being signed is 66 chars (0x + 64 hex)
3. Verify signature is extracted from Privy response object
4. Check if `eth_sign` succeeds or falls back to `personal_sign`
5. Verify paymaster responds with valid `paymasterAndData`

## Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `Invalid UserOp signature or paymaster signature` | Wrong signature format, wrong hash, wrong owner index | Check all signing flow |
| `AA40 over verificationGasLimit` | Smart wallet signer needs more gas | Increase `verificationGasLimit` to 500k |
| `max sponsorship cost per user op exceeded` | Gas cost exceeds paymaster limit | Increase limit in CDP Dashboard |
| `ZORA reference pools do not have enough oracle history` | V3 pools lack TWAP data | Added spot price fallback |

## Next Steps if Still Failing

1. Verify the signature is now a string (not object) in bundler request
2. Check owner index matches on-chain
3. Verify the hash viem passes to `sign()` is the replaySafeHash (not raw userOpHash)
4. Test with a different wallet/signer to isolate the issue
