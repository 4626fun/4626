---
title: Vault activation
sidebar_position: 1
---

# Vault activation with account abstraction

This document describes how CreatorVault reduces vault activation from 6 separate transactions to a single click using EIP-5792 batching and onchain batcher contracts. It covers both smart wallet and EOA flows, as well as operator-safe activation patterns.

**Who this is for:** Frontend developers, protocol integrators, and anyone implementing vault activation flows.

**Key terms:**

- **EIP-5792:** Standard for batching multiple calls into a single wallet interaction
- **VaultActivationBatcher:** Onchain contract that performs deposit, wrap, and auction launch atomically
- **Permit2:** Uniswap's signature-based approval system for gasless token transfers

---

## How It Works

### Traditional Flow (6 separate transactions)

```
User -> Approve AKITA -> Wait...
User -> Deposit AKITA -> Wait...
User -> Approve shares -> Wait...
User -> Wrap shares -> Wait...
User -> Approve ■TOKEN -> Wait...
User -> Launch auction -> Wait...
```

### AA Flow (1 transaction)

```
User -> Launch Auction (1-Click) -> Done!
  |
  v
Smart Wallet batches:
  1. approve(AKITA, VaultActivationBatcher, amount)
  2. VaultActivationBatcher.batchActivate(AKITA, vault, wrapper, cca, amount, 50, requiredRaise)

Where batchActivate performs (inside the contract, with correct ERC-4626 share accounting):
  - deposit(amount) -> receives vault shares (▢TOKEN)
  - wrap(shares) -> ■TOKEN
  - approve + launchAuctionSimple()
  - transfers remaining ■TOKEN back to the user
```

---

## Operator-Safe Activation (Identity vs Execution Wallet)

If `msg.sender` is an operator (execution wallet), activation must still be bound to a single identity:

- The batcher requires `identity == Ownable(vault).owner()`
- The operator must be authorized by the vault owner: `CreatorOVault.isAuthorizedOperator(operator, OP_ACTIVATE)`
- Any remaining ■TOKEN is returned to identity (never to `msg.sender`)

Permit2 funding models:

- **Identity-funded**: identity signs Permit2; operator submits tx (`batchActivateWithPermit2For`)
- **Operator-funded**: operator provides tokens (`batchActivateWithPermit2FromOperator`)

---

## Implementation

### Frontend (`LaunchVaultAA.tsx`)

```typescript
const calls = [
  // 1) Approve tokens to the on-chain batcher
  { to: creatorToken, data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [VAULT_ACTIVATION_BATCHER, depositAmount] }) },
  // 2) Activate (deposit -> wrap -> auction) inside the batcher
  { to: VAULT_ACTIVATION_BATCHER, data: encodeFunctionData({ abi: VaultActivationBatcherABI, functionName: 'batchActivate', args: [creatorToken, vault, wrapper, ccaStrategy, depositAmount, 50, requiredRaise] }) },
]

// Prefer wallet_sendCalls (AA) and fall back to sequential transactions when unsupported.
await sendCallsAsync({ calls, forceAtomic: true })
```

### Smart Contract Fallback (`VaultActivationBatcher.sol`)

For users without smart wallets (MetaMask, Rainbow, etc.), we provide a helper contract:

```solidity
contract VaultActivationBatcher {
  // New deployments set Permit2 once:
  constructor(address permit2) {}

  function batchActivate(
    address creatorToken,
    address vault,
    address wrapper,
    address ccaStrategy,
    uint256 depositAmount,
    uint8 auctionPercent,
    uint128 requiredRaise
  ) external returns (address auction) {
    // Pulls tokens, deposits, wraps, launches auction
    // Returns remaining ■TOKEN to user
  }

  // Operator-safe Permit2 flows (leftovers always go to identity):
  function batchActivateWithPermit2For(address identity, ...) external returns (address auction) {}
  function batchActivateWithPermit2FromOperator(address identity, ...) external returns (address auction) {}
}
```

**Usage:**

```typescript
// 1. User approves batcher to spend AKITA
approve(AKITA, batcher, amount)

// 2. User calls batchActivate
batchActivate(AKITA, vault, wrapper, cca, amount, 50, minRaise)
```

---

## User Experience

### With Coinbase Smart Wallet

```
1. Click "Launch Auction (1-Click)"
2. Confirm ONCE in wallet
3. Done
```

**Benefits:**

- Single confirmation
- Potentially gasless (sponsored)
- Instant execution
- No intermediate failures

### With EOA (MetaMask, etc.)

```
1. Click "Launch Auction (1-Click)"
2. App switches to VaultActivationBatcher
3. Approve batcher (if needed)
4. Call batchActivate
5. Done
```

**Benefits:**

- Still 2 transactions (vs 6)
- Atomic execution (all or nothing)
- No intermediate token approvals

---

## Why This Matters

### For Users

- **Speed**: 1 click vs 6 confirmations
- **Simplicity**: No complex multi-step flow
- **Safety**: Atomic execution (no partial failures)
- **Cost**: Potentially gasless with smart wallets

### For Creators

- **Lower friction**: More likely to activate vaults
- **Better UX**: Web2 simplicity, Web3 infrastructure
- **Professional**: Enterprise-grade dApp experience

---

## Technical Details

### Smart Wallet Detection

```typescript
const isSmartWallet = connector?.id === 'coinbaseWalletSDK'
```

### Call Encoding

```typescript
encodeFunctionData({
  abi: erc20Abi,
  functionName: 'approve',
  args: [spender, amount],
})
```

### Batch Execution

```typescript
sendTransaction({
  to: address, // Smart wallet address
  data: '0x',
  value: 0n,
  calls: [...], // Array of { to, data, value }
})
```

### Fallback Pattern

```solidity
// If smart wallet batch fails, use helper contract
batcher.batchActivate(...)
```

---

## Deployment

### Frontend

- Already deployed on Vercel
- Smart wallet detection automatic
- Uses `wallet_sendCalls` when supported; falls back to sequential transactions when not

### Contracts

- `VaultActivationBatcher.sol` deployed on Base (configure via `VITE_VAULT_ACTIVATION_BATCHER`)
- Frontend reads `CONTRACTS.vaultActivationBatcher`

---

## Next Steps

To enable the AA + fallback flow on a new deployment:

1. Deploy `VaultActivationBatcher` (if needed) and set `VITE_VAULT_ACTIVATION_BATCHER`
2. Approve the batcher as a launcher on `CCALaunchStrategy` (required because `launchAuctionSimple` is gated by `onlyApprovedOrOwner`)
3. If whitelist is enabled, whitelist the batcher on the vault

---

## Testing

### Smart Wallet Flow

1. Connect with Coinbase Smart Wallet
2. Go to `/activate-akita`
3. Click "Launch Auction (1-Click)"
4. Should batch `approve + batchActivate` into one atomic bundle when supported

### EOA Flow

1. Connect with MetaMask
2. Go to `/activate-akita`
3. Click "Launch Auction (1-Click)"
4. Expect 2 transactions: `approve`, then `batchActivate`
5. Pending: Fallback to VaultActivationBatcher for EOA support

---

## Security Considerations

### Smart Wallet Batching

- Atomic execution (all or nothing)
- User controls all approvals
- No intermediate token custody
- Revert-safe (gas refunded on failure)

### VaultActivationBatcher

- No token custody (pull pattern)
- User must approve first
- ReentrancyGuard on batchActivate
- Returns excess tokens immediately
- User trusts batcher contract code

---

## Gas Comparison

### Traditional (6 txs)

```
Approve:  ~45k gas
Deposit:  ~80k gas
Approve:  ~45k gas
Wrap:     ~60k gas
Approve:  ~45k gas
Launch:   ~200k gas
-----------------------
TOTAL:    ~475k gas (~$15 at 20 gwei)
```

### AA Batched (1 tx)

```
Batch:    ~450k gas (~$14 at 20 gwei)
+ Potentially sponsored (FREE)
```

### Batcher (2 txs)

```
Approve:  ~45k gas
Batch:    ~400k gas
-----------------------
TOTAL:    ~445k gas (~$14 at 20 gwei)
```

**Savings: 6% gas + 83% fewer clicks**

---

## Resources

- [ERC-4337 Spec](https://eips.ethereum.org/EIPS/eip-4337)
- [Coinbase Smart Wallet Docs](https://docs.cloud.coinbase.com/smart-wallet/docs)
- [Wagmi sendTransaction](https://wagmi.sh/react/api/hooks/useSendTransaction)
- [Viem encodeFunctionData](https://viem.sh/docs/contract/encodeFunctionData.html)

---

## Summary

- **Smart Wallet Users**: 1-click, potentially gasless, instant
- **EOA Users**: 2 clicks via VaultActivationBatcher (after deployment)
- **Result**: Professional dApp experience with minimal friction
