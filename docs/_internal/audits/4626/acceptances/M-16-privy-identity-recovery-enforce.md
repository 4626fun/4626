# M-16 / 4626-428 — Do not swallow `IDENTITY_RECOVERY_REQUIRED` in Privy auth

## Severity
MEDIUM · Category: Authentication bypass / Account takeover precursor

## Finding (from Codex audit 2026-04-23)
In `frontend/api/_handlers/auth/_privy.ts`, the DB-sync catch block currently
reads:

```ts
} catch (dbSyncError) {
  if (isIdentityRecoveryRequiredError(dbSyncError)) {
    if (!sessionAddress) throw dbSyncError
  }
  // best-effort: auth should succeed even if DB is unavailable
}
```

When `classifyLinkedAccounts` has already populated `sessionAddress` from the
in-memory Privy response, the identity-recovery error is **silently swallowed**.
The handler then falls through, mints an HttpOnly session cookie, and returns
200 for an account whose email is already bound to a different profile.

This defeats the `RECOVERY_REQUIRED_EMAIL_BOUND` protection surfaced by other
bootstrap endpoints (accounts/_link, accounts/_merge, deploy/session/_create).

## Fix
Always re-throw `IDENTITY_RECOVERY_REQUIRED` so the outer catch returns 409
`RECOVERY_REQUIRED_EMAIL_BOUND`, regardless of whether a `sessionAddress` was
derivable. Non-recovery DB errors continue to fall through (auth still succeeds
when the DB is simply unavailable).

## Files changed
- `frontend/api/_handlers/auth/_privy.ts` (+14 / -2)

## Acceptance
1. When the DB rejects `syncUserWallets` with `IDENTITY_RECOVERY_REQUIRED`, the
   handler returns 409 with
   `{ success: false, code: 'RECOVERY_REQUIRED_EMAIL_BOUND', recoveryRequired: true }`
   and **does not** set the `__Host-session` cookie.
2. Transient DB outages unrelated to identity recovery continue to allow auth
   to succeed (best-effort path preserved).
3. Happy-path Privy auth continues to mint sessions normally.

## Rollback
Revert this PR. No DB migration, no env changes.

## References
- Companion guard: `server/_lib/identity/identityRecovery.ts`
  (`isIdentityRecoveryRequiredError`)
- Codex finding id: row 28 of
  `codex-security-findings-2026-04-23T18-31-56.185Z.csv`
