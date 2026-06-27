---
title: CSW Owner Index Drift Recovery
---

# CSW Owner Index Drift Recovery

This runbook covers the failure mode where keeper/deploy automation is configured with a stale Coinbase Smart Wallet owner index.

Use this after any `isCoinbaseSmartWalletOwner` mismatch, unexplained AA execution failure, or repeated `addOwnerAddress`/batch execution reverts with an otherwise valid signer.

## Symptoms

- The signer address is a known CSW owner, but AA execution fails.
- Keeper/deploy sessions fail consistently after retries with the same owner index.
- Read paths succeed, but write paths that depend on owner-index resolution fail.

## Preconditions

- Wallet and chain are correct (`Base`).
- Canonical CSW address is confirmed for the account.
- Signer address is confirmed as an onchain owner of the canonical CSW.

## Recovery Steps

1. **Pause retries for the failing session**
   - Do not keep replaying the same UserOp with the same inferred owner index.
2. **Re-resolve canonical owner set from chain**
   - Resolve owner list from canonical CSW directly.
   - Recompute the signer's owner index from current onchain owners.
3. **Refresh session state**
   - Rebuild the execution context using the recomputed owner index.
   - Ensure stale cached owner-index values are invalidated.
4. **Re-run owner confirmation**
   - Call `/api/wallet/confirm-owner` and verify `isOwner: true`.
5. **Retry one bounded execution**
   - Re-run the blocked AA/deploy step once with refreshed owner index.
   - If it still fails, escalate (do not loop retries).

## Validation Checklist

- Canonical CSW unchanged.
- Signer still present in owner set.
- Owner index in runtime context matches recomputed index.
- Previously failing action succeeds once with refreshed context.

## Escalation

Escalate immediately if any of the following occurs:

- signer is no longer an owner onchain
- canonical CSW changed unexpectedly
- owner-index recomputation is non-deterministic across retries
- refreshed context still fails with deterministic reverts

## Related Docs

- `docs/operations/owner-install-reference-methods.md`
- `docs/operations/deployment/launch/ship-checklist.md`
