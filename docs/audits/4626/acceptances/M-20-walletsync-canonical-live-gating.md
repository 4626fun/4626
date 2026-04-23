# M-20 / 4626-432 — Require persisted canonical/active-owner EVM wallets to match live Privy classification

## Severity
MEDIUM · Category: Authorization / Stale-identity resurrection

## Finding (from Codex audit 2026-04-23)
`frontend/server/_lib/wallet/walletSync.ts` → `applyPersistedIdentity` currently
accepts the persisted `canonicalSmartWallet` and `activeOwnerWallet` as durable
source-of-truth without verifying that the addresses are still linked to the
Privy user in the **current** classification payload. The Solana equivalents
already enforce this via `isSolanaWalletAddressInClassification`, but the EVM
paths (lines 399 and 483 in the audit snapshot) do not.

Consequence: if a user unlinks their canonical smart wallet or active-owner
signer from Privy, the next session bootstrap can resurrect the stale address
from the `profiles` row and re-assert it as the canonical signer. Downstream
paymaster-ownership checks and canonical submit guards (Architecture B) will
then treat the unlinked wallet as authoritative.

## Fix
Introduce `isEvmWalletAddressInClassification` as the direct EVM analogue of the
existing Solana helper, and gate the persisted canonical EVM wallet and the
persisted active-owner wallet on it. When the persisted value is no longer
present in the live classification, fall back to the live
`classification.canonicalSmartWallet` / `classification.activeOwnerWallet`
(which may be null). Never silently re-inject the persisted address.

## Files changed
- `frontend/server/_lib/wallet/walletSync.ts` (+28 / -5)

## Acceptance
1. Given a profile with a persisted canonical CSW that **is** present in the
   current Privy payload, behaviour is unchanged.
2. Given a profile with a persisted canonical CSW that is **no longer** present
   in the Privy payload:
   - `canonicalSmartWallet` falls back to the classification value (may be null).
   - `allWallets` does not contain the stale canonical.
3. Same invariants hold for `activeOwnerWallet`.
4. Solana behaviour is unchanged.

## Rollback
Revert this PR. No DB migration, no env changes.

## References
- Symmetric helper: `isSolanaWalletAddressInClassification` in the same file
- Codex finding id: row 32 of
  `codex-security-findings-2026-04-23T18-31-56.185Z.csv`
