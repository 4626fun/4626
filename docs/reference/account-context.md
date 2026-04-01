---
title: Account Context
sidebar_position: 10
---

# Account Context Hardening

## Purpose

This document defines the canonical wallet-execution model used by the app so we stop treating `connected address === user` as a global truth.

The canonical 4626 account identity is the user's verified email. This document is only about signer, CSW, and active-account behavior after auth. See [frontend/docs/account-auth-invariants.md](frontend/docs/account-auth-invariants.md).

It aligns frontend and backend behavior for:

- EOA connections (MetaMask/Rabby/embedded)
- direct Smart Wallet connections (Coinbase Smart Wallet/Base app)
- EOA owner relationships to canonical Smart Wallets
- AA capability gating (paymaster/batching)

## Core model

```ts
type SignerType = 'EOA' | 'SMART_WALLET' | 'UNKNOWN'

type AccountCapabilities = {
  paymasterService: boolean
  atomicStatus: 'supported' | 'ready' | 'unsupported' | 'unknown'
  supports5792: boolean
}

type AccountContext = {
  chainId: number | null
  chainIdHex: `0x${string}` | null
  signerAddress?: `0x${string}`
  signerType: SignerType
  cswAddress?: `0x${string}`
  eoaIsOwnerOfCsw: boolean | null
  activeAccount?: `0x${string}`
  activeAccountType: 'EOA' | 'SMART_WALLET' | 'UNKNOWN'
  capabilities: AccountCapabilities
  uiFlags: {
    aaAvailable: boolean
    paymasterAvailable: boolean
    canUseSmartWalletMode: boolean
    shouldPromptToLinkOwner: boolean
    shouldShowNetworkMismatch: boolean
  }
}
```

## Signer vs active account

- **signerAddress**: the account currently connected to the provider (what signs).
- **activeAccount**: the account app flows act as.

These can diverge:

- EOA connected + owns canonical CSW + preferred smart mode:
  - signerAddress = EOA
  - activeAccount = CSW
- direct CSW connection (Base app):
  - signerAddress = CSW
  - activeAccount = CSW

## Detection ladder (signer type)

Order of precedence:

1. `wallet_getCapabilities` indicates AA features (`paymasterService` or `atomic`) => `SMART_WALLET`
2. Onchain bytecode at signer (`getCode != 0x`) => `SMART_WALLET`
3. Otherwise => `EOA`

This avoids false EOAs for counterfactual smart wallets where bytecode can be empty.

## Capability probe (EIP-5792)

Primary probe:

```ts
provider.request({
  method: 'wallet_getCapabilities',
  params: [signerAddress, [chainIdHex]],
})
```

If unsupported or failing, capabilities fall back safely:

- `paymasterService = false`
- `atomicStatus = 'unknown'`
- no connection/auth breakage

## Ownership check (EOA -> CSW)

When signer is EOA and a CSW is known, ownership is checked on Base using:

```solidity
isOwnerAddress(address account) returns (bool)
```

Result is tri-state:

- `true`: ownership verified
- `false`: ownership denied
- `null`: unknown (revert/RPC error/wrong chain/missing params)

Wrong-chain behavior is explicit (`shouldShowNetworkMismatch`) and never silently treated as `false`.

## Active-account resolution

1. If signer is smart wallet:
   - active = signer
   - active type = smart wallet
   - CSW defaults to signer
2. If signer is EOA:
   - resolve canonical CSW from profile/waitlist data
   - if owner check `true` + preferred smart mode => active = CSW
   - else active = EOA signer

User preference never overrides safety checks.

## AA gating

AA UX unlocks only when active account is smart-wallet mode and capability checks support it.

- `paymasterAvailable`: smart mode + paymaster capability
- `aaAvailable`: smart mode + (`paymasterService` or `atomic` ready/supported)

## Edge cases

- **Direct CSW connect**: app enters smart-wallet mode immediately.
- **Counterfactual SW**: capability-first detection prevents misclassification.
- **Wrong chain**: ownership returns unknown + UI mismatch hint.
- **Unknown CSW**: app remains usable in EOA mode and prompts for smart-wallet setup.
