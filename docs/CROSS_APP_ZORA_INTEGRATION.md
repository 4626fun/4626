# Cross-App Zora Wallet Integration

## Overview

This document describes the integration of Zora's embedded wallet into CreatorVault for deploying vaults on behalf of Creator Coin holders. The goal is to allow users who hold Creator Coins on Zora to deploy vaults using their Zora smart wallet as the canonical owner.

## The Problem

Creator Coins are minted on Zora, where users have:
- **Embedded Wallet (EOA)**: `0xD1780Fc23F810b52d8cF277E54842DD8803c9361` - A Privy-managed EOA
- **Smart Wallet**: `0xab6d5c10b03300326cd7fab7267ae192842967b5` - A Coinbase Smart Wallet owned by the EOA

The smart wallet holds the Creator Coins and is the "creator" address for the coin. To deploy a vault, we need to execute transactions **from** this smart wallet.

## Approaches Tried

### Approach 1: Custom Wagmi Connector (Failed)

**What we tried:**
- Created `zoraWalletConnector.ts` using `@privy-io/cross-app-connect`
- Used `toPrivyWalletProvider()` to create an EIP-1193 provider
- Added it to wagmi config as a connector

**Why it failed:**
- The wagmi connector tries to send transactions directly
- Cross-app transactions MUST go through Privy's popup flow on Zora's domain
- The connector bypassed this, causing transactions to fail

**Code removed:** `src/config/zoraWalletConnector.ts`

### Approach 2: Privy's sendTransaction (Failed)

**What we tried:**
- Used `sendTransaction` from `useCrossAppAccounts()`
- Called it with the transaction data and `{ address: zoraEmbeddedWalletAddress }`

**Why it failed:**
```
Error: insufficient funds for transfer
URL: https://mainnet.rpc.privy.systems/?privyAppId=cmk411efm034jl50cs618o8cy
```

The Privy SDK does **local gas estimation** using our app's RPC before opening the popup:

```
┌─────────────────────────────────────────────────────────┐
│              PRIVY sendTransaction FLOW                 │
│                                                         │
│  1. Your app calls sendTransaction()                    │
│                    ↓                                    │
│  2. SDK estimates gas using YOUR app's RPC              │
│     (mainnet.rpc.privy.systems/?privyAppId=YOUR_ID)    │
│                    ↓                                    │
│  3. ❌ FAILS - EOA has no ETH for gas estimation        │
│                    ↓                                    │
│  4. Popup to Zora NEVER opens                           │
└─────────────────────────────────────────────────────────┘
```

The embedded wallet EOA has 0 ETH, so gas estimation fails before the popup can open.

### Approach 3: ERC-4337 with Cross-App Signing (Current)

**What we're trying now:**
- Use `signMessage` from `useCrossAppAccounts()` instead of `sendTransaction`
- Build an ERC-4337 UserOperation
- Have the user sign the UserOp hash via Zora popup (no gas needed!)
- Submit to bundler with CDP paymaster (paymaster pays gas)

**Implementation:**
```typescript
// src/lib/aa/coinbaseErc4337.ts
export async function sendCrossAppUserOperation(params: {
  publicClient: PublicClientLike
  crossAppSignMessage: CrossAppSignMessage
  bundlerUrl: string
  smartWallet: Address
  zoraEmbeddedWalletAddress: Address
  calls: Array<{ to: Address; value?: bigint; data?: Hex }>
}): Promise<{ userOpHash: Hex; transactionHash: Hex }>
```

**Flow:**
```
┌─────────────────────────────────────────────────────────┐
│              ERC-4337 CROSS-APP FLOW                    │
│                                                         │
│  1. Build UserOperation with deploy calls               │
│                    ↓                                    │
│  2. Compute UserOp hash                                 │
│                    ↓                                    │
│  3. signMessage via Zora popup (FREE - no gas!)         │
│                    ↓                                    │
│  4. Submit UserOp to CDP bundler + paymaster            │
│     Paymaster sponsors all gas!                         │
│                    ↓                                    │
│  5. EntryPoint v0.6 executes via smart wallet           │
└─────────────────────────────────────────────────────────┘
```

## Key Findings

### 1. Privy Cross-App Limitations

- `sendTransaction` does local gas estimation before opening popup
- This requires the EOA to have ETH, defeating the purpose
- `signMessage` and `signTypedData` don't require gas (just signature)

### 2. Zora's Architecture

- Uses Coinbase Smart Wallet (supports ERC-4337)
- EntryPoint v0.6: `0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789`
- The embedded EOA is an owner of the smart wallet
- Smart wallet can execute batched calls via `executeBatch`

### 3. Cross-App Account Structure

When a user links their Zora wallet via `linkCrossAppAccount()`, the account looks like:

```typescript
{
  type: 'cross_app',
  embeddedWallets: [{ address: '0xD1780...' }],  // EOA
  smartWallets: [{ address: '0xab6d5c...' }],     // May or may not be exposed
  providerApp: {
    id: 'clpgf04wn04hnkw0fv1m11mnb',  // Zora's Privy app ID
    name: 'Zora',
    ...
  }
}
```

### 4. Signature Format

Coinbase Smart Wallet accepts signatures via `SignatureCheckerLib.isValidSignatureNow()`, which supports:
- Raw signatures (`eth_sign`)
- EIP-191 prefixed signatures (`personal_sign`)

The cross-app `signMessage` uses `personal_sign`, which should be compatible.

## What Needs to Work

### Prerequisites

1. **User must link Zora wallet** via `linkCrossAppAccount({ appId: ZORA_PRIVY_APP_ID })`
2. **Zora EOA must be an owner** of the target smart wallet
3. **CDP paymaster must be configured** for gas sponsorship

### Potential Issues to Verify

1. **Signature format compatibility**
   - Does Coinbase Smart Wallet accept EIP-191 prefixed signatures for UserOp validation?
   - May need to test with actual signing

2. **Owner index resolution**
   - The Zora EOA must be found in the smart wallet's owner list
   - Current code scans up to 256 owner indices

3. **Paymaster sponsorship**
   - CDP paymaster must be willing to sponsor the UserOp
   - May have policy restrictions

4. **Cross-app signing popup**
   - Does `signMessage` work correctly with raw hex hashes?
   - User experience in the Zora popup

## Files Changed

### New/Modified

- `src/lib/aa/coinbaseErc4337.ts`
  - Added `sendCrossAppUserOperation()`
  - Added `createCrossAppSigningAccount()`
  - Exported `findCoinbaseSmartWalletOwnerIndex()`
  - Exported `CrossAppSignMessage` type

- `src/pages/DeployVault.tsx`
  - Updated to use `crossAppSignMessage` instead of `sendCrossAppTransaction`
  - New deploy path using ERC-4337 UserOperations
  - Added debug logging for cross-app account structure

- `src/config/wagmi.ts`
  - Removed broken `zoraWalletConnector`

### Removed

- `src/config/zoraWalletConnector.ts` - Didn't work with cross-app flow

## Testing Checklist

- [ ] Link Zora wallet successfully
- [ ] Verify Zora EOA is detected as owner of smart wallet
- [ ] Zora signing popup opens when deploying
- [ ] User can sign the UserOp hash in popup
- [ ] UserOperation is submitted to bundler
- [ ] Paymaster sponsors the gas
- [ ] Transaction confirms on-chain
- [ ] Vault is deployed with correct owner

## Alternative Approaches (If Current Fails)

### 1. Fund the Zora EOA
- Send ~0.001 ETH to the embedded wallet
- Use `sendTransaction` which would then work
- Downside: User needs to have/send ETH

### 2. Use Privy Smart Wallet Directly
- Don't use cross-app at all
- Have user sign in via Privy on our app
- Deploy using Privy's smart wallet client
- Downside: Different wallet than Zora's

### 3. Request Privy Support
- Ask if there's a way to skip local gas estimation
- Ask if cross-app supports gas sponsorship natively
- May get better guidance on intended usage

## References

- [Privy Cross-App Docs](https://docs.privy.io/guide/react/cross-app/)
- [ERC-4337 Spec](https://eips.ethereum.org/EIPS/eip-4337)
- [Coinbase Smart Wallet](https://github.com/coinbase/smart-wallet)
- [EntryPoint v0.6](https://etherscan.io/address/0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789)
