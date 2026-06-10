---
title: Activate Account Signing
sidebar_position: 4
---

# Activate Account Signing

This guide covers failures in the waitlist/account activation step that asks the user to approve 4626 signing access on their canonical Coinbase Smart Wallet.

## What this step is doing

4626 is not trying to replace the user's Base/Zora smart wallet.

It is doing one of two things:

- asking the canonical Coinbase Smart Wallet to add the 4626 Privy embedded EOA as a new owner
- asking a different current owner wallet to approve that same add-owner call

If this step succeeds, the account becomes wallet-ready for canonical execution.

## Expected prompts

### Canonical wallet selected

The connected signer matches the canonical CSW shown in activation.

Expected behavior:

- the wallet stays on Base
- the wallet submits a smart-wallet approval / user-op
- the target may appear as the same smart-wallet address shown on the screen

This is normal for a CSW self-call.

### Current owner wallet selected

The connected signer is a different wallet that is already one of the current CSW owners.

Expected behavior:

- the wallet submits a normal Base transaction to the canonical CSW

## Common failures

### “Connected wallet is not a current owner”

Cause:

- the connected wallet is not an existing owner of the canonical CSW

Fix:

1. reconnect the wallet that originally controls the Base/Zora smart wallet
2. make sure the address shown in the wallet prompt matches the intended owner
3. retry the approval

### “Switch the connected wallet to Base”

Cause:

- the owner check is running on the wrong chain

Fix:

1. switch the wallet to Base
2. retry owner check
3. retry approval

### Wallet shows “not enough funds” or “error generating transaction”

Cause:

- for canonical smart-wallet mode, this usually means the smart-wallet sponsor/paymaster session is stale or rejected
- it does not necessarily mean the CSW itself needs ETH

Fix:

1. refresh the page
2. sign out and sign back in
3. reconnect the same Base/Zora smart wallet
4. retry approval

### User rejected the wallet request

Cause:

- wallet prompt was dismissed or rejected

Fix:

1. retry the approval step
2. if the wrong signer is selected, switch wallets first

### Approval appears sent but activation does not advance

Cause:

- the add-owner transaction may still be pending
- or `/api/wallet/confirm-owner` has not yet observed the owner onchain

Fix:

1. wait a few seconds
2. retry the owner check
3. reload the activation screen

## Support checklist

When triaging this issue, capture:

1. canonical CSW address shown in activation
2. connected signer address shown in activation
3. whether the connected signer is the same as the canonical CSW
4. exact wallet error text
5. whether the wallet prompt happened in canonical smart-wallet mode or direct owner mode

## Related docs

- `/operations/owner-install-reference-methods`
- `/guides/troubleshooting/userop-signature-errors`
