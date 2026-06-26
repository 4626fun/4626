# Post Schema Migration Smoke Test Checklist

**Context**: After the major schema bootstrap centralization (withEnsureOnce in schemaBootstrap.ts, deletion of thin wrappers in chat/ and workspace/, fixes to postgres.ts recursion, imageProjects.ts collision, etc.).

**Goal**: Quickly verify that all major API surfaces still work after the changes.

## Priority 1: Critical Auth & Onboarding (Must Pass)

- [ ] POST /api/waitlist/bootstrap  (with and without token)
- [ ] GET /api/accounts/me
- [ ] POST /api/auth/privy
- [ ] POST /api/auth/verify
- [ ] POST /api/auth/nonce
- [ ] GET /api/waitlist/stats
- [ ] GET /api/waitlist/position
- [ ] GET /api/waitlist/me
- [ ] GET /api/waitlist/leaderboard

## Priority 2: Deploy & Paymaster (High Risk)

- [ ] POST /api/deploy/v2/session/create  (or equivalent current deploy endpoint)
- [ ] POST /api/paymaster  (sponsored tx simulation)
- [ ] Any /api/deploy/... routes

## Priority 3: Wallet & Portfolio

- [ ] GET /api/portfolio/me
- [ ] GET /api/wallet/sync
- [ ] Wallet-related Solana endpoints (`/api/wallet/solana/...`)

## Priority 4: Zora / Content / Explore

- [ ] GET /api/zora/resolve
- [ ] GET /api/zora/metrics
- [ ] GET /api/zora/refresh
- [ ] GET /api/v1/explore/vaults

## Priority 5: Keeper / Internal Jobs

- [ ] POST /api/keeper/jobs/run  (or enqueue variants)
- [ ] Various /api/keeper/... and /api/keepr/... endpoints
- [ ] /api/keeper/sweep

## Priority 6: Telegram / Chat surfaces

- [ ] Telegram webhook handler (`/api/telegram/webhook`)
- [ ] Various telegram/* endpoints (`/link-ready`, `/link-complete`, etc.)
- [ ] Chat / XMTP related if applicable

## Priority 7: Admin surfaces

- [ ] Admin waitlist approve/deny/list
- [ ] Admin creator-access flows

## How to Test

1. Deploy to a preview or use local with `VITE_HOST_MODE_OVERRIDE` if needed.
2. Use a real Privy token for authenticated calls.
3. For each, verify:
   - No 500s
   - No "Identifier 'ensure*Schema' has already been declared"
   - Schema ensures succeed (check logs for "[schemaBootstrap] Applying ...")
   - Functional behavior is correct (data returns, no migration_required errors in prod)

## Notes

- Focus first on waitlist/bootstrap + accounts/me — these were the original pain points.
- Watch Vercel function logs for any schema ensure errors on cold starts.
- The concurrency test suite (`schemaEnsureConcurrency.test.ts`) already covers the core once-guarantees.

Generated as part of post-migration verification.
