# M-22 — On-chain owner fallback bypasses profile linkage revocation

**Linear:** [4626-434](https://linear.app/4626fun/issue/4626-434)
**Severity:** MEDIUM
**Codex finding:** [4282cf12fdb48191a6f91a3aeaafe1fc](https://chatgpt.com/codex/cloud/security/findings/4282cf12fdb48191a6f91a3aeaafe1fc)
**File:** `frontend/api/_handlers/deploy/session/_create.ts`
**Base SHA:** `43746e1ced400e60e00c10c527939f250db23896`

## Finding

`checkCanonicalWalletOwnership` previously fell back to an on-chain owner check
whenever the off-chain profile-linkage lookup did not produce a clean match.
The five fallback branches (lines 1110, 1126, 1135, 1140, 1147 at base SHA) all
called `onchainOwnerCheck()` and accepted its `ok: true` result. Three of those
branches are legitimate null-linkage cases (no DB configured, no canonical row,
no authority row), but two of them – "authority points to a different CSW" and
"session wallet is not the active owner" – represent **deliberate revocation**.
Accepting the on-chain fallback in those cases let a wallet that had been
unlinked from the profile (or whose session had been rotated out) keep creating
deploy sessions as long as it remained an on-chain owner of the smart wallet.

Additionally, any thrown exception from `ensureWaitlistSchema`, the
`profile_wallets` query, or `readProfileWalletAuthority` propagated unhandled.
Because those queries run before the linkage checks, a transient DB failure
could skip the linkage logic entirely and cause the caller to rely on whatever
fallback path happened to be reached – effectively the same bypass whenever the
DB was degraded.

## Fix

1. Distinguish **null linkage** from **DB failure**:
   - `!db` (no Postgres configured) continues to fall through to the on-chain
     check. There is no off-chain linkage state in this environment, so the
     chain is the source of truth.
   - Every DB interaction past that point (`ensureWaitlistSchema`, canonical
     row query, `readProfileWalletAuthority`) is now wrapped in `try/catch`.
     On any thrown error the function **fails closed** with a new
     `DeploySessionRequestError(503, 'Canonical wallet linkage lookup temporarily unavailable. Please retry.')`.
   - Null-linkage results (no canonical row, no authority row) still fall
     through to the on-chain check – nothing was revoked because nothing was
     ever linked.

2. Remove on-chain fallback for **revocation branches**:
   - `authority.canonicalSmartWalletAddress !== smartWalletLc` now returns
     `{ ok: false, reason: 'canonical_wallet_linkage_revoked' }` instead of
     re-attempting the on-chain check. Linkage exists and points elsewhere –
     the caller has been deliberately unlinked/re-linked.
   - Session-wallet mismatch (linkage exists for this CSW but session isn't the
     recorded active owner) now returns
     `{ ok: false, reason: 'session_not_linkage_owner' }`. Linkage exists but
     the session wallet was rotated out – on-chain fallback would defeat the
     rotation.

3. `console.warn` telemetry added for each DB-failure path so the cause is
   visible in logs and can be paged on.

## Acceptance tests (to be added in PR)

- Integration test: seed `profile_wallets` with linkage `{smartWallet=A, activeOwner=O1}`. Update authority so `canonicalSmartWalletAddress=B` (different wallet). Call `checkCanonicalWalletOwnership({smartWallet=A, ownerAddress=O1, sessionAddress=O1})` where `O1` is still an on-chain owner of `A`. **Expected:** `{ ok: false, reason: 'canonical_wallet_linkage_revoked' }` (previously returned `{ ok: true }` via on-chain fallback).
- Integration test: linkage `{smartWallet=A, activeOwner=O2}`; call with `sessionAddress=O1` where `O1` is on-chain owner but not the active session wallet. **Expected:** `{ ok: false, reason: 'session_not_linkage_owner' }` (previously `{ ok: true }`).
- Integration test: mock `db.sql` to throw on the `profile_wallets` query. **Expected:** `DeploySessionRequestError` with `status=503` and message starting with `"Canonical wallet linkage lookup temporarily unavailable"`. The handler must surface 503, not 403 or 500.
- Regression test: DB not configured (`getDb` returns null). **Expected:** on-chain fallback still runs and returns `ok: true` for a valid on-chain owner (unchanged behaviour for local/preview envs).
- Regression test: canonical row absent (profile never linked). **Expected:** on-chain fallback still runs and returns `ok: true` for a valid on-chain owner.

## Out of scope

- Re-architecting `OwnershipCheck` to carry a `retryable` flag — the existing
  error-throwing convention used elsewhere in the file (e.g. the 503 for vanity
  entitlement check at line 1270) is the idiomatic way to surface a retryable
  failure to the caller.
- Migrating the linkage store to a different backend.
