# W1-01 Waitlist bootstrap email proof

Status: fixed

## Summary
- `frontend/api/_handlers/waitlist/_bootstrap.ts` no longer treats `body.email` as verified canonical identity.
- Only `extractPrivyVerifiedEmail(privyUser)` now drives canonical email writes and `emailVerified: true` account/profile updates.
- Hint-only waitlist email collision adoption is disabled in `frontend/server/_lib/identity/emailCollisionAdoption.ts`.

## Validation
- `pnpm -C frontend exec vitest run api/__tests__/waitlistBootstrap.test.ts server/_lib/identity/emailCollisionAdoption.test.ts`
