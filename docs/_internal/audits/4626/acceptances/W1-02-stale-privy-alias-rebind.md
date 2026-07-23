# W1-02 Stale Privy alias after rebind

Status: fixed

## Summary
- Successful Privy rebinds now prune stale `privy_user_aliases` rows for the profile, preserving only the current Privy user alias.
- This prevents old Privy sessions from resolving the profile through an orphaned alias after ownership moves.

## Validation
- `pnpm -C frontend exec vitest run api/__tests__/waitlistBootstrap.test.ts server/_lib/identity/emailCollisionAdoption.test.ts`
