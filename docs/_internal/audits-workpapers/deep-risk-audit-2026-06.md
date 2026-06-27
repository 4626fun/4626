# 4626 Deep Risk Audit — Phase 0 Setup

Date: 2026-06-24
Mode: audit-only, Phase 0 only
Repository: `/home/akitav2/projects/4626`
Branch: `main`
HEAD: `ab4ea86b6`
Upstream: `origin/main`

## Phase 0 scope

This file is the kickoff/control document for the 2026-06 deep risk audit. Phase 0 was limited to baseline repository integrity checks, authority/context collection, dirty-tree inventory, and creation of the audit artifact shell.

No product/code fixes were applied. No implementation risk findings are asserted in this Phase 0 document unless they are directly supported by the baseline commands below. Later phases must perform symbol tracing and endpoint/flow inspection before assigning severity.

## Source-of-truth context loaded

AGENTS.md was intentionally not read in full. The file size is `224738` bytes. Phase 0 used only the requested grep/wc plus targeted nearby excerpts, keeping AGENTS.md excerpts under the requested 400-line cap:

- `grep -n -E 'auth|session|Privy|wallet|CSW|canonical|account|deploy|Telegram|paymaster|API|waitlist|backtest|launch' AGENTS.md | head -n 120`
- `sed -n '20,76p' AGENTS.md`
- `sed -n '148,220p' AGENTS.md`
- `sed -n '253,323p' AGENTS.md`

Relevant authority summary from those excerpts:

1. `AGENTS.md` is repo-level authority for architecture, operations, and product invariants.
2. `.cursor/rules/ERC-4337-Wallet-Invariants.mdc` owns canonical wallet/account selection.
3. `.cursor/rules/csw-agent-lifecycle.mdc` owns CSW delegation, XMTP identity, ERC-8004 identity, and deploy-session wallet mechanics.
4. `.cursor/rules/waitlist-onboarding-simplicity.mdc` owns waitlist/signup simplification inside its scoped files.
5. `docs/ACCOUNT_MODEL.md` is the canonical reference for account model work that touches account, wallet, signer, sub-account, or paymaster behavior. It was not read in Phase 0 because this phase did not perform design or implementation analysis.
6. Deploy status/preflight paths must be read-only; internal Solana mutation paths require machine auth; Telegram Mini App link completion requires fresh Mini App proof; Telegram link-start tokens must be single-use, claim-bound, and consumed on success.
7. User-initiated frontend execution and server-side deploy-session execution are intentionally orthogonal; later phases must not blur parent-CSW, embedded-EOA, external-EOA, sub-account, and Privy server-wallet lanes.
8. API routing uses `frontend/api/[...path].ts` dispatching through `frontend/api/_handlers/_routes.ts`; new endpoints must be in the static route map.
9. Session restoration should reuse the existing `useSiweAuth()` / `/api/auth/me` path rather than adding ad hoc session polling.
10. Telegram Mini App flows require one authoritative state machine, inline OTP, explicit `wait_for_privy_sync`, and binding Telegram only after verified-email canonical account resolution.

Required cursor rules read:

- `.cursor/rules/ERC-4337-Wallet-Invariants.mdc`
- `.cursor/rules/csw-agent-lifecycle.mdc`
- `.cursor/rules/waitlist-onboarding-simplicity.mdc`
- `.cursor/rules/product-builder-workflow.mdc`
- `.cursor/rules/4626 secur-agent guardrails for repo-native implementation.mdc`

## Baseline working tree

`git status --short --branch`:

```text
## main...origin/main
M  frontend/public/immersive/index.html
M  frontend/public/immersive/vault-hero/vault-hero.js
M  frontend/src/features/waitlist/WaitlistFlow.tsx
M  frontend/src/lib/bootstrap/consoleNoisePatch.ts
M  frontend/src/main.tsx
M  frontend/vercel.json
```

Interpretation:

- The tree was dirty before Phase 0 artifact creation.
- The six dirty files were staged (`git diff --cached --name-only` listed them).
- `git diff --name-only` returned no files because there were no unstaged tracked diffs at that moment.
- Phase 0 did not inspect or modify those staged files.

Pre-existing staged files:

1. `frontend/public/immersive/index.html`
2. `frontend/public/immersive/vault-hero/vault-hero.js`
3. `frontend/src/features/waitlist/WaitlistFlow.tsx`
4. `frontend/src/lib/bootstrap/consoleNoisePatch.ts`
5. `frontend/src/main.tsx`
6. `frontend/vercel.json`

Phase 0-created files:

1. `docs/audits/deep-risk-audit-2026-06.md`
2. `docs/audits/deep-risk-audit-2026-06-endpoint-matrix.md`
3. `docs/audits/deep-risk-audit-2026-06-validation-log.md`

## Baseline command results

| # | Command | Exit code | Result |
|---|---|---:|---|
| 1 | `git status --short --branch` | 0 | Dirty tree on `main...origin/main`; six staged modified frontend files. |
| 2 | `git diff --name-only` | 0 | No unstaged tracked diffs. |
| 3 | `git diff --check` | 0 | No whitespace/conflict errors in unstaged diff. |
| 4 | `git grep -n -E '^(<<<<<<<|=======|>>>>>>>)' -- ':!lib' ':!docs/_generated' ':!apps/docs-site/.docusaurus' ':!node_modules' ':!.worktrees' ':!out' ':!target' || true` | 0 wrapper; raw grep 1 | No conflict markers found in searched tracked files. |
| 5 | `wc -c AGENTS.md` | 0 | `224738 AGENTS.md`. |
| 6 | `grep -n -E 'auth|session|Privy|wallet|CSW|canonical|account|deploy|Telegram|paymaster|API|waitlist|backtest|launch' AGENTS.md \| head -n 120` | 0 | Returned 120 context lines. |
| S1 | `git diff --cached --name-only` | 0 | Listed the six staged files above. |
| S2 | `git branch --show-current && git rev-parse --short HEAD && git rev-parse --abbrev-ref --symbolic-full-name @{u}` | 0 | `main`, `ab4ea86b6`, `origin/main`. |
| S3 | `git diff --cached --check` | 0 | No whitespace/conflict errors in staged diff. |

## Phase 0 blockers and constraints

| ID | Blocker / constraint | Impact | Phase 0 action |
|---|---|---|---|
| P0-C1 | Dirty tree with six pre-existing staged files. | Later audit phases must distinguish pre-existing staged work from audit artifacts and must not overwrite those files without explicit scope. | Recorded in this document and validation log. |
| P0-C2 | AGENTS.md is very large (`224738` bytes). | Full read would violate the user's cost/context rule. | Used requested grep/wc and targeted `sed` excerpts only. |
| P0-C3 | No Deep Risk Audit Implementation Plan file was found by targeted searches for `Deep Risk Audit`, `deep-risk`, and `risk audit`. | Phase 0 artifacts are initialized from the user's explicit instructions and loaded repo authority, not from an additional plan file. | Recorded as a Phase 0 discovery note; stopped after Phase 0 as requested. |
| P0-C4 | `git diff --check` checks only unstaged diff and the unstaged diff was empty. | It does not validate the six staged files. | Supplemental `git diff --cached --check` was run and passed. |

## Phase 0 handoff for later phases

Later phases should start by re-running `git status --short --branch` and checking whether the six staged files are still present. If they are unrelated user work, do not modify or unstage them without explicit instruction.

Recommended next-phase entry points, based only on Phase 0 authority context:

- API route map: `frontend/api/[...path].ts`, `frontend/api/_handlers/_routes.ts`
- Auth/session: `frontend/api/_handlers/auth/**`, `frontend/src/hooks/useSiweAuth.ts`, `/api/auth/me`, Privy-token consumers
- Wallet/CSW policy: `frontend/src/wallet/canonicalWalletPolicy.ts`, `frontend/server/_lib/wallet/canonicalCswEnv.ts`, `frontend/src/lib/uniswap/walletMode.ts`, `frontend/src/lib/tx/txRouter.ts`
- Deploy-session delegation: `frontend/api/_handlers/deploy/session/**`
- Waitlist: `frontend/src/features/waitlist/**`, `frontend/api/_handlers/waitlist/**`
- Telegram link/onboarding: `/telegram/link` implementation files and backend link-completion endpoints
- Paymaster/UserOp: `/api/paymaster` and Coinbase ERC-4337 helpers
- Backtest/API compute paths: `/api/v1/alfaclub/backtest-run` and related chat/CLI entry points if included in later scope

Stop point: Phase 0 complete. No product/code fixes applied.

---

# Security/API/Auth Pass — Early-stop Finding

Date: 2026-06-24
Mode: audit-only
Status: STOPPED EARLY per user stop condition.

This pass stopped before full endpoint inventory completion because a scoped high-risk endpoint matched the requested immediate-stop criterion: an expensive or mutating endpoint with no rate limit.

## Finding APIAUTH-001 — `/api/accounts/me` performs authenticated identity/profile DB writes on an unthrottled GET path

- ID: APIAUTH-001
- Severity: High
- Exact file path and function/component/route:
  - Route registration: `frontend/api/_handlers/_routes.ts`, route key `accounts/me`.
  - Handler: `frontend/api/_handlers/accounts/_me.ts`, default `handler` for `GET /api/accounts/me`.
  - Identity helpers: `frontend/server/_lib/identity/accountsIdentity.ts`, `syncEmailIdentity(...)` and `verifyPrivyForAccounts(...)`.
- Trigger or precondition: Any caller with a valid Privy access token sends repeated `GET /api/accounts/me` requests. This finding does not depend on the pre-existing staged local diffs; `git diff --name-only -- frontend/api/_handlers/accounts/_me.ts frontend/server/_lib/identity/accountsIdentity.ts` and the staged equivalent both returned empty output during the pass.
- Expected invariant: Expensive or mutating API endpoints must have rate limits; 429 responses must set `Retry-After`; account snapshot reads should not hide identity/profile writes behind an unbounded GET path unless explicitly throttled and documented.
- Observed behavior:
  - The handler accepts only `GET`, sets CORS and `no-store`, requires Privy auth via `verifyPrivyForAccounts(req)`, opens the DB, then calls `ensureAccountsIdentitySchema(...)`, `syncEmailIdentity(...)`, and `buildAccountsMePayload(...)`.
  - `syncEmailIdentity(...)` upserts account/email-linked-method rows and awards the `link_email` point event.
  - No `checkRateLimit(...)`, `checkDurableRateLimit(...)`, `RATE_LIMITS`, `rateLimitKey(...)`, or `Retry-After` logic appears in `frontend/api/_handlers/accounts/_me.ts`.
  - `verifyPrivyForAccounts(...)` delegates to `verifyPrivyRequest(req)`, which reads `x-privy-token` / bearer auth, calls Privy `verifyAuthToken(...)`, and fetches the user by ID, so this path also has external Privy cost on every request.
- Evidence:
  - `frontend/api/_handlers/_routes.ts:51` registers `'accounts/me': () => import('./accounts/_me.js')`.
  - `frontend/api/_handlers/accounts/_me.ts:22-29` handles only `GET` and sets `setNoStore(res)`.
  - `frontend/api/_handlers/accounts/_me.ts:31-36` opens DB and returns 503 if unavailable.
  - `frontend/api/_handlers/accounts/_me.ts:39-54` verifies Privy, ensures account schema, calls `syncEmailIdentity(...)`, then builds/returns account payload.
  - `frontend/server/_lib/identity/accountsIdentity.ts:665-688` implements `syncEmailIdentity(...)` with `upsertAccount(...)`, `upsertLinkedMethod(...)`, and `applyPointEvent(...)`.
  - `frontend/server/_lib/identity/accountsIdentity.ts:1112-1114` exports `verifyPrivyForAccounts(req)` as `verifyPrivyRequest(req)`.
  - `frontend/server/_lib/wallet/canonicalCswDelegation.ts:424-433` verifies the Privy token and fetches the Privy user.
  - Search in `frontend/api/_handlers/accounts/_me.ts` for `checkRateLimit|RATE_LIMITS|rateLimitKey|Retry-After` returned zero matches.
  - Existing tests in `frontend/api/__tests__/accountsMe.test.ts:49-110` cover successful normalized account state and `emailVerified=false` preservation, but not auth failure, rate limiting, body behavior, or `Retry-After`.
- Pass/fail criterion:
  - FAIL until `GET /api/accounts/me` either becomes a true read-only snapshot path or enforces an account-snapshot/identity-sync rate limit keyed by Privy user and/or client IP, returns 429 with `Retry-After`, and has regression coverage for auth failure, rate-limit behavior, and DB-write/no-write semantics.
- Minimal remediation recommendation:
  - Prefer splitting the route into a read-only `GET /api/accounts/me` that does not perform identity/profile writes and a separate bounded, authenticated, rate-limited sync/refresh endpoint for identity writes. If the write-on-read behavior must remain temporarily, add a `RATE_LIMITS.accountsMe` policy keyed on Privy user ID plus IP, set `Retry-After` on 429, and add tests that assert the limiter blocks before schema/DB mutation helpers run.
- Launch impact:
  - Launch blocker for Security/API/Auth hardening. This is not an anonymous mutation, but it is a hot bootstrap/account endpoint that can be repeatedly hit by any authenticated session, causing DB writes and external Privy calls without throttling. It also blurs snapshot semantics for `/api/accounts/me`, increasing waitlist/account-setup race risk under repeated bootstrap retries.

---

### APIAUTH-002 — auth/_admin.ts: no rate limit on DB-heavy admin status GET

- Severity: Low
- Category: rate-limit gap (read-only)
- Shard: A (auth routes)
- File: `frontend/api/_handlers/auth/_admin.ts`
- Date observed: 2026-06-25
- Finding:
  - `GET /api/auth/admin` performs admin-status lookup via `getSessionAddress(req)` (session-cookie-based, not fresh Privy verification) and `lookupAdminContextByWallet(address)`.
  - `lookupAdminContextByWallet` issues up to 4 DB queries (profiles, profile_wallets join, linked-address lookup, creator_wallets) to resolve admin inheritance.
  - The handler has NO rate limit — verified by absence of `checkRateLimit`, `checkDurableRateLimit`, `RATE_LIMITS`, `rateLimitKey`, or `Retry-After` in the file.
  - Read-only: returns `{ address, isAdmin: boolean }`. No DB writes, no external mutation.
  - Admin privilege inheritance via linked wallets and email is by-design (owner EOAs linked to a canonical admin CSW inherit admin status). This is not flagged as a vulnerability.
- Evidence:
  - `search_files` for `checkRateLimit|RATE_LIMITS|rateLimitKey|Retry-After|checkDurableRateLimit` in `auth/_admin.ts` returned zero matches.
  - Handler uses `getSessionAddress(req)` (session snapshot), not `verifyPrivyForAccounts(req)` (fresh Privy token verification).
- Pass/fail criterion:
  - FAIL until `GET /api/auth/admin` enforces a rate limit keyed by session address and/or client IP (e.g. `RATE_LIMITS.authRead`) with `Retry-After` on 429.
- Minimal remediation recommendation:
  - Add `checkRateLimit(rateLimitKey('auth-admin', getClientIp(req)), RATE_LIMITS.authRead)` at the top of the handler, before any DB query. The endpoint is read-only and low-risk, but unthrottled multi-query DB reads can be abused for resource exhaustion.
- Launch impact:
  - Not a launch blocker. Read-only endpoint with session auth. The missing rate limit is a defense-in-depth gap, not an exploitable mutation path.

---

### APIAUTH-003 — auth/_agent-nonce.ts and auth/_agent-verify.ts: in-memory (non-durable) rate limits on auth-adjacent POST endpoints

- Severity: Medium
- Category: rate-limit defense-in-depth gap (auth-adjacent POST)
- Shard: A (auth routes)
- Files: `frontend/api/_handlers/auth/_agent-nonce.ts`, `frontend/api/_handlers/auth/_agent-verify.ts`
- Date observed: 2026-06-25
- Finding:
  - Both agent endpoints issue auth artifacts: `_agent-nonce` creates SIWA nonces (stored in DB + on-chain validation); `_agent-verify` verifies SIWA signatures, consumes nonces, and issues receipt tokens.
  - Both use `checkRateLimit` (in-memory, per-isolate) with `RATE_LIMITS.authAgentWrite`, keyed by client IP.
  - Contrast: `auth/_verify.ts` and `auth/_privy.ts` — the primary auth endpoints — use `checkDurableRateLimit` with `failClosed: true` (Postgres-backed), explicitly to prevent budget bypass across concurrent serverless instances.
  - In Vercel serverless, each warm function instance has its own in-memory counter. Concurrent instances do not share the rate-limit budget, so an attacker can exceed the intended `authAgentWrite` limit by spreading requests across instances.
  - `_agent-nonce` also makes an on-chain `isOwnerAddress` call (12s RPC timeout) per request. Unthrottled cross-instance traffic amplifies RPC load.
  - The SIWA on-chain validation (signature verification, `ownerOf` check, canonical smart wallet verification) is the primary security gate, which limits the exploitability of the rate-limit gap for forged auth. The concern is resource exhaustion and nonce-flooding, not direct auth bypass.
- Evidence:
  - `auth/_agent-nonce.ts`: `checkRateLimit(rateLimitKey('auth-agent-nonce', getClientIp(req)), RATE_LIMITS.authAgentWrite)` — in-memory limiter.
  - `auth/_agent-verify.ts`: `checkRateLimit(rateLimitKey('auth-agent-verify', getClientIp(req)), RATE_LIMITS.authAgentWrite)` — in-memory limiter.
  - `auth/_verify.ts`: `checkDurableRateLimit(... failClosed: true)` — durable Postgres-backed limiter with explicit comment "H-07 / 4626-299: auth endpoints must use the durable Postgres-backed limiter with failClosed=true."
  - `auth/_privy.ts`: `checkDurableRateLimit(... failClosed: true)` — same durable limiter pattern.
- Pass/fail criterion:
  - FAIL until both agent endpoints use `checkDurableRateLimit` with `failClosed: true` (matching the pattern in `auth/_verify.ts` and `auth/_privy.ts`), or until a documented risk acceptance explains why in-memory limits are sufficient for agent-issued auth artifacts.
- Minimal remediation recommendation:
  - Replace `checkRateLimit(...)` with `checkDurableRateLimit(... { failClosed: true })` in both files, using the same key and limit. This aligns agent nonce/verify with the hardened pattern already established for the primary auth endpoints.
- Launch impact:
  - Not a launch blocker. The SIWA on-chain validation prevents direct auth bypass. The gap is defense-in-depth: cross-instance budget bypass and RPC load amplification. Should be remediated before launch but does not block the current launch gate.

---

### APIAUTH-004 — accounts/_link.ts and accounts/_unlink.ts: in-memory (non-durable) IP-only rate limits on mutating POST endpoints

- Severity: Medium
- Category: rate-limit defense-in-depth gap (mutating POST)
- Shard: A (accounts routes)
- Files: `frontend/api/_handlers/accounts/_link.ts`, `frontend/api/_handlers/accounts/_unlink.ts`
- Date observed: 2026-06-25
- Finding:
  - Both endpoints are mutating POSTs: `syncEmailIdentity` + `recordProviderLink`/`recordProviderUnlink` + `buildAccountsMePayload`.
  - Both use `checkRateLimit` (in-memory, per-isolate) with `RATE_LIMITS.cswLink`, keyed by client IP only (`rateLimitKey('accounts-link'/'accounts-unlink', getClientIp(req))`).
  - Not keyed by Privy user ID — an attacker with multiple source IPs can exceed the intended per-user budget.
  - In-memory limiter: concurrent serverless instances do not share the budget.
  - Contrast: `auth/_verify.ts` and `auth/_privy.ts` use `checkDurableRateLimit` with `failClosed: true` for auth-adjacent mutating POSTs. The accounts link/unlink endpoints perform identity writes but use the weaker in-memory limiter.
  - Asymmetry (informational): `_link.ts` passes `value: null` to `recordProviderLink` with an explicit comment "Never trust caller-supplied identity values; only use verified Privy-linked identities." `_unlink.ts` passes the caller-supplied `value` to `recordProviderUnlink`. The unlink is scoped to the authenticated `privyUserId`, so cross-user impact is unlikely, but the asymmetry warrants manual trace of `recordProviderUnlink` to confirm the value is not used for cross-profile operations.
  - Missing error handling (informational): `_unlink.ts` catch block does not handle `isIdentityRecoveryRequiredError` (returns 500 instead of 409). The unlink fails closed (no mutation on error), but the incorrect status code could confuse client-side recovery flows. `_link.ts` handles this correctly with a 409 response.
- Evidence:
  - `accounts/_link.ts:70-77`: `checkRateLimit(rateLimitKey('accounts-link', getClientIp(req)), RATE_LIMITS.cswLink)` — in-memory, IP-only.
  - `accounts/_link.ts:108`: `value: null` with comment "Never trust caller-supplied identity values."
  - `accounts/_unlink.ts:69-76`: `checkRateLimit(rateLimitKey('accounts-unlink', getClientIp(req)), RATE_LIMITS.cswLink)` — in-memory, IP-only.
  - `accounts/_unlink.ts:106`: `value: normalizedValue.value` — caller-supplied value passed through.
  - `accounts/_unlink.ts:115-118`: catch block has no `isIdentityRecoveryRequiredError` check.
  - `auth/_verify.ts` and `auth/_privy.ts`: `checkDurableRateLimit(... failClosed: true)` — durable limiter.
- Pass/fail criterion:
  - FAIL until both endpoints use `checkDurableRateLimit` with `failClosed: true` keyed by Privy user ID + IP (matching the pattern in `auth/_verify.ts`), or until a documented risk acceptance explains why in-memory IP-only limits are sufficient for identity-mutating endpoints.
  - NEEDS MANUAL REVIEW for the `_unlink.ts` value asymmetry — trace `recordProviderUnlink` in `accountsIdentity.ts` to confirm the caller-supplied value cannot affect profiles other than the authenticated user's.
- Minimal remediation recommendation:
  - Replace `checkRateLimit(...)` with `checkDurableRateLimit(... { failClosed: true })` in both files, keyed by `privyUserId + ip` instead of IP alone. Add `isIdentityRecoveryRequiredError` handling to `_unlink.ts` catch block (return 409, matching `_link.ts`). Trace `recordProviderUnlink` to determine if the caller-supplied value should be nullified (matching `_link.ts`).
- Launch impact:
  - Not a launch blocker. The endpoints require Privy authentication and the mutations are scoped to the authenticated user. The gap is defense-in-depth: cross-instance budget bypass and multi-IP amplification on identity-mutating endpoints. Should be remediated before launch.

---

### APIAUTH-005 — waitlist/_stats.ts, waitlist/_me.ts, waitlist/_leaderboard.ts: no rate limit on read-only GET endpoints

- Severity: Low
- Category: rate-limit gap (read-only)
- Shard: A (waitlist routes)
- Files: `frontend/api/_handlers/waitlist/_stats.ts`, `frontend/api/_handlers/waitlist/_me.ts`, `frontend/api/_handlers/waitlist/_leaderboard.ts`
- Date observed: 2026-06-25
- Finding:
  - `waitlist/_stats.ts`: PUBLIC (no auth), NO rate limit. Runs `SELECT COUNT(*) FROM profiles WHERE email IS NOT NULL` on every request. Always fail-opens with empty stats on DB error (`shouldFailOpenForStats()` returns `true` unconditionally). Returns only aggregate counts (signedUpCount, capacity, spotsRemaining) — minimal information disclosure.
  - `waitlist/_me.ts`: Auth-optional (`resolveAuthorizedRequestPrincipal` — returns null data if unauthenticated), NO rate limit. Performs 3 DB queries (profile row, delegation wallet, profile_wallets join). Read-only. Returns null on DB failure (fail-soft). Exposes full profile data including wallet addresses, CSW address, Solana wallets, email — but only to authenticated users whose profile matches.
  - `waitlist/_leaderboard.ts`: Auth-optional, NO rate limit. Runs `getWaitlistLeaderboardData` (paginated DB query). Read-only. Returns public leaderboard data (display names, points, ranks) — same info as the public `/referrer` endpoint.
  - All three are read-only; no P0 stop condition triggered (no mutation).
  - `_stats` is the most concerning because it is fully public with no auth gate AND no rate limit, making it the easiest DB-load amplification vector.
- Evidence:
  - `waitlist/_stats.ts`: No `checkRateLimit`, `RATE_LIMITS`, `rateLimitKey`, or `Retry-After` in file. `shouldFailOpenForStats()` at line 25-29 returns `true` unconditionally.
  - `waitlist/_me.ts`: No `checkRateLimit`, `RATE_LIMITS`, `rateLimitKey`, or `Retry-After` in file. `resolveAuthorizedRequestPrincipal(req)` at line 133.
  - `waitlist/_leaderboard.ts`: No `checkRateLimit`, `RATE_LIMITS`, `rateLimitKey`, or `Retry-After` in file. `resolveAuthorizedRequestPrincipal(req)` at line 40.
  - Contrast: `waitlist/_position.ts`, `waitlist/_pointsActivity.ts`, `waitlist/_referrer.ts` all enforce in-memory rate limits (60/min per IP).
- Pass/fail criterion:
  - FAIL until all three endpoints enforce a rate limit (in-memory acceptable for read-only). `_stats` should be keyed by client IP with a public-read limit. `_me` and `_leaderboard` should be keyed by client IP (and optionally by profile ID when authenticated).
- Minimal remediation recommendation:
  - Add `checkRateLimit(rateLimitKey('waitlist-stats', getClientIp(req)), { windowMs: 60_000, maxRequests: 60 })` to `_stats.ts`. Same pattern for `_me.ts` and `_leaderboard.ts` (matching the existing pattern in `_position.ts` and `_pointsActivity.ts`). These are read-only so in-memory limits are acceptable; durable limits are not required.
- Launch impact:
  - Not a launch blocker. Read-only endpoints with minimal information disclosure. The missing rate limits are defense-in-depth gaps that could allow DB-load amplification, particularly on the public `_stats` endpoint.

---

### APIAUTH-006 — waitlist/_bootstrap.ts: in-memory (non-durable) rate limit on heavy mutating POST with non-atomic transaction path on Supabase

- Severity: Medium
- Category: rate-limit defense-in-depth gap + concurrency risk (mutating POST)
- Shard: A (waitlist routes)
- File: `frontend/api/_handlers/waitlist/_bootstrap.ts` (774 lines)
- Date observed: 2026-06-25
- Finding:
  - `POST /api/waitlist/bootstrap` is the primary waitlist signup/account-bootstrap entry point. It is the heaviest handler in shard A.
  - Rate limited with `checkRateLimit` (in-memory, per-isolate) using `RATE_LIMITS.general`, keyed by client IP only.
  - The full bootstrap path (requires valid Privy token) performs: Privy `verifyAuthToken` + `loadPrivyUserWithVerifiedEmailRetry` (up to 10 retries × 300ms delay) + `ensureWaitlistSchema` + `ensureAccountsIdentitySchema` + `syncEmailIdentity` + `assertNoWalletPrivyCollision` + `assertNoEmailPrivyCollision` + `upsertAccount` + `upsertBootstrapProfile` (with `rebindEmailProfileToPrivyUser` point-move logic) + `ensureBootstrapReferralCode` (external Zora SDK API calls + Basename RPC calls, each with 1.5s timeout) + `applyBootstrapReferral` + `awardWaitlistPoints` + `buildAccountsMePayload`.
  - Non-atomic transaction path: when `db.query` is unavailable (Supabase sql-only path), `runBootstrapTransaction` skips the transaction wrapper (documented R6 comment at lines 114-123). In this mode, `rebindEmailProfileToPrivyUser` — which moves referral points between profiles via INSERT...SELECT + DELETE — is NOT atomic. Concurrent bootstrap calls for the same `privyUserId` can interleave point moves, potentially losing or duplicating referral points.
  - In-memory rate limit: concurrent serverless instances do not share the budget. An attacker with multiple IPs can exceed the intended per-IP budget.
  - Without a Privy token, the handler returns `{ requiresPrivyAuth: true, email, waitlistEntryId }` after a single DB lookup — the heavy path requires authentication, limiting anonymous abuse.
  - However, an authenticated user can trigger heavy external API calls (Zora SDK `getProfile` + `getCoin`, Basename RPC resolution) and multiple DB writes with in-memory-only throttling. The external calls have 1.5s timeouts but are sequential (up to 4 calls: 2 Zora + 2 Basename), so a single request can take 6+ seconds.
- Evidence:
  - `waitlist/_bootstrap.ts:520`: `checkRateLimit(rateLimitKey('waitlist:bootstrap', getRateLimitIp(req)), RATE_LIMITS.general)` — in-memory, IP-only.
  - `waitlist/_bootstrap.ts:109-138`: `runBootstrapTransaction` — when `db.query` is not a function, the transaction is skipped and `action(db)` runs without BEGIN/COMMIT/ROLLBACK.
  - `waitlist/_bootstrap.ts:114-123`: R6 comment: "rebindEmailProfileToPrivyUser (which moves referral points between profiles) is NOT atomic without a transaction. Concurrent bootstrap calls for the same privyUserId can interleave point moves."
  - `waitlist/_bootstrap.ts:281-299`: `resolveCreatorCoinReferralCode` — external Zora SDK calls.
  - `waitlist/_bootstrap.ts:305-323`: `withIdentityTimeout` — 1.5s timeout wrapper for identity lookups.
  - `waitlist/_bootstrap.ts:580-585`: `loadPrivyUserWithVerifiedEmailRetry` with `attempts: 10, delayMs: 300` — up to 3 seconds of Privy API polling.
  - Contrast: `auth/_verify.ts` and `auth/_privy.ts` use `checkDurableRateLimit` with `failClosed: true`.
- Pass/fail criterion:
  - FAIL until `waitlist/_bootstrap.ts` uses `checkDurableRateLimit` with `failClosed: true` keyed by Privy user ID + IP (when authenticated) or IP (when pre-auth), matching the pattern in `auth/_verify.ts`.
  - NEEDS MANUAL REVIEW for the non-atomic Supabase path: confirm whether `pg_advisory_lock(hash(privyUserId))` (or equivalent serialization) is in place for the non-transactional path, as the R6 comment suggests it should be. If not, concurrent bootstrap calls for the same user on the Supabase path can corrupt referral point state.
- Minimal remediation recommendation:
  - Replace `checkRateLimit(...)` with `checkDurableRateLimit(... { failClosed: true })`, keyed by `privyUserId + ip` when authenticated. For the non-atomic Supabase path, add `pg_advisory_lock` serialization around `rebindEmailProfileToPrivyUser` when `db.query` is unavailable, or document why the conditional UPDATEs in `ensureBootstrapReferralCode` are sufficient to prevent point corruption (R10 comment addresses referral code overwrites but not point moves).
- Launch impact:
  - Not a launch blocker for the rate-limit gap alone (the heavy path requires authentication). The non-atomic Supabase path concurrency risk is a data-integrity concern for referral points, not a security bypass. Should be remediated before launch, particularly if the Supabase sql-only path is active in production.

---

## Shard A — PASS summary (auth/accounts/waitlist routes)

The following shard A routes were inspected and found to have adequate security controls for their risk class. No findings issued.

- `auth/nonce` — GET, rate-limited (`authNonce`), nonce cookie issuance, single-use nonce. PASS.
- `auth/verify` — POST, durable rate limit with `failClosed`, SIWE signature verification, single-use nonce consumption, session cookie. PASS.
- `auth/privy` — POST, durable rate limit with `failClosed`, Privy token verification, fail-closed session address resolution. PASS.
- `auth/me` — GET, in-memory rate limit (`authRead`), read-only session snapshot. PASS.
- `auth/logout` — POST, in-memory rate limit (`authWrite`), clears session cookie. PASS.
- `auth/handoff/create` — POST, per-principal+IP rate limit (20/min), bounded body (8KB), 256-bit entropy handoff code. PASS.
- `auth/handoff/redeem` — POST, global in-memory (100 failed/min) + per-IP (30/min), bounded body (8KB), 256-bit entropy, single-use code consumption, session cookie. PASS.
- `accounts/me-points` — GET, in-memory 60/min per IP, Privy auth, read-only. PASS.
- `waitlist/lead` — POST, in-memory rate limit (`general`), bounded body (16KB), honeypot field, public lead capture. PASS.
- `waitlist/position` — GET, in-memory 60/min per IP, owner-authorization check via `isAuthorizedWalletForProfile`, returns null for unauthorized. PASS.
- `waitlist/points-activity` — GET, in-memory 60/min per IP, Privy auth, read-only. PASS.
- `waitlist/referrer` — GET, in-memory 60/min per IP, public, returns only leaderboard-equivalent data, null for misses (no code-existence leak). PASS.
- `waitlist/xmtp-join` — POST, in-memory keyed by profileId+IP (`workspaceActions`), auth required, eligibility check, dedupe key prevents duplicate joins. PASS.
- `waitlist/xmtp-resync` — POST, in-memory keyed by profileId+IP (`workspaceActions`), auth required, eligibility check, handles pending/executing/retry states. PASS.
- `waitlist/xmtp-status` — GET, in-memory keyed by profileId+IP (`workspaceActions`), auth required, read-only. PASS.
- `waitlist/airtable-sync` — POST/GET, machine auth via `isAuthorizedCron`, cron-only endpoint. PASS.

---

## Shard B findings (wallet/deploy/paymaster/relay/Solana/keeper/Telegram routes)

### APIAUTH-007 (Medium) — relay/execute + relay/quote: unauthenticated external proxy with project API key exposure and fee subsidy

- Files: `frontend/api/_handlers/relay/_execute.ts` (lines 111-305), `frontend/api/_handlers/relay/_quote.ts` (lines 75-209)
- Finding: Both endpoints accept POST requests with no authentication check (no `readRequestPrincipalAddress`, no `readDeployAuthFromRequest`, no `verifyPrivyForAccounts`). The only access control is an in-memory IP-only rate limit (`checkRateLimit` with `RATE_LIMITS.creatorQuickstart`).
  - `relay/execute` proxies to `https://api.relay.link/execute/call` with the project's `x-api-key` header (resolved from `RELAY_API_KEY` / `VITE_RELAY_API_KEY` / `RELAY_LINK_API_KEY` env vars, line 95-109). The `user` field is validated as an address but not checked against the caller's identity (line 188-193). The `data` field is only checked for the `handleOps` selector prefix — inner UserOp calls are not decoded or validated (line 170-176). The `value` field is forced to `"0"` (line 178-184).
  - `relay/quote` proxies to `https://api.relay.link/quote/v2` with `subsidizeFees: true` and `explicitDeposit: true` (line 153-167). Anyone can request fee-subsidized quotes using the project's API key.
- Risk:
  - API key exposure: unauthenticated callers can consume the project's Relay API quota/credits.
  - Fee subsidy abuse: `relay/quote` includes `subsidizeFees: true`, exposing the project's fee subsidy to arbitrary callers.
  - Paymaster validation bypass: `relay/execute` submits UserOps through Relay's multicall router, not through the project's paymaster. While the UserOp must be signed by the wallet owner (verified on-chain by EntryPoint), the inner calls are not validated by `validateSponsoredSmartWalletCalls`. An attacker who obtains a valid signed UserOp can submit it through the relay proxy, bypassing the paymaster's sender/call/mode validation.
  - Cross-instance rate limit bypass: in-memory IP-only rate limit is non-durable (same pattern as APIAUTH-003/004/006).
- Mitigating factors:
  - `relay/execute` forces `value: "0"` and restricts `to` to EntryPoint v0.6/v0.7 addresses (line 79-81, 153-159).
  - `relay/execute` requires `data` to start with the `handleOps` selector (line 170-176).
  - The UserOp must be signed by the wallet owner — attackers cannot forge UserOps for wallets they don't control.
  - `relay/quote` is read-only (price estimate only, no chain mutation).
- Contrast: `paymaster/_paymaster.ts` requires authenticated principal (session or deploy-session token, line 3656) and validates inner calls via `validateSponsoredSmartWalletCalls` (line 3757). `relay/execute` has no such validation.
- Pass/fail criterion:
  - FAIL until `relay/execute` and `relay/quote` require authenticated principal (session cookie, deploy-session token, or Privy token) and validate that the caller owns the `user` address. The `relay/quote` `subsidizeFees` flag should be gated behind authentication.
- Minimal remediation recommendation:
  - Add `readRequestPrincipalAddress(req)` or `readDeployAuthFromRequest(req)` at the top of both handlers. Reject unauthenticated requests with 401. For `relay/execute`, validate that the resolved principal address matches the `user` field. For `relay/quote`, gate `subsidizeFees: true` behind authentication; use `subsidizeFees: false` for unauthenticated requests (or reject them entirely).
- Launch impact:
  - Not a launch blocker (UserOp signature prevents fund theft; the abuse is API key consumption and fee subsidy, not direct chain mutation). Should be remediated before public launch if the Relay API key has financial cost or rate limits.

### APIAUTH-008 (Medium) — paymaster: in-memory (non-durable) rate limits on sponsorship path

- File: `frontend/api/_handlers/paymaster/_paymaster.ts` (lines 3608-3743)
- Finding: The paymaster JSON-RPC proxy uses three layers of in-memory rate limits:
  1. Per-IP: `checkRateLimit(rateLimitKey('paymaster-rpc', getClientIp(req)), RATE_LIMITS.paymasterRpc)` (line 3608)
  2. Per-sender: `checkSponsorshipLimit(sender, sponsorshipWeightForMethod(method))` (line 3690)
  3. Per-session: `enforceRateLimit(sessionAddress, sponsorshipWeightForMethod(method))` (line 3743)
  All three are in-memory (non-durable). None use `checkDurableRateLimit` with `failClosed`.
- Risk:
  - Cross-instance budget bypass: on Vercel serverless, each instance has separate in-memory state. An attacker can multiply their sponsorship quota by hitting different instances. The per-sender sponsorship limit (which is the primary anti-abuse control for gas sponsorship) can be bypassed cross-instance.
  - The paymaster is the most security-critical endpoint — it sponsors gas for UserOps. Bypassing the sponsorship limit means an attacker can submit more sponsored UserOps than intended, consuming the project's gas budget.
- Mitigating factors:
  - The paymaster validates sender ownership, inner calls, deploy session ownership, cleanup-only mode, and creator allowlisting via `validateSponsoredSmartWalletCalls` (line 3757). The validation is thorough and correct.
  - The sponsorship limit is per-sender (wallet address), not per-IP, so the attacker needs multiple wallet identities to abuse the bypass.
  - The EntryPoint's nonce tracking prevents UserOp replay.
- Contrast: `auth/_verify.ts` and `auth/_privy.ts` use `checkDurableRateLimit` with `failClosed: true`. `deploy/v2/session/_createCore.ts` (full create) also uses `checkDurableRateLimit` with `failClosed`.
- Pass/fail criterion:
  - FAIL until `checkSponsorshipLimit` and `enforceRateLimit` use `checkDurableRateLimit` with `failClosed: true`, keyed by sender address and session address respectively. The per-IP limiter can remain in-memory as a first-line throttle.
- Minimal remediation recommendation:
  - Replace `checkSponsorshipLimit` with a durable limiter (Postgres-backed) keyed by sender address. Replace `enforceRateLimit` with a durable limiter keyed by session address. Both should use `failClosed: true` to reject requests when the durable store is unavailable.
- Launch impact:
  - Not a launch blocker for the validation logic (which is thorough). The rate-limit bypass is a gas-budget abuse concern, not a security bypass. Should be remediated before public launch to prevent sponsorship quota abuse.

### APIAUTH-009 (Medium) — deploy/v2/session/resume: no rate limit on mutating workflow POST

- File: `frontend/api/_handlers/deploy/v2/session/_resume.ts`
- Finding: The resume handler has no `checkRateLimit` or `checkDurableRateLimit` call. It authenticates via `loadAuthorizedDeploySession` (session cookie HMAC + sessionAddress match) and then calls `runDeployWorkflow` which invokes `continueCoreHandler` and `statusCoreHandler` internally. These internal handlers send on-chain UserOps via `advanceDeploySession`.
- Risk:
  - An authenticated caller with a valid session can spam resume calls. Each call triggers a workflow run that may send on-chain UserOps, causing rapid gas consumption and RPC load amplification.
  - The workflow has `maxTicks` limiting (8-25 per run), but each resume call starts a new run, so the caller can bypass the per-run tick limit by making multiple calls.
- Mitigating factors:
  - Authentication is required (`loadAuthorizedDeploySession` checks session cookie HMAC and sessionAddress match).
  - The deploy session has a 45-minute TTL, limiting the abuse window.
  - The workflow's internal tick limiting provides some protection per call.
- Contrast: `deploy/v2/session/_start.ts` uses `checkRateLimit` (in-memory, per auth.address, line 134). `deploy/v2/session/_cancelCore.ts` also uses `checkRateLimit` (in-memory, per auth.address, line 148).
- Pass/fail criterion:
  - FAIL until `_resume.ts` has at least an in-memory rate limit keyed by auth.address (matching `_start.ts` and `_cancelCore.ts`), or preferably a `checkDurableRateLimit` with `failClosed`.
- Minimal remediation recommendation:
  - Add `checkRateLimit(rateLimitKey('deploy-resume', auth.address), RATE_LIMITS.deployWrite)` after `loadAuthorizedDeploySession` resolves the auth address. For stronger protection, use `checkDurableRateLimit` with `failClosed: true`.
- Launch impact:
  - Not a launch blocker (authentication + session TTL + tick limiting provide baseline protection). Should be remediated before public launch to prevent gas-budget abuse via rapid resume calls.

### APIAUTH-010 (Low) — wallet handlers: in-memory IP-only rate limits on wallet mutation POSTs

- Files: `frontend/api/_handlers/wallet/_sync.ts`, `frontend/api/_handlers/wallet/_confirm-owner.ts`, `frontend/api/_handlers/wallet/_prepare-add-privy-owner.ts`, `frontend/api/_handlers/wallet/_disconnect-external.ts`
- Finding: All four wallet mutation endpoints use `checkRateLimit` (in-memory, IP-only) with `RATE_LIMITS.cswLink`. Same durable-limiter gap as APIAUTH-004 (accounts link/unlink), applied to wallet state mutations:
  - `_sync.ts`: syncs Privy user wallets to DB (Privy getUser + DB writes)
  - `_confirm-owner.ts`: confirms CSW owner installation state (DB + on-chain checks)
  - `_prepare-add-privy-owner.ts`: prepares add-owner transaction (Privy verify + DB reads)
  - `_disconnect-external.ts`: disconnects external wallet from profile (DB writes)
- Risk:
  - Cross-instance rate limit bypass (same as APIAUTH-004). IP-only keying means NAT/proxy users share a budget.
- Mitigating factors:
  - All four endpoints require Privy authentication (via `resolveAuthorizedRequestPrincipal` or `verifyPrivyForAccounts`).
  - `_confirm-owner.ts` and `_prepare-add-privy-owner.ts` have bounded bodies (8KB and no body respectively).
- Contrast: Same pattern as APIAUTH-004. `auth/_verify.ts` and `auth/_privy.ts` use `checkDurableRateLimit` with `failClosed: true`.
- Pass/fail criterion:
  - FAIL until wallet mutation endpoints use `checkDurableRateLimit` with `failClosed: true`, keyed by Privy user ID + IP (when authenticated).
- Minimal remediation recommendation:
  - Replace `checkRateLimit` with `checkDurableRateLimit(... { failClosed: true })`, keyed by `privyUserId + ip` when authenticated. Match the pattern in `auth/_verify.ts`.
- Launch impact:
  - Not a launch blocker (all endpoints require authentication). Should be remediated before public launch.

### APIAUTH-011 (Low) — deploy session handlers: in-memory rate limits on deploy session POSTs

- Files: `deploy/v2/session/_start.ts` (line 134), `deploy/v2/session/_cancelCore.ts` (line 148), `deploy/v2/session/_dryRunCore.ts` (line 2097), `deploy/v2/session/_statusCore.ts` (internal handler, line 2810+)
- Finding: Deploy session handlers use `checkRateLimit` (in-memory, per auth.address) for start, cancel, dryRun, and status/advance. Same durable-limiter gap as APIAUTH-003, applied to deploy session operations. The `_statusCore.ts` handler (internal, invoked by resume workflow) calls `advanceDeploySession` which sends on-chain UserOps.
- Risk:
  - Cross-instance rate limit bypass. Per-auth.address keying is better than per-IP, but still non-durable.
- Mitigating factors:
  - All handlers require authentication via `readDeployAuthFromRequest` or `loadAuthorizedDeploySession`.
  - `_dryRunCore.ts` is local-fork-only (throws `LOCAL_FORK_ONLY_ERROR` if not configured, line 2123).
  - `_cancelCore.ts` validates calls via `validateSponsoredSmartWalletCalls` before sending cleanup UserOps (line 294).
  - `_createCore.ts` (full create) uses `checkDurableRateLimit` with `failClosed` — the one deploy handler that does use the durable limiter.
- Contrast: `deploy/v2/session/_createCore.ts` (full create) uses `checkDurableRateLimit` with `failClosed: true`. The other deploy handlers do not.
- Pass/fail criterion:
  - FAIL until deploy session handlers (start, cancel, dryRun, statusCore) use `checkDurableRateLimit` with `failClosed: true`, keyed by auth.address. Match the pattern in `_createCore.ts`.
- Minimal remediation recommendation:
  - Replace `checkRateLimit` with `checkDurableRateLimit(... { failClosed: true })`, keyed by `auth.address`. Match the pattern already established in `_createCore.ts` for the full create path.
- Launch impact:
  - Not a launch blocker (all handlers require authentication + session authorization). Should be remediated before public launch for defense-in-depth.

### APIAUTH-012 (Low) — deploy session access: FINDING-09 known security debt — session cookie HMAC as sole auth

- File: `frontend/api/_handlers/deploy/v2/session/_sessionAccess.ts` (lines 60-64)
- Finding: `loadAuthorizedDeploySession` authenticates deploy session access solely via the 7-day session cookie HMAC (`readDeployAuthFromRequest`). The code contains an explicit comment (FINDING-09) acknowledging this is insufficient: "the ownership check above relies on the 7-day session cookie HMAC. For higher assurance, deploy-critical continue/status operations should require a fresh proof of wallet ownership (re-validated Privy JWT or signed message) rather than solely trusting the long-lived session. The 45-min deploy TTL mitigates the window, but a stolen session cookie can still control active deploys."
- Risk:
  - A stolen session cookie grants full control over active deploy sessions (resume, cancel, status). The attacker can advance, cancel, or inspect deploy sessions without proving wallet ownership.
  - The 45-minute deploy TTL limits the window, but the session cookie itself is valid for 7 days.
- Mitigating factors:
  - The deploy session TTL is 45 minutes, limiting the practical abuse window.
  - Session cookies are HTTP-only and SameSite.
  - The finding is already documented in the code (FINDING-09).
- Pass/fail criterion:
  - FAIL until deploy-critical operations (resume, cancel) require a fresh proof of wallet ownership in addition to the session cookie. Acceptable: re-validated Privy JWT (within the last N minutes) or a signed EIP-4361 message.
- Minimal remediation recommendation:
  - For `resume` and `cancel` handlers, require a fresh Privy JWT (validated within the last 5 minutes) in addition to the session cookie. Reject requests with stale JWTs even if the session cookie is valid.
- Launch impact:
  - Not a launch blocker (the 45-min TTL + HTTP-only cookies provide baseline protection). Should be remediated for higher-assurance deploy flows, particularly if deploy sessions handle high-value token deployments.

### APIAUTH-013 (Low) — telegram/link-complete: in-memory IP-only rate limit on heavy mutating link completion POST

- File: `frontend/api/_handlers/telegram/_link-complete.ts` (lines 68-75)
- Finding: The Telegram link completion endpoint uses `checkRateLimit` (in-memory, IP-only) with `RATE_LIMITS.telegramLinkWrite`. Same durable-limiter gap as APIAUTH-006, applied to a heavy mutating endpoint that performs: Privy verify + multiple DB schema ensures + syncEmailIdentity + syncUserWallets + Telegram session verification + link token claim/consume + merge preflight + provider link record + telegram user link upsert.
- Risk:
  - Cross-instance rate limit bypass. IP-only keying means NAT/proxy users share a budget. The heavy multi-step DB+Privy path makes this endpoint expensive to call.
- Mitigating factors:
  - Privy authentication is required (`verifyPrivyForAccounts`, line 108).
  - Telegram session proof is verified (`readTelegramMiniAppSession`, line 131-163).
  - Link token is single-use, claim-bound, and consumed on success (`claimAndConsumeTelegramLinkStartToken`, line 251-355).
  - Merge preflight prevents silent cross-account conflicts (`runTelegramMergePreflight`, line 358-387).
  - Bounded body (16KB, line 40).
- Contrast: Same pattern as APIAUTH-006. `auth/_verify.ts` and `auth/_privy.ts` use `checkDurableRateLimit` with `failClosed: true`.
- Pass/fail criterion:
  - FAIL until `telegram/_link-complete.ts` uses `checkDurableRateLimit` with `failClosed: true`, keyed by Privy user ID + IP (when authenticated) or IP (when pre-auth).
- Minimal remediation recommendation:
  - Replace `checkRateLimit` with `checkDurableRateLimit(... { failClosed: true })`, keyed by `privyUserId + ip` when authenticated. Match the pattern in `auth/_verify.ts`.
- Launch impact:
  - Not a launch blocker (authentication + session proof + token consumption provide strong access control). Should be remediated before public launch.

---

## Shard B — PASS summary (wallet/deploy/paymaster/relay/Solana/keeper/Telegram routes)

The following shard B routes were inspected and found to have adequate security controls for their risk class. No findings issued.

- `deploy/v2/session/status` (`_status.ts`) — POST, no rate limit (read-only: loads session, returns state, no mutation, no on-chain calls). Authenticated via `loadAuthorizedDeploySession`. PASS.
- `deploy/v2/session/create` (`_createCore.ts`, full create) — POST, durable rate limit with `failClosed`, authenticated, DB + on-chain mutation. PASS.
- `deploy/v2/session/create` (`_createCore.ts`, preflightOnly) — POST, in-memory rate limit (20/min), read-only (returns readiness without side effects). PASS.
- `deploy/v2/session/dryRun` (`_dryRunCore.ts`) — POST, in-memory rate limit, authenticated, local-fork-only (throws `LOCAL_FORK_ONLY_ERROR` if not configured). No production chain interaction. PASS (rate limit gap noted in APIAUTH-011).
- `deploy/v2/session/cancel` (`_cancelCore.ts`) — POST, in-memory rate limit (per auth.address), authenticated, session-authorized, validates calls via `validateSponsoredSmartWalletCalls` before cleanup UserOp. PASS (rate limit gap noted in APIAUTH-011).
- `deploy/solanaInfraStatus` (`_solanaInfraStatus.ts`) — GET, admin or machine auth (`isAdminAddress` or `isInternalSolanaRegistrationAuthorized`), read-only. PASS.
- `deploy/provisionSolanaRoute` (`_provisionSolanaRoute.ts`) — POST, machine auth (Bearer secret), in-memory IP rate limit, bounded body, runs `wrap-token` CLI. PASS (Solana mutation requires machine auth, not user-session auth — no P0).
- `deploy/registerSolanaBridgeToken` (`_registerSolanaBridgeToken.ts`) — POST, admin or internal secret auth, mutating registration requires internal secret, build-only available to admin. PASS (Solana mutation requires machine auth — no P0).
- `paymaster` (`_paymaster.ts`) — POST (JSON-RPC), validates EntryPoint v0.6 only, Base chainId only, sender address, callData, per-sender sponsorship limit, session/deploy-session auth, deploy session token signature, inner calls via `validateSponsoredSmartWalletCalls`. Thorough sender/mode/target/value/canonical-signer validation. PASS (rate limit gap noted in APIAUTH-008, validation is correct).
- `relay/intent-status` (`_intent-status.ts`) — GET, in-memory IP rate limit, read-only (fetches Relay intent status by requestId/orderId). PASS.
- `telegram/link/complete` (`_link-complete.ts`) — POST, Privy auth, Telegram session proof, single-use claim-bound link token consumed on success, merge preflight. PASS (rate limit gap noted in APIAUTH-013).
- `telegram/webhook` (`_webhook.runtime.ts`) — POST, Telegram secret token verification (`x-telegram-bot-api-secret-token`, line 7243-7245), in-memory IP rate limit. PASS.
- `wallet/sync` (`_sync.ts`) — POST, Privy auth, in-memory IP rate limit, DB writes. PASS (rate limit gap noted in APIAUTH-010).
- `wallet/confirm-owner` (`_confirm-owner.ts`) — POST, auth inside `confirmOwnerState`, in-memory IP rate limit, bounded body 8KB. PASS (rate limit gap noted in APIAUTH-010).
- `wallet/prepare-add-privy-owner` (`_prepare-add-privy-owner.ts`) — POST, Privy verify, in-memory IP rate limit, no body. PASS (rate limit gap noted in APIAUTH-010).
- `wallet/disconnect-external` (`_disconnect-external.ts`) — POST, auth via `readRequestPrincipalAddress`, in-memory IP rate limit, DB writes. PASS (rate limit gap noted in APIAUTH-010).

### Shard B — route maps inspected (not deep-inspected)

The following route maps were read to enumerate route-to-handler mappings. Individual handler files were not deep-inspected in this shard and retain NEEDS MANUAL REVIEW status for future shards.

- `_routes.keepr.ts` — 8 routes: join, joinStatus, nonce, vault/automation, vault/upsert, actions/enqueue, actions/pending, actions/updateStatus
- `_routes.uniswap.ts` — 11 routes: query, poolHistory, quote, swap, order, checkApproval, checkDelegation, swap5792, swap7702, plan, liquidity
- `_routes.wallet.solana.ts` — 3 routes: setCanonical, sweep/enqueue, sweep/process

### Shard B — files not found

- `telegram/_link-start.ts` — does not exist. The route map (`_routes.telegram.ts`) has no `link/start` entry. The link-start token is created by a different handler (likely `telegram/_link-ready.ts` or `telegram/_miniapp-session.ts`).
- `telegram/_verify-miniapp.ts` — does not exist. Mini App session verification is handled by `readTelegramMiniAppSession` (imported from `@4626/server-core`) and called inline by `telegram/_link-complete.ts`.

---

## Shard C — v1 financial / lottery / chat-media / AlfaClub / backtest / agents / build routes

Inspected on 2026-06-25. 24 handler files deep-inspected plus `_routes.v1.ts` (258-line route map, ~130 route entries). All files in the user's shard C scope were found and read. No P0 stop conditions triggered.

### Shard C — P0 stop condition assessment

All four P0 criteria checked and cleared:

1. **Anonymous compute-heavy backtest execution**: NOT triggered. `_backtest-run.ts` requires Privy auth (`verifyPrivyForAccounts`) before executing `executeBacktestCounterRebalance` (fetches candle data + runs simulation). Not anonymous. Rate limit gap noted in APIAUTH-014.
2. **Chat/media mutation not owner-scoped**: NOT triggered. `_hermit-meme-save.ts` and `_hermit-meme-delete.ts` both check `isHermitOwner(sessionAddress)` and `isHermitRoomAllowedForOwner({ roomId, ownerAddress: sessionAddress })` before DB writes. Delete also passes `ownerAddress` into `softDeleteHermitMeme` so the DB query is owner-scoped. `_hermit.ts` requires `isHermitUserAllowed(sessionAddress)` and blocks keeper write commands (`isKeeperWriteCommandText`). All owner-scoped.
3. **Financial mutation accepting only client-provided wallet/profile IDs without server-side ownership resolution**: NOT triggered. `creators/_enable.ts` resolves `resolveCanonicalSmartWalletAddress(creator)` and validates `cswAddress` matches before `enableCswAgent`. `creators/_provisionWallet.ts` validates `requestedAddress` against `allowedTargets` (principal address + canonical CSW). `identity/_setAgentWallet.ts` resolves canonical owner and validates session/SIWA auth against it. All have server-side ownership resolution.
4. **Unauthenticated mutating endpoint with DB/chain/external side effects**: NOT triggered. All mutating endpoints require auth (`guardAgentApiRequest`, Privy, CRON_SECRET, or admin session). Unauthenticated endpoints (`_backtest-sweep`, `_backtest-series`, `_backtest-audit`, `_backtest-markets`) are all read-only GET (filesystem reads or external API fetch).

### APIAUTH-014 (Medium) — In-memory rate limit on compute-heavy backtest execution

**File**: `frontend/api/_handlers/v1/alfaclub/_backtest-run.ts:103-110`

The backtest-run endpoint uses `checkRateLimit` (in-memory, `RATE_LIMITS.alfaclubBacktestRun` — 5/min per privy user + IP) with no durable rate limit fallback. Privy auth is required (`verifyPrivyForAccounts`), so this is NOT anonymous (P0 criterion 1 not met). However, on Vercel serverless, in-memory rate limits reset per cold start — a valid Privy user can bypass the 5/min throttle by triggering cold starts. The endpoint calls `executeBacktestCounterRebalance` which fetches candle data from an exchange API and runs a full counter-rebalance simulation, making it the most compute-expensive endpoint in the v1 surface. All numeric parameters are clamped to safe ranges (`toRangeNumber`, `clampBacktestHealthFloor`), preventing parameter-injection abuse. No DB or chain side effects — output is written to `tmp/backtests` filesystem only.

**Risk**: Authenticated compute abuse. A valid Privy user with a script can trigger repeated expensive simulations, consuming serverless execution time and potentially exhausting upstream exchange API rate budgets. Medium because auth is present but the rate limit is not durable.

**Cross-ref**: Same in-memory pattern as APIAUTH-003, APIAUTH-004, APIAUTH-008, APIAUTH-010, APIAUTH-011, APIAUTH-013. The AMOE lottery handlers (`_amoeSubmit`, `_amoeSubmitZk`, `_amoeRetryZk`, `_amoeBurnCredits`) correctly layer `checkDurableRateLimit` on top of `checkRateLimit` — this endpoint lacks that durable layer.

### APIAUTH-015 (Low) — In-memory rate limits on chat/media mutation endpoints

**Files**:
- `frontend/api/_handlers/v1/chat/_hermit.ts:57-64` — `checkRateLimit` (in-memory, `chatCommandPreflight`)
- `frontend/api/_handlers/v1/chat/_hermit-meme-save.ts:59-66` — `checkRateLimit` (in-memory, `adminAction`)
- `frontend/api/_handlers/v1/chat/_hermit-meme-delete.ts:51-58` — `checkRateLimit` (in-memory, `adminAction`)

All three chat handlers use in-memory `checkRateLimit` with no durable rate limit. Auth is session-based (`readSessionFromRequest`) in all three. `_hermit.ts` additionally requires `isHermitUserAllowed` (allowlist) and blocks keeper write commands (`isKeeperWriteCommandText`), keeping the Hermit lane read-only. `_hermit-meme-save.ts` and `_hermit-meme-delete.ts` both check `isHermitOwner` + `isHermitRoomAllowedForOwner` before DB writes, and the delete handler passes `ownerAddress` into `softDeleteHermitMeme` for owner-scoped DB queries. Owner-scoping is correct — the P0 criterion for "chat/media mutation not owner-scoped" is not met.

**Risk**: Low. Blast radius is limited to Hermit-allowlisted users (small set). The in-memory limiter doesn't persist across serverless invocations, but the auth + owner-scoping gates limit abuse to authenticated owners acting on their own rooms.

### APIAUTH-016 (Low) — Unauthenticated read-only backtest endpoints with in-memory IP-only rate limits

**Files**:
- `frontend/api/_handlers/v1/alfaclub/_backtest-sweep.ts:97-104` — `checkRateLimit` (in-memory, `smartWalletOwnerRead`), no auth
- `frontend/api/_handlers/v1/alfaclub/_backtest-series.ts:56-63` — `checkRateLimit` (in-memory, `smartWalletOwnerRead`), no auth
- `frontend/api/_handlers/v1/alfaclub/_backtest-audit.ts:91-98` — `checkRateLimit` (in-memory, `smartWalletOwnerRead`), no auth
- `frontend/api/_handlers/v1/alfaclub/_backtest-markets.ts:30-37` — `checkRateLimit` (in-memory, `creatorQuickstart`), no auth

All four endpoints are unauthenticated GET with in-memory IP-only rate limits and public CORS (`*`). The first three read local CSV/JSON files from `tmp/backtests` with path sanitization (`path.basename`, `.csv` extension check — no traversal risk). `_backtest-markets.ts` fetches from the Hyperliquid API (`getPerpMarkets`) with a fallback to static markets. None have DB or chain side effects — all are read-only.

**Risk**: Low. The filesystem reads are non-sensitive simulation output. `_backtest-markets.ts` makes an unauthenticated external API call (Hyperliquid) which could be used for amplification, but the rate limit and the lightweight nature of the call (single market list fetch) limit impact. The in-memory limiter doesn't persist across serverless invocations, so a distributed caller could read backtest files or trigger Hyperliquid fetches more frequently than intended.

### APIAUTH-017 (Low) — In-memory rate limits on CRON_SECRET/admin-gated AlfaClub endpoints

**Files**:
- `frontend/api/_handlers/v1/alfaclub/_run.ts:64-71` — `checkRateLimit` (in-memory, `adminAction`), CRON_SECRET auth
- `frontend/api/_handlers/v1/alfaclub/_chat-token-refresh.ts:75-85` — `checkRateLimit` (in-memory, `adminAction`), CRON_SECRET auth
- `frontend/api/_handlers/v1/alfaclub/_chat-bridge-run.ts:58-65` — `checkRateLimit` (in-memory, `adminAction`), CRON_SECRET auth
- `frontend/api/_handlers/v1/alfaclub/_chat-token.ts:105-112` — `checkRateLimit` (in-memory, `adminAction`), admin session or CRON_SECRET auth

All four AlfaClub cron/admin endpoints use in-memory `checkRateLimit` with no durable rate limit. `_run.ts`, `_chat-token-refresh.ts`, and `_chat-bridge-run.ts` are CRON_SECRET-gated (machine auth via `x-cron-secret` header or Bearer). `_chat-token.ts` accepts admin session or CRON_SECRET for POST, admin session only for GET/DELETE.

`_chat-token.ts` handles sensitive credential material — it stores Privy JWT, access tokens, and refresh tokens in the DB. GET correctly returns only fingerprints (never raw JWT). POST validates JWT shape (`isPlausibleJwt`) and refresh token shape (`isPlausibleRefreshToken`), and checks `assertRefreshTokenSeedAllowed` before bootstrapping the refresher. The auth gate is correct (admin or cron only).

**Risk**: Low. Machine auth (CRON_SECRET) or admin session required. The in-memory limiter doesn't persist across serverless invocations, but the caller set is restricted to the cron system or admin. A compromised CRON_SECRET or admin session could brute-force these endpoints without persistent throttling, but the same compromise would already grant full access to the underlying operations.

### APIAUTH-018 (Low) — In-memory rate limits on build-only calldata endpoints

**Files**:
- `frontend/api/_handlers/v1/build/auction/_submitBid.ts:61-68` — `checkRateLimit` (in-memory, `buildAuctionSubmitBid`)
- `frontend/api/_handlers/v1/build/gauge/_vote.ts:40-47` — `checkRateLimit` (in-memory, `buildGaugeVote`)
- `frontend/api/_handlers/v1/build/ve4626/_lock.ts:50-57` — `checkRateLimit` (in-memory, `buildVe4626Calldata`)
- `frontend/api/_handlers/v1/build/ajna/_borrow.ts:35-42` — `checkRateLimit` (in-memory, `buildAjnaCalldata`)

All four build handlers use in-memory `checkRateLimit` with no durable rate limit. All are authenticated via `guardAgentApiRequest` (build kind). All are build-only — they encode calldata via `encodeFunctionData` and return it to the client; no server-side chain mutation occurs. The client must submit the transaction themselves, and on-chain checks enforce actual ownership/authorization.

`_submitBid.ts` accepts a client-provided `owner` field and adds a warning if it differs from the auth address but does not reject. `_borrow.ts` accepts a client-provided `borrower` field without validating it against the auth address. Both are acceptable for build-only endpoints — the on-chain contract enforces sender = owner/borrower at execution time. The handlers explicitly warn about this in the response.

**Risk**: Low. Build-only endpoints with no server-side mutation. The in-memory limiter doesn't persist, but the only cost is calldata encoding (cheap). The unvalidated owner/borrower fields are not a security issue because the client must submit the tx and on-chain checks apply.

### APIAUTH-019 (Low) — In-memory rate limits on agent management endpoints with DB writes

**Files**:
- `frontend/api/_handlers/v1/agents/creators/_enable.ts:49-56` — `checkRateLimit` (in-memory, `agentsWrite`)
- `frontend/api/_handlers/v1/agents/creators/_provisionWallet.ts:57-64` — `checkRateLimit` (in-memory, `agentsWrite`)
- `frontend/api/_handlers/v1/agents/identity/_setAgentWallet.ts:85-92` — `checkRateLimit` (in-memory, `agentIdentitySetWallet`)

All three agent management endpoints use in-memory `checkRateLimit` with no durable rate limit. All are authenticated via `guardAgentApiRequest`. All perform server-side ownership resolution:

- `_enable.ts`: For CSW mode, resolves `resolveCanonicalSmartWalletAddress(creator)` and validates `cswAddress` matches before `enableCswAgent`. For EOA mode, uses `getOrCreateCreatorXmtpAgent` with the authenticated creator address.
- `_provisionWallet.ts`: Validates `requestedAddress` against `allowedTargets` (principal address + canonical CSW). Rejects if the requested address is not the signer or their canonical CSW.
- `_setAgentWallet.ts`: Resolves `resolveCanonicalSmartWalletAddress(ownerAddress)` and validates it matches. For session auth, validates session canonical matches owner. For SIWA auth, validates `agentId` matches the SIWA receipt. This is build-only (returns EIP-712 typed data or encoded calldata, no chain mutation).

`_enable.ts` and `_provisionWallet.ts` perform DB writes (creating agent records, provisioning Privy server wallets). `_setAgentWallet.ts` is build-only. Server-side ownership resolution is correct in all three — the P0 criterion for "financial mutation accepting only client-provided wallet/profile IDs without server-side ownership resolution" is not met.

**Risk**: Low. Authenticated + server-side ownership validated. The in-memory limiter doesn't persist across serverless invocations, but the ownership gates prevent cross-user agent provisioning or wallet manipulation. A valid user could trigger repeated idempotent DB writes (getOrCreate pattern), but the blast radius is limited to their own account.

### Shard C — PASS list (routes with correct security posture)

- `lottery/amoe/submit` (`_amoeSubmit.ts`) — POST, `guardAgentApiRequest` auth, in-memory + **durable** rate limit (`checkDurableRateLimit`, 6/min), `resolveAmoeWallet` server-side wallet resolution, `verifyAmoeEntryProof` signature verification, pre-flight balance gate (`getAmoeCreditSnapshot`), relay-first-debit-second ordering (prevents credit burn on contract revert). PASS.
- `lottery/amoe/submit-zk` (`_amoeSubmitZk.ts`) — POST, `guardAgentApiRequest` auth, in-memory + **durable** rate limit, feature-flagged (`AMOE_ZK_SUBMIT_ENABLED`, fail-closed), `resolveAmoeWallet` (wallet from auth context, not body), full EIP-191 message binding (wallet, creatorCoin, nonce, chainId, lotteryManager, expiresAt), `verifyAmoeWalletSignature`, atomic nonce consumption (`consumeAmoeNonceForSubmit`), replay store with in-flight dedupe, burn-then-submit reader pre-flight. PASS.
- `lottery/amoe/retry-zk` (`_amoeRetryZk.ts`) — POST, `guardAgentApiRequest` auth, in-memory + **durable** rate limit (10/min), UUID validation, `resolveAmoeWallet` caller ownership, `retrySubmissionById` with `callerSignupId` ownership check. PASS.
- `lottery/amoe/burn-credits` (`_amoeBurnCredits.ts`) — POST, `guardAgentApiRequest` auth, in-memory + **durable** rate limit (6/min), feature-flagged (`AMOE_BURN_CREDITS_ENABLED`, fail-closed), `resolveAmoeWallet` server-side ownership, full EIP-191 message binding, `verifyAmoeWalletSignature`, pre-flight balance gate, atomic idempotent debit (`consumeAmoeCreditsForEntry` with `spendRefId` dedup). PASS.
- `chat/hermit` (`_hermit.ts`) — POST, session auth + `isHermitUserAllowed` allowlist, read-only lane (blocks keeper write commands via `isKeeperWriteCommandText`). PASS (rate limit gap noted in APIAUTH-015).
- `chat/hermit/memes/save` (`_hermit-meme-save.ts`) — POST, session auth + `isHermitOwner` + `isHermitRoomAllowedForOwner` (owner-scoped room validation before DB write). PASS (rate limit gap noted in APIAUTH-015).
- `chat/hermit/memes/delete` (`_hermit-meme-delete.ts`) — POST, session auth + `isHermitOwner` + `isHermitRoomAllowedForOwner` + owner-scoped `softDeleteHermitMeme` (ownerAddress in delete query). PASS (rate limit gap noted in APIAUTH-015).
- `alfaclub/run` (`_run.ts`) — GET/POST, CRON_SECRET auth, kill switch check, in-memory rate limit. PASS (rate limit gap noted in APIAUTH-017).
- `alfaclub/chat-token` (`_chat-token.ts`) — GET/POST/DELETE, admin session or CRON_SECRET auth, GET returns fingerprints only (never raw JWT), refresh token seed guard. PASS (rate limit gap noted in APIAUTH-017).
- `alfaclub/chat-token-refresh` (`_chat-token-refresh.ts`) — GET/POST, CRON_SECRET auth, in-memory rate limit, forces refresh on cron path. PASS (rate limit gap noted in APIAUTH-017).
- `alfaclub/chat-bridge-run` (`_chat-bridge-run.ts`) — GET/POST, CRON_SECRET auth, in-memory rate limit. PASS (rate limit gap noted in APIAUTH-017).
- `alfaclub/backtest-run` (`_backtest-run.ts`) — POST, Privy auth required, in-memory rate limit, parameter clamping. PASS (rate limit gap noted in APIAUTH-014).
- `alfaclub/backtest-sweep` (`_backtest-sweep.ts`) — GET, no auth, in-memory IP rate limit, path-sanitized filesystem read. PASS (rate limit gap noted in APIAUTH-016).
- `alfaclub/backtest-series` (`_backtest-series.ts`) — GET, no auth, in-memory IP rate limit, path-sanitized filesystem read. PASS (rate limit gap noted in APIAUTH-016).
- `alfaclub/backtest-audit` (`_backtest-audit.ts`) — GET, no auth, in-memory IP rate limit, path-sanitized filesystem read. PASS (rate limit gap noted in APIAUTH-016).
- `alfaclub/backtest-markets` (`_backtest-markets.ts`) — GET, no auth, in-memory IP rate limit, external API fetch with fallback. PASS (rate limit gap noted in APIAUTH-016).
- `agents/creators/enable` (`_enable.ts`) — POST, `guardAgentApiRequest` auth, server-side canonical CSW resolution + validation. PASS (rate limit gap noted in APIAUTH-019).
- `agents/creators/provision-wallet` (`_provisionWallet.ts`) — POST, `guardAgentApiRequest` auth, server-side ownership validation (principal + canonical CSW allowlist). PASS (rate limit gap noted in APIAUTH-019).
- `agents/identity/set-agent-wallet` (`_setAgentWallet.ts`) — POST, `guardAgentApiRequest` auth, server-side canonical owner resolution + session/SIWA validation, build-only (returns calldata). PASS (rate limit gap noted in APIAUTH-019).
- `build/auction/submitBid` (`_submitBid.ts`) — POST, `guardAgentApiRequest` auth, build-only (encodes calldata, no chain mutation). PASS (rate limit gap noted in APIAUTH-018).
- `build/gauge/vote` (`_vote.ts`) — POST, `guardAgentApiRequest` auth, build-only. PASS (rate limit gap noted in APIAUTH-018).
- `build/ve4626/lock` (`_lock.ts`) — POST, `guardAgentApiRequest` auth, build-only. PASS (rate limit gap noted in APIAUTH-018).
- `build/ajna/borrow` (`_borrow.ts`) — POST, `guardAgentApiRequest` auth, build-only. PASS (rate limit gap noted in APIAUTH-018).

---

## Wallet/Identity Pass (2026-06-25)

**Scope**: canonical wallet policy, parent CSW vs embedded EOA vs external EOA, canonical4337 sender/signer invariants, execution router behavior, wallet sync and identity merging, tombstoned profile handling, stale external primary wallet behavior, canonical CSW persistence, wallet disconnect behavior.

**P0 stop-condition checks — all PASS (no stop triggered)**:

1. **Sponsored canonical swaps routing from non-parent-CSW under canonical4337** — PASS. `sendViaCanonical4337` (`txRouter.ts:686-700`) resolves `canonicalIdentity = resolveCanonicalIdentityAddress(context)` via `resolvePolicyCanonicalAddress`, which maps to the canonical CSW (parent CSW) for all canonical-mode contexts. The ERC-4337 sender is always `canonicalIdentity`, never the embedded EOA or external EOA. `assertCanonicalPolicyContext` (`txRouter.ts:361-392`) additionally blocks non-canonical execution addresses (line 377-381).

2. **Fallback signer path activating for CANONICAL_CSW_ADDRESS without execution signer policy** — PASS. `Swap.tsx:405-409` guards the external EOA fallback with `!isCanonicalCsw(canonicalAddress)` — the fallback never activates when the canonical address is the platform CSW. `sendViaCanonical4337:699-700` hard-blocks signers not on `isAllowedCanonicalCswExecutionSigner` when `canonicalIdentity === CANONICAL_CSW_ADDRESS`. The `sendCalls` and `canonicalDirect` paths use the broader `isAllowedCanonicalSigner` check, but the practical signer set is a subset of the execution set (see WALLET-002 for the defense-in-depth gap).

3. **Wallet sync writing Privy identity onto tombstoned profiles** — PASS. `walletSync.ts` `findExistingProfileByAddress` (lines 104-131) and `findExistingProfile` (lines 159-166) both follow `merged_into_profile_id` tombstone pointers via `JOIN profiles p ON p.id = COALESCE(m.merged_into_profile_id, m.id) WHERE p.merged_into_profile_id IS NULL`. `resolvePrimaryProfileIdForPrivyUser` (`server-core/profileIdForPrivyUser.ts:40-58`) follows the same pattern. Writes go to the resolved live profile ID. (See WALLET-001 for a fallback path gap.)

4. **External EOA frozen as primary when embedded owner/canonical CSW path is ready** — PASS. `resolveProfilesPrimaryWalletColumn` (`disconnectExternalWallet.ts:23-34`) returns `embedded` when `canonical && embedded` are both present, and `canonical` when only canonical is present. The walletSync UPDATE path (`walletSync.ts:805`: `primary_wallet = COALESCE(${primary}, primary_wallet)`) overwrites the external EOA with the resolved value when it is non-null. `disconnectExternalWallet.nextPrimary` (line 75: `embedded ?? canonical ?? ...`) also correctly prioritizes embedded/canonical. (See WALLET-004 for a canonical-absent edge case.)

### WALLET-001

**Severity**: Medium
**Domain**: Identity / tombstone integrity
**File**: `frontend/server/_lib/wallet/canonicalCswDelegation.ts:170-210` — `recoverProfileIdFromPrivyHints`
**Route/function**: `resolveCanonicalCsw` fallback path (lines 449-451, 459-461)

**Trigger/precondition**: A Privy user whose `privy_user_id` does not resolve via `readProfileIdByPrivyUserId` (e.g. alias table missing or not yet migrated) AND whose profile was previously merged into another profile (tombstoned with `merged_into_profile_id` set). The user triggers a wallet bootstrap or owner confirmation endpoint (`/api/wallet/confirm-owner`, `/api/wallet/prepare-add-privy-owner`).

**Expected invariant**: All profile ID resolution paths must follow `merged_into_profile_id` tombstone pointers to the live canonical profile, preventing writes onto tombstoned rows.

**Observed behavior**: `recoverProfileIdFromPrivyHints` performs three lookups that do NOT follow tombstones:
1. Email lookup (line 159-164): `SELECT id FROM profiles WHERE LOWER(email) = ${normalized} LIMIT 1` — no `merged_into_profile_id IS NULL` filter.
2. Wallet address lookup in `profile_wallets` (lines 184-193): `SELECT profile_id FROM profile_wallets WHERE LOWER(address) = ${address}` — no tombstone join.
3. Profiles column lookup (lines 195-207): `SELECT id FROM profiles WHERE LOWER(COALESCE(primary_wallet, '')) = ${address} ...` — no tombstone filter.

Any of these can return a tombstoned profile ID. In `resolveCanonicalCsw`, this ID is used at lines 528-535 to write `privy_user_id`, `csw_address`, and `primary_smart_wallet` onto the tombstoned row, and at lines 520-526 to call `ensureCanonicalWalletRow` — resurrecting the merged fragment.

**Evidence**: `canonicalCswDelegation.ts:159` `SELECT id FROM profiles WHERE LOWER(email) = ${normalized} LIMIT 1` — no `merged_into_profile_id IS NULL`. Compare with `walletSync.ts:129-130` and `profileIdForPrivyUser.ts:52-53` which both apply `COALESCE(m.merged_into_profile_id, m.id)` + `WHERE p.merged_into_profile_id IS NULL`.

**Pass/Fail criterion**: PASS if `recoverProfileIdFromPrivyHints` follows tombstone pointers (COALESCE + IS NULL filter) on all three lookup paths. FAIL if any lookup can return a tombstoned profile ID.

**Minimal remediation**: Add `AND merged_into_profile_id IS NULL` to the email and profiles-column lookups. For the `profile_wallets` lookup, join `profiles` and apply the same COALESCE + IS NULL filter as `findExistingProfileByAddress`.

**Launch impact**: Low-medium. The primary resolver (`readProfileIdByPrivyUserId`) correctly follows tombstones, so this only triggers in the fallback path (alias table missing or stale Privy user ID). The consequence is delegation state divergence between the tombstone and the live profile, which could cause the user's canonical CSW / embedded EOA to appear unset on the live profile.

### WALLET-002

**Severity**: Low
**Domain**: Canonical CSW execution signer policy / defense-in-depth
**File**: `frontend/src/lib/tx/txRouter.ts:361-392` — `assertCanonicalPolicyContext`; `frontend/src/wallet/canonicalWalletPolicy.ts:79-81` — `isAllowedCanonicalSigner`

**Trigger/precondition**: The platform canonical CSW (`CANONICAL_CSW_ADDRESS`) is the execution identity. A signer address that is in `CANONICAL_CSW_ALLOWED_OWNER_EOAS` but NOT in `CANONICAL_CSW_EXECUTION_OWNER_ADDRESSES` attempts to route via `sendCalls` or `canonicalDirect`.

**Expected invariant**: All canonical execution paths for the platform CSW should enforce the same execution-signer allowlist (`isAllowedCanonicalCswExecutionSigner`), not the broader owner-EOA allowlist (`isAllowedCanonicalSigner`).

**Observed behavior**: `assertCanonicalPolicyContext` (line 383) checks `isAllowedCanonicalSigner(context.signerAddress)` — which is `isCanonicalCsw(value) || isAllowedOwnerEoa(value)` (the broader set). This is the only signer check for `sendCalls` (line 560) and `canonicalDirect` (line 879). `sendViaCanonical4337` (line 699-700) adds a separate hard block via `isAllowedCanonicalCswExecutionSigner` (the stricter execution set), but only in the canonical4337 path.

Currently, `CANONICAL_CSW_ALLOWED_OWNER_EOAS` = `['0x858c...']` and `CANONICAL_CSW_EXECUTION_OWNER_ADDRESSES` = `['0xceca...', '0x858c...', '0xb05c...']`. The broader set's only non-CSW member (`0x858c...`) is also in the execution set. So no signer can currently bypass canonical4337 via sendCalls/canonicalDirect. The gap becomes exploitable only if a future owner EOA is added to `CANONICAL_CSW_ALLOWED_OWNER_EOAS` without also adding it to `CANONICAL_CSW_EXECUTION_OWNER_ADDRESSES`.

The on-chain CSW `isOwner` check is the ultimate enforcement for `canonicalDirect` (the external EOA must be an on-chain owner to call `executeBatch`). For `sendCalls`, the wallet provider validates ownership. This makes the gap defense-in-depth, not a primary enforcement failure.

**Evidence**: `txRouter.ts:383` `if (!isAllowedCanonicalSigner(context.signerAddress))` — broader check. `txRouter.ts:700` `if (!isAllowedCanonicalCswExecutionSigner(context.signerAddress))` — stricter check, only in canonical4337. `canonicalWalletPolicy.ts:79-81` `isAllowedCanonicalSigner = isCanonicalCsw(value) || isAllowedOwnerEoa(value)`.

**Pass/Fail criterion**: PASS if `assertCanonicalPolicyContext` checks `isAllowedCanonicalCswExecutionSigner` when the canonical identity is `CANONICAL_CSW_ADDRESS`, or if the sendCalls/canonicalDirect paths add the same execution-signer hard block. FAIL if the broader check is the only signer gate for sendCalls/canonicalDirect.

**Minimal remediation**: In `assertCanonicalPolicyContext`, after resolving `canonicalIdentity`, add: `if (isCanonicalCsw(canonicalIdentity) && !isAllowedCanonicalCswExecutionSigner(context.signerAddress)) throw new Error(...)`. This centralizes the execution-signer check for all canonical paths.

**Launch impact**: Low. No current exploitable gap. The two allowlists are kept in sync by convention (comment at `canonicalWalletPolicy.ts:29-30` instructs adding to both). Defense-in-depth hardening recommended before adding new owner EOAs.

### WALLET-003

**Severity**: Low
**Domain**: Wallet API rate limiting
**Files**: `frontend/api/_handlers/wallet/_sync.ts:60`, `_confirm-owner.ts:68`, `_prepare-add-privy-owner.ts:54`, `_disconnect-external.ts:43`

**Trigger/precondition**: Any of the four wallet-linking endpoints receives repeated requests from the same IP within the rate-limit window.

**Expected invariant**: Sensitive wallet-linking endpoints (Privy token verification, DB writes, on-chain owner checks, profile mutation) should use `checkDurableRateLimit` (persisted, fail-closed) per the project standard established by AMOE lottery handlers.

**Observed behavior**: All four handlers use `checkRateLimit` (in-memory) with `RATE_LIMITS.cswLink`. In-memory rate limiters reset on Vercel serverless cold starts and do not protect across concurrent invocations. A determined attacker can bypass the limiter by triggering cold starts or distributing requests across invocation instances.

**Evidence**: `_sync.ts:60` `checkRateLimit(rateLimitKey('wallet-sync', getClientIp(req)), RATE_LIMITS.cswLink)`. Same pattern in all four handlers. Compare with AMOE handlers (`_amoeSubmit.ts`) which layer `checkDurableRateLimit` on top of `checkRateLimit`.

**Pass/Fail criterion**: PASS if all four handlers use `checkDurableRateLimit` (or layer it on top of `checkRateLimit`). FAIL if any uses in-memory only.

**Minimal remediation**: Add `checkDurableRateLimit` with `failClosed: true` to each handler, keyed by `getClientIp(req)` (and optionally `authorizedPrincipal.profileId` where available). Use a dedicated durable limit (e.g. `RATE_LIMITS.durableWalletLink`) with a conservative window (e.g. 10/hour per IP).

**Launch impact**: Low. All four endpoints require authentication (Privy JWT or SIWE + authorized principal), so unauthenticated abuse is blocked. The in-memory limiter provides best-effort protection within a single invocation instance. Durable limiting is defense-in-depth against credential-stuffing or owner-check flooding.

### WALLET-004

**Severity**: Low
**Domain**: Wallet sync / primary_wallet column precedence
**File**: `frontend/server/_lib/wallet/disconnectExternalWallet.ts:23-34` — `resolveProfilesPrimaryWalletColumn`

**Trigger/precondition**: A user has an embedded EOA and an external EOA connected, but NO canonical CSW (e.g. CSW setup not yet completed). Wallet sync runs, then the user disconnects the external EOA, then wallet sync runs again.

**Expected invariant**: `profiles.primary_wallet` should consistently track the embedded signer when embedded is present, regardless of canonical CSW presence. The function's own comment (line 29-31) states the column "should track the embedded signer (or CSW when embedded is absent)."

**Observed behavior**: `resolveProfilesPrimaryWalletColumn` returns:
- `embedded` when `canonical && embedded` (both present)
- `canonical` when `canonical` only
- `activeOwner ?? embedded ?? classificationPrimary` when neither canonical branch matches

When canonical is absent but embedded is present, the third branch returns `activeOwner ?? embedded` — the external EOA (`activeOwner`) wins over `embedded`. This contradicts the function's comment and is inconsistent with `disconnectExternalWallet`'s `nextPrimary` logic (line 75: `embedded ?? canonical ?? ...`), which prioritizes embedded unconditionally.

Result: `profiles.primary_wallet` flip-flops between the external EOA (after sync, when canonical is absent) and the embedded EOA (after disconnect). This is a display/lookup column inconsistency, not an execution-path issue — the actual execution address is determined by `executionMode` in Swap.tsx, which is independent of `primary_wallet`.

**Evidence**: `disconnectExternalWallet.ts:32` `if (input.canonical && input.embedded) return input.embedded` — requires canonical. Compare with line 75: `const nextPrimary = embedded ?? canonical ?? ...` — does not require canonical.

**Pass/Fail criterion**: PASS if `resolveProfilesPrimaryWalletColumn` returns `embedded` when embedded is present, regardless of canonical. FAIL if `activeOwner` takes priority over `embedded` when canonical is absent.

**Minimal remediation**: Change the third branch to `return input.embedded ?? input.activeOwner ?? input.classificationPrimary ?? null` — prioritize embedded over activeOwner when canonical is absent, matching the comment and the `nextPrimary` logic.

**Launch impact**: Low. The `primary_wallet` column is legacy display/lookup, not the execution address. The flip-flop is cosmetic and does not affect swap routing or custody. It could cause stale wallet display in account UI when canonical setup is incomplete.

---

## Race-Condition Audit Pass (RACE-NNN)

Audit date: 2026-06-26
Scope: client auth/session, Telegram link, server identity/wallet, deploy-session state machine, swap/paymaster, keeper/backtest/counter-trade orchestration.
Method: Selective file reads targeting concurrent-modification, state-transition, lock/lease, and dedup patterns. No code changes applied (audit-only).

### RACE-001

**Severity**: Low-Medium
**Domain**: Deploy session / concurrent worker transitions
**Files**:
- `frontend/server/_lib/deploy/deploySessions.ts:378-480` — `transitionDeploySession`
- `frontend/api/_handlers/deploy/v2/session/_statusCore.ts:2282-2291` — status-poll triggered transition
- `frontend/server/_lib/deploy/workflow/runner.ts:116` — workflow runner lease claim

**Trigger/precondition**: A deploy session is being processed by the workflow runner (which holds a lease via `claimDeploySessionLease`). Simultaneously, a status poll request hits `_statusCore.ts` and triggers a step transition via `transitionDeploySession`.

**Expected invariant**: Only the worker holding the active lease should be able to transition the session's step, or transitions from other paths should coordinate with the lease.

**Observed behavior**: `transitionDeploySession` uses CAS on `step = fromStep` (`WHERE id = ${params.id} AND step = ${params.fromStep}`) but does NOT check `lock_owner` or `lock_expires_at`. The status-poll path in `_statusCore.ts:2282` calls `transitionDeploySession` directly, bypassing the lease. If the workflow runner holds a lease and the status poll transitions the step, the runner's subsequent transition will fail with `CONCURRENT_MODIFICATION` (CAS miss on fromStep).

**Why it is not worse**: The CAS on step prevents data corruption — two concurrent transitions to different toSteps from the same fromStep will serialize at the Postgres row level, and only the first will match. The second gets 0 rows and returns false. The `_statusCore.ts` code properly throws on `!transitioned`. The system is self-healing: the next status poll reads the updated step.

**Pass/Fail criterion**: PASS if `transitionDeploySession` either checks `lock_owner` or the status-poll path coordinates with the lease. FAIL if transitions can bypass active leases without coordination.

**Minimal remediation**: Either (a) add `AND (lock_owner IS NULL OR lock_owner = ${callerWorkerId} OR lock_expires_at <= NOW())` to `transitionDeploySession`'s WHERE clause, or (b) have `_statusCore.ts` claim a short-lived lease before transitioning. Option (a) is simpler but requires threading a workerId through.

**Launch impact**: Low-Medium. In practice, the workflow runner and status poll are unlikely to target the same step transition simultaneously — the status poll typically advances stages (e.g., `stageUserOpHash`), while the runner advances phases. The CAS prevents corruption. The risk is spurious `CONCURRENT_MODIFICATION` errors that trigger retries, adding latency but not data loss.

### RACE-002

**Severity**: Low
**Domain**: Swap execution / ERC-4337 nonce coordination
**Files**:
- `frontend/src/lib/aa/coinbaseErc4337.ts:809-851` — `resolvePriorPendingUserOpForSubmit`, `readAnyPendingUserOpHashForWallet`
- `frontend/src/hooks/useSwapExecution.ts:2724-2731` — receipt polling with AbortController

**Trigger/precondition**: User has two browser tabs open on the 4626 swap page, both connected to the same canonical CSW. Both tabs initiate a swap simultaneously.

**Expected invariant**: A new canonical swap should wait for any pending UserOp from the same smart wallet to confirm, preventing nonce conflicts and Permit2 nonce reuse.

**Observed behavior**: `readAnyPendingUserOpHashForWallet` reads from `sessionStorage` (per-tab). Tab A's pending UserOp hash is not visible to Tab B. Both tabs submit UserOps concurrently. The ERC-4337 bundler receives two UserOps with potentially conflicting nonces. One will be rejected by the bundler/paymaster.

**Why it is not worse**: The CDP paymaster/bundler is the final arbiter — it will reject the second UserOp with a nonce error. No double-spend is possible because the bundler enforces nonce ordering. The failed swap surfaces an error to the user. The `swapSubmitEpochRef` + `swapReceiptPollRef` AbortController pattern correctly handles stale completions within a single tab.

**Pass/Fail criterion**: PASS if cross-tab concurrent swaps are either coordinated or safely rejected. FAIL if cross-tab swaps can corrupt nonce state.

**Minimal remediation**: Use `BroadcastChannel` or `localStorage` storage event to share pending UserOp hashes across tabs for the same smart wallet. Alternatively, document this as a known limitation and rely on bundler rejection (current behavior).

**Launch impact**: Low. Multi-tab swap from the same CSW is an edge case. The bundler rejection prevents fund loss. UX impact is a confusing error message on the second tab.

### RACE-003

**Severity**: Low
**Domain**: Identity / email collision profile merge
**Files**:
- `frontend/server/_lib/identity/emailCollisionAdoption.ts:109-123` — `mergePlaceholderProfiles` (SELECT then iterate)
- `frontend/api/_handlers/waitlist/_bootstrap.ts:39` — caller (no transaction wrapper found)

**Trigger/precondition**: The same Privy user triggers two concurrent bootstrap requests (e.g., double-submit, or two tabs). Both fail with email collision and both enter the adoption path. Both call `mergePlaceholderProfiles` which reads placeholder profiles then modifies them one-by-one.

**Expected invariant**: The placeholder profile merge should be atomic — either all placeholders are merged into the target profile or none are.

**Observed behavior**: `mergePlaceholderProfiles` does `SELECT id FROM profiles WHERE privy_user_id = ... AND id <> targetProfileId` then iterates the rows, performing individual UPDATEs. The sequence is not wrapped in `BEGIN/COMMIT`. Between the SELECT and the UPDATEs, another concurrent adoption could modify the same placeholder rows.

**Why it is not worse**: The individual UPDATEs in the merge are likely idempotent (reassigning data to the target profile, then nulling out the placeholder). The `upsertPrivyUserAlias` uses `ON CONFLICT DO NOTHING`. Concurrent adoptions for the same Privy user processing the same placeholders would result in redundant UPDATEs, not data corruption. The `assertNoEmailPrivyCollision` guard catches cross-user email collisions (different Privy users, same email) and forces recovery UX, so the adoption path is only for same-Privy-user placeholder cleanup.

**Pass/Fail criterion**: PASS if `mergePlaceholderProfiles` is wrapped in a DB transaction or the individual operations are idempotent. FAIL if concurrent adoptions can corrupt profile data.

**Minimal remediation**: Wrap the `mergePlaceholderProfiles` call in `withDbTransaction` (the helper already exists in `walletSync.ts:38-50`). Or wrap the entire `runWithWaitlistEmailCollisionAdoption` retry path in a transaction.

**Launch impact**: Low. The scenario requires the same Privy user to trigger two concurrent bootstraps — a rare edge case. The `ON CONFLICT DO NOTHING` patterns and idempotent UPDATEs provide informal safety. The transaction would add formal atomicity.

### RACE-004

**Severity**: Very Low (informational)
**Domain**: AlfaClub counter-trade / multi-actor enforcement
**Files**:
- `frontend/server/_lib/alfaclub/counterTradeRunner.ts:126-143` — `listActiveCounterTradeOptIns` then `enforceSingleActiveCounterTradeActor`

**Trigger/precondition**: Room 1659 has multiple active counter-trade opt-ins. Two ticks run back-to-back (not concurrently — the `inFlight` guard prevents overlap). Between the list and the enforcement, an opt-in status could change.

**Observed behavior**: `listActiveCounterTradeOptIns` returns active opt-ins, then `enforceSingleActiveCounterTradeActor` pauses all but the first. If an opt-in becomes active between the list and the enforcement, it will not be paused until the next tick.

**Why it is not worse**: The `inFlight` boolean guard in `counterTradeTicker.ts:107` ensures only one tick runs at a time. The enforcement is idempotent and runs every tick. Any missed opt-in is caught on the next tick. The `spotSweepAttempted` Set prevents double-sweeps within a tick.

**Pass/Fail criterion**: PASS (informational — the inFlight guard and idempotent enforcement make this self-healing).

**Launch impact**: None. This is an informational note about a benign TOCTOU that is self-correcting.

### Patterns Verified as Safe (no finding)

1. **Deploy session lease acquisition** (`claimDeploySessionLease`): Atomic `UPDATE ... WHERE lock_expires_at IS NULL OR lock_expires_at <= now RETURNING id` — correct optimistic lease. Multiple workers can list the same sessions, but only one claims each.
2. **Telegram link-start token consumption** (`claimAndConsumeTelegramLinkStartToken`): `INSERT ... ON CONFLICT DO NOTHING RETURNING` for the primary path, `UPDATE ... WHERE consumed_at IS NULL RETURNING` for the legacy-claim path — both atomic. The SELECT-then-UPDATE in the legacy path has a TOCTOU window, but the UPDATE's `WHERE consumed_at IS NULL` makes it safe.
3. **Counter-trade event dedup** (`registerCounterTradeEventIfNew`): `INSERT ... ON CONFLICT (room_id, sender_address, event_key) DO NOTHING RETURNING` — atomic dedup. The `inFlight` guard in the ticker prevents tick overlap.
4. **useSiweAuth shared session fetch** (`authMeInFlight` Promise): Module-level in-flight Promise deduplication across hook instances within the same tab. The 1.5s cache + 30s snapshot TTL prevents redundant fetches. Cross-tab is expected to be independent (each tab manages its own session).
5. **KPR runner** (`runner.ts`): Single-workflow CLI execution, no concurrency.
6. **Solana keeper orchestrator** (`solana-keeper-orchestrator.ts`): Stateless HTTP dispatch, no shared mutable state.
7. **Counter-trade ticker overlap guard** (`counterTradeTicker.ts`): `inFlight` boolean with `finally` cleanup — correct single-executor guard.
8. **Deploy session transition CAS** (`transitionDeploySession`): `WHERE id = ... AND step = fromStep RETURNING id` — correct optimistic concurrency control. Prevents double-advancement.
9. **walletSync.ts withDbTransaction**: Proper `BEGIN/COMMIT` with rollback. Used for wallet sync operations that need atomicity.
10. **Swap submit epoch ref** (`useSwapExecution.ts`): `swapSubmitEpochRef` increments on HMR and submit, discarding stale async results. `swapReceiptPollRef` AbortController cancels stale polling.

---

## Documentation-vs-Implementation Drift Audit

Audit conducted 2026-06-26. Scope: account/wallet docs, parent CSW canonical identity/custody, embedded/external EOA roles, sub-account role, API/runbook route drift, launch-readiness runbook, Telegram Mini App link docs, Solana/KPR ops docs, retired env references. Audit-only — no code or doc fixes applied.

### P0 Stop Condition Assessment

Four P0 stop conditions checked:

| # | Condition | Result |
|---|-----------|--------|
| 1 | Docs say sub-account is default canonical/deploy account | **TRIGGERED** — DRIFT-001 |
| 2 | Docs describe separate agent CSW as canonical 4626 account | NOT triggered — all docs correctly describe roles on CANONICAL_CSW_ADDRESS |
| 3 | Runbooks instruct retired envs as active production paths | NOT triggered — all docs correctly mark XMTP_AGENT_CSW_*, VITE_AGENT_XMTP_ADDRESS, SOLANA_AUTO_POOL as retired |
| 4 | Deploy dry-run docs treat expected 403 creator-token authority mismatch as failure | NOT triggered — smoke-deploy-dry-run.sh correctly treats 403 as PASS |

### DRIFT-001

**Severity**: P0 (canonical account model contradiction)
**Domain**: Account model / wallet execution path
**Docs inspected**:
- `frontend/docs/waitlist-accounts-architecture.md:41` — states "the canonical path is sub-account setup, not direct owner delegation" and "the parent CSW remains the canonical asset-holding account but is not the execution address"
**Implementation inspected**:
- `frontend/server/_lib/wallet/executionTrack.ts:6-9` — "User-initiated frontend execution routes through the parent CSW only" via canonical4337
- `frontend/src/lib/uniswap/walletMode.ts` — executionMode 'canonical' = parent CSW path
- `frontend/src/wallet/canonicalWalletPolicy.ts` — CANONICAL_CSW_ADDRESS = single wallet, multiple roles
**Contradicting docs (correct)**:
- `docs/ACCOUNT_MODEL.md` §2 population table (line 36): "Privy embedded EOA as direct owner of parent CSW (legacy-owner-install); sub-account is flag-gated swap-only fallback"
- `docs/4626-connection-methods.md` warning banner (line 14-20): "sub-accounts are dormant... the default user path is the parent CSW + Privy embedded-owner signer"
- `docs/4626-connection-methods.md` §2 table (line 66): "Execution address: Canonical parent CSW"
- `docs/4626-connection-methods.md` §12 (line 623): "User-initiated frontend execution defaults to the parent CSW via legacy-owner-install / canonical4337"
- `frontend/docs/account-auth-invariants.md` — parent CSW = execution address
- `AGENTS.md` (line 208): "Sponsored swaps use canonical4337 with the parent CSW as ERC-4337 sender"

**Drift**: waitlist-accounts-architecture.md:41 explicitly calls sub-account setup "the canonical path" and states the parent CSW "is not the execution address." This directly contradicts executionTrack.ts which routes user-initiated frontend execution through the parent CSW only, and 5 other docs that confirm parent CSW as the default execution address. A developer following this doc would incorrectly gate frontend execution readiness on sub-account creation rather than parent-CSW embedded-owner confirmation.

**Launch impact**: High — could cause incorrect readiness gating in new waitlist/onboarding code, routing execution through sub-accounts when the production path uses parent CSW + canonical4337.

### DRIFT-002

**Severity**: P1 (same root cause as DRIFT-001, different lines)
**Domain**: Account model / wallet execution path / readiness gating
**Docs inspected**:
- `frontend/docs/waitlist-accounts-architecture.md:43` — "If the user does not yet have a CSW, route them to Base app referral flow, then resume sub-account setup on return."
- `frontend/docs/waitlist-accounts-architecture.md:44` — "Wallet-dependent execution should stay gated until the appropriate track's readiness check succeeds — sub-account persisted + signer configured for the CSW track"
**Implementation inspected**:
- `AGENTS.md` (line 212): "If the user does not yet have a CSW, route them to Base app with the referral flow, then resume embedded-owner signing setup for the canonical parent CSW when they return. Do not make waitlist onboarding explicitly create a sub-account."
- `AGENTS.md` (line 208): readiness = "canonical parent CSW recorded in profiles.csw_address, Privy embedded EOA present in profiles.primary_embedded_eoa, and the embedded EOA confirmed as an owner/signing authority for the parent CSW"

**Drift**: Line 43 says "resume sub-account setup" — AGENTS.md says "resume embedded-owner signing setup for the canonical parent CSW" and explicitly says "Do not make waitlist onboarding explicitly create a sub-account." Line 44 says readiness = "sub-account persisted + signer configured" — AGENTS.md says readiness = parent CSW + embedded EOA owner confirmation. Both lines use the superseded sub-account model.

**Launch impact**: Medium — new waitlist code following this doc would create sub-accounts during onboarding and gate execution on sub-account persistence, contradicting the production parent-CSW path.

### DRIFT-003

**Severity**: P1 (internal contradiction within a single canonical doc)
**Domain**: Account model / wallet execution path
**Docs inspected**:
- `docs/4626-connection-methods.md` §3 (lines 138-169) — describes sub-account as the user-side execution path: "Sub-Account (user-side execution) → Privy embedded EOA (silent, browser) → swaps, vaults, deposits"
- `docs/4626-connection-methods.md` §4 (lines 174-196) — describes "The Batched Ceremony" with sub-account creation as a default onboarding step (passkey popup 1)
- `docs/4626-connection-methods.md` §10 (lines 479-505) — "Sub-account handles user-initiated transactions (swaps, vaults) via the Privy embedded EOA. The sub-account is the execution address and msg.sender on-chain."
- `docs/4626-connection-methods.md` §11 (lines 509-604) — architecture diagram shows "PHASE 1: Sub-Account Creation" as a default onboarding step and "Execution address: sub-account" for the user-side path
- `docs/4626-connection-methods.md` §12 (line 631) — "wallet_addSubAccount creates the sub-account (passkey popup 1) and is the readiness gate for user-initiated frontend execution"
**Contradicting sections in the same doc**:
- Warning banner (lines 14-20): "sub-accounts are dormant... Onboarding does not create a Base sub-account, and deploy never sends from one."
- §2 table (line 66): "Execution address: Canonical parent CSW"
- §12 Execution Path Invariants (line 623-624): "User-initiated frontend execution defaults to the parent CSW via legacy-owner-install / canonical4337... Optional sub-account is flag-gated and swap-only — not the deploy default"

**Drift**: The warning banner was added to the top of the document to indicate the sub-account model is dormant, but the body sections (§3-§12) were not rewritten. §3 still describes sub-account as the user-side execution path. §4 still describes the batched ceremony with sub-account creation as default. §10 still says "the sub-account is the execution address and msg.sender." §11 diagram still shows sub-account creation as PHASE 1 and "Execution address: sub-account." §12 Owner Installation Invariants still says wallet_addSubAccount "is the readiness gate." The document is internally contradictory — the banner and §2/§12 invariants say parent CSW is default, but §3-§11 body text and diagrams say sub-account is default.

**Launch impact**: Medium — a developer reading the body sections (not just the banner) would implement sub-account-based execution, contradicting the production parent-CSW path.

### DRIFT-004

**Severity**: P1 (canonical reference doc recommends superseded path)
**Domain**: Account model / owner-mutation decision
**Docs inspected**:
- `docs/ACCOUNT_MODEL.md` §5.2 (lines 220-222) — "Decision. Drop 'add owner to a Base App-managed CSW' as a product flow. Use Sub Accounts + Spend Permissions for population (b)."
- `docs/owner-mutation-decision-2026-05.md` (lines 9-13) — same recommendation: "Use Sub Accounts + Spend Permissions for that population"
**Implementation inspected**:
- `docs/ACCOUNT_MODEL.md` §2 population table (line 36) — for population (b): "Frontend: Privy embedded EOA as direct owner of parent CSW (legacy-owner-install); sub-account via setToOwnerAccount() is flag-gated swap-only fallback"
- `frontend/server/_lib/wallet/executionTrack.ts:6-9` — parent CSW only for user-initiated execution
- `AGENTS.md` (line 186): "Base sub-account = optional app-scoped execution lane; keep hidden unless a route is actively using it (flag-gated swap-only fallback, not deploy)"

**Drift**: §5.2 recommends "Use Sub Accounts + Spend Permissions for population (b)" as the solution to the blocked owner-mutation path. However, the actual solution shipped was `legacy-owner-install` — installing the Privy embedded EOA as a direct owner of the parent CSW, making the parent CSW the execution address via canonical4337. Sub-accounts became the flag-gated fallback, not the recommended path. §5.2 was not updated when the model shifted. The §2 population table in the same document correctly describes the current model, creating an internal contradiction.

Note: The "drop addOwnerAddress from third-party dapp" part of the §5.2 decision is still valid. Only the "Use Sub Accounts + Spend Permissions" recommendation is superseded.

**Launch impact**: Medium — a developer reading §5.2 would design sub-account-based flows for Base App users instead of the legacy-owner-install path that is actually in production.

### DRIFT-005

**Severity**: P2 (stale file paths in canonical reference doc)
**Domain**: File path drift / developer guidance
**Docs inspected**:
- `docs/4626-connection-methods.md` §5 (line 214) — references `onboardingWallet.ts` (lines 464-478)
- `docs/4626-connection-methods.md` §5 (line 234) — references `onboardingWallet.ts` fallback chain
- `docs/4626-connection-methods.md` §9 (line 473) — references `frontend/api/_handlers/deploy/session/_create.ts`
- `docs/4626-connection-methods.md` §13 (line 690) — references `frontend/src/lib/wallet/onboardingWallet.ts`
- `docs/4626-connection-methods.md` §13 (line 696) — references `frontend/server/_lib/privyXmtpSigner.ts`
- `docs/4626-connection-methods.md` §13 (line 697) — references `frontend/server/_lib/agentRegistration.ts`
- `docs/4626-connection-methods.md` §13 (line 698) — references `frontend/api/_handlers/deploy/session/_create.ts`
**Actual file locations** (verified via filesystem):
- `onboardingWallet.ts` → does NOT exist. Split into: `frontend/src/lib/wallet/onboardingWalletDelegation.ts`, `onboardingWalletPrepared.ts`, `onboardingWalletReplayable.ts`
- `deploy/session/_create.ts` → actual: `frontend/api/_handlers/deploy/v2/session/_create.ts`
- `privyXmtpSigner.ts` → actual: `frontend/server/_lib/wallet/privyXmtpSigner.ts`
- `agentRegistration.ts` → actual: `frontend/server/_lib/agent/agentRegistration.ts`

**Drift**: 4 file paths in 4626-connection-methods.md are stale due to file reorganization (directory moves and file splits). A developer following these paths would not find the referenced files.

**Launch impact**: Low — developer friction, not a production issue. But the onboardingWallet.ts split means the line-number references (464-478, 812-916) are also invalid.

### DRIFT-006

**Severity**: P2 (stale file paths in operations runbook)
**Domain**: File path drift / operator guidance
**Docs inspected**:
- `docs/operations/telegram-canonical-link-preservation.md` line 45 — references `frontend/src/lib/telegramMiniAppLink.ts`
- `docs/operations/telegram-canonical-link-preservation.md` line 67 — references `frontend/src/lib/telegramWebApp.ts`
- `docs/operations/telegram-canonical-link-preservation.md` line 110 — references `frontend/server/_lib/accountsIdentity.ts`
- `docs/operations/telegram-canonical-link-preservation.md` line 156 — references `frontend/server/_lib/accountsIdentity.ts`
- `docs/operations/telegram-canonical-link-preservation.md` line 157 — references `frontend/server/_lib/walletSync.ts`
- `docs/operations/telegram-canonical-link-preservation.md` line 158 — references `frontend/server/_lib/telegramTrading.ts`
**Actual file locations** (verified via filesystem):
- `telegramMiniAppLink.ts` → actual: `frontend/src/lib/telegram/telegramMiniAppLink.ts`
- `telegramWebApp.ts` → actual: `frontend/src/lib/telegram/telegramWebApp.ts`
- `accountsIdentity.ts` → actual: `frontend/server/_lib/identity/accountsIdentity.ts`
- `walletSync.ts` → actual: `frontend/server/_lib/wallet/walletSync.ts`
- `telegramTrading.ts` → actual: `frontend/server/_lib/messaging/telegramTrading.ts`

**Drift**: 5 file paths in telegram-canonical-link-preservation.md are stale due to directory reorganization (files moved into subdirectories). All 5 files exist at their new locations.

**Launch impact**: Low — operator/developer friction when trying to locate files during Telegram link flow debugging.

### DRIFT-007

**Severity**: P2 (stale file path in frontend architecture doc)
**Domain**: File path drift / developer guidance
**Docs inspected**:
- `frontend/docs/waitlist-accounts-architecture.md:65` — references `frontend/src/features/waitlist/WaitlistSetupWorkspace.tsx` as a file new product work should build on
**Actual file location** (verified via filesystem):
- `WaitlistSetupWorkspace.tsx` → does NOT exist in `frontend/src/features/waitlist/`. The directory contains: `WaitlistFlow.tsx`, `WaitlistConnectBaseApp.tsx`, `LaunchCoinCard.tsx`, `LeaderboardAccountBadge.tsx`, `LeaderboardIdentityCell.tsx`, `SubAccountOwnerInstallPanel.tsx`, `SubAccountOwnerInstallRecovery.tsx`, `WaitlistBaseAppWalletNudge.tsx`, `leaderboardUi.tsx`

**Drift**: WaitlistSetupWorkspace.tsx was removed or renamed during a refactoring pass. The doc's "Legacy note" section says "The older heavy waitlist flow and its private step/hook files were removed after the thin waitlist convergence pass" — but then lists WaitlistSetupWorkspace.tsx as a file to build on, contradicting its own removal note.

**Launch impact**: Low — developer friction. A developer would search for a file that no longer exists.

### Drift Audit Summary

| ID | Severity | Domain | Drift type |
|----|----------|--------|------------|
| DRIFT-001 | P0 | Account model / execution path | Doc says sub-account = canonical path; implementation says parent CSW |
| DRIFT-002 | P1 | Account model / readiness gating | Doc says "resume sub-account setup" + gate on sub-account; AGENTS.md says "resume embedded-owner setup" + gate on parent CSW owner |
| DRIFT-003 | P1 | Account model / execution path | 4626-connection-methods.md body (§3-§11) describes sub-account as default; own banner + §2/§12 say parent CSW |
| DRIFT-004 | P1 | Account model / owner-mutation | ACCOUNT_MODEL.md §5.2 recommends sub-accounts; superseded by legacy-owner-install on parent CSW |
| DRIFT-005 | P2 | File path drift | 4626-connection-methods.md: 4 stale paths (onboardingWallet.ts split, deploy/session → deploy/v2/session, privyXmtpSigner.ts, agentRegistration.ts) |
| DRIFT-006 | P2 | File path drift | telegram-canonical-link-preservation.md: 5 stale paths (files moved into subdirectories) |
| DRIFT-007 | P2 | File path drift | waitlist-accounts-architecture.md: WaitlistSetupWorkspace.tsx removed |

### P0 Stop Condition #1 — Confirmed

DRIFT-001 matches P0 stop condition #1: "docs say sub-account is default canonical/deploy account." The finding is confirmed at `frontend/docs/waitlist-accounts-architecture.md:41`. The implementation (`executionTrack.ts:6-9`) and 5 other docs confirm parent CSW is the default execution address. Per audit-only constraint, no fixes applied.

### No code changes applied (audit-only)

This drift audit is audit-only. No documentation or code fixes were applied. All findings are recorded for the maintainer to triage and fix.

---

## Launch Readiness + Deploy Dry-Run Smoke Audit

Audit conducted 2026-06-26. Scope: verify-akita-prelaunch --production behavior, deploy dry-run smoke behavior, expected 403 creator-token authority mismatch, legacy dev-bypass headers, deploy status/preflight read-only behavior, contract/deploy smoke invariants, production vs localhost false blockers. Audit-only — no product/code fixes applied.

### P0 Stop Condition Assessment

| # | Condition | Result |
|---|-----------|--------|
| 1 | Production launch-readiness probe shows real non-local blockers | **TRIGGERED** — LAUNCH-001 |
| 2 | Deploy dry-run accepts legacy bypass headers | NOT triggered — LAUNCH-005 confirms rejection |
| 3 | Deploy status/preflight mutates chain, DB, or infrastructure | NOT triggered — LAUNCH-006 confirms read-only |
| 4 | Dry-run smoke expected 403 behavior is missing or misclassified | NOT triggered — LAUNCH-004 confirms correct 403 PASS |

### LAUNCH-001

**Severity**: P0 (production launch-readiness probe — real non-local blockers)
**Domain**: Vultr orchestrator + provisioner infrastructure / DNS routing
**Command**: `pnpm -C frontend ops:verify-akita-prelaunch --production`
**Exit code**: 1 (ELIFECYCLE Command failed)

**Passing gates (8/15)**:
- Platform: pipe_a_batcher, release_target_guard, hook_mainnet_canonical, vitest_pipe_a_wiring (53 tests), forge_share_oft_peer (6 tests) — ALL PASS
- Vercel: vercel_solana_infra_status (readyForAutoRegistration=true, blockers=[]) — PASS
- Solana: kpr_preflight_share_mesh_deferral — PASS (expected deferral)
- DB: strategy_entitlement (ajna_sleeve, charm_active_lp, solana_bridge_strategy, solana_ovault_mesh), strategy_solana_mesh — ALL PASS

**Failing gates (7/15)** — all Vultr/Vercel external infrastructure:
- vultr_orchestrator_health: HTTP 200 but body is Vercel SPA HTML, not JSON `{ok: true}`
- vultr_orchestrator_settle_fees: HTTP 405 (SPA doesn't accept POST /reconcile)
- vultr_orchestrator_winner_relay: HTTP 405 (same root cause)
- vultr_relay_entries_paused: Expected 503 action_disabled:relay_entries, got 405 (same root cause)
- vultr_provisioner_health: payerHealthy=undefined (provisioner returns SPA HTML)
- vultr_provisioner_dns: "Provisioner may be pointing at Vercel SPA — fix DNS A-record to Vultr host"
- vercel_solana_reconcile_chain: HTTP 200 with success:true but status≠completed/executed≠true (upstream orchestrator returns 405)

**Root cause**: Both `orchestrator.4626.fun` and `provisioner.4626.fun` are returning Vercel SPA HTML (`<div id="root"></div>`) instead of service JSON. Verified by direct curl:
- `curl https://orchestrator.4626.fun/healthz` → 200 + HTML SPA body
- `curl https://provisioner.4626.fun/healthz` → 200 + HTML SPA body

Both domains' DNS A-records are pointing at Vercel, not the Vultr hosts where the actual orchestrator and provisioner services run. The 405 errors on POST /reconcile occur because the Vercel SPA doesn't accept POST requests.

**Impact**: The Solana bridge orchestrator and route provisioner are not accessible via their public HTTPS URLs. The prelaunch probe cannot verify the full bridge chain. This is a real non-local blocker — not a localhost false blocker (confirmed: `--production` flag was used, `VITE_APP_ORIGIN` not consulted for Vultr checks).

**Classification**: External infrastructure/DNS issue. The 4626 repo code is correct — the prelaunch script correctly probes the expected URLs and correctly reports the blockers. The fix is DNS A-record configuration on the Vultr/Vercel side, not a code change.

**Launch impact**: Blocks launch until DNS is fixed. The platform contracts, tests, Vercel infra status, and creator entitlements are all ready. Only the Vultr orchestrator/provisioner bridge is inaccessible.

### LAUNCH-002

**Severity**: P2 (informational — prelaunch script not strictly read-only)
**Domain**: Prelaunch script behavior / keeper control-plane
**Files inspected**:
- `frontend/scripts/ops/verify-akita-prelaunch-readiness.ts:162-223` — sends POST to orchestrator with `action: 'settle_fees'`, `action: 'winner_relay'`, `action: 'relay_entries'`
- `frontend/scripts/ops/verify-akita-prelaunch-readiness.ts:268-282` — sends POST to `/api/keeper/solana/reconcile` with `action: 'settle_fees'`
- `frontend/api/_handlers/keeper/_solanaReconcile.ts:239-312` — calls upstream orchestrator, writes `INSERT INTO keepr_workflow_checkpoints ... ON CONFLICT DO UPDATE`

**Observation**: The prelaunch script header says "read-only by default" but it triggers:
1. DB writes: The keeper reconcile endpoint writes to `keepr_workflow_checkpoints` (INSERT/UPDATE) to track workflow execution state.
2. Upstream orchestrator actions: `settle_fees` and `winner_relay` are sent to the orchestrator. The endpoint returns `executed: true` when the upstream call succeeds, indicating the action was performed (not just checked).

**Context**: These are keeper operations (Solana↔Base bridge fee settlement, winner relay), not deploy mutations. The endpoint is idempotent (checkpoint-based — if already processed, returns `already_processed` without re-executing). The `relay_entries` action is correctly disabled during prelaunch (expected 503 `action_disabled:relay_entries`). The script exercises the bridge to verify it's working, which is closer to "gather config and report readiness" than "perform onchain mutation as a side effect."

**Assessment**: Not a P0 stop condition. The deploy status/preflight endpoints themselves (`_status.ts`, `_solanaInfraStatus.ts`) are confirmed read-only (see LAUNCH-006). The prelaunch script's bridge exercise is a keeper control-plane operation, not a deploy mutation. However, the "read-only by default" header is slightly misleading — the script does write to the DB and trigger upstream actions when the bridge is accessible.

**Launch impact**: Low — informational. The DB writes are checkpoint records (not deploy state). The orchestrator actions are normal keeper operations. No deploy state is mutated.

### LAUNCH-003

**Severity**: P2 (local env file issue — blocked prerequisite)
**Domain**: Local development environment / .env file
**File**: `frontend/.env:504` — bare `ALFACLUB` line (no `=` sign)

**Observation**: Line 504 of `frontend/.env` contains `ALFACLUB` without an `=` sign. When `dev-deploy-dry-run.sh` sources the .env file, the shell interprets `ALFACLUB` as a command, producing `ALFACLUB: command not found` and causing the script to exit with error.

**Fix applied (local only)**: Commented out the bare line: `# ALFACLUB (bare line removed — was causing shell syntax error in dev:deploy-dry-run)`. This is a local env file fix, not a product/code fix. The .env file is not committed to git.

**Launch impact**: None — local development issue only. Does not affect production.

### LAUNCH-004

**Severity**: Positive finding (no drift — expected behavior confirmed)
**Domain**: Deploy dry-run smoke / 403 PASS gate
**Command**: `pnpm -C frontend smoke:deploy-dry-run`
**Exit code**: 0 (PASS)

**Output**:
```
HTTP 403
{
  "success": false,
  "error": "Creator token authority mismatch: active session or canonical smart wallet must control the creator token."
}
PASS: Dry-run handler reached creator-token authority check (auth + DB + fork plumbing OK).
```

**Verification**: The 403 "Creator token authority mismatch" is the expected PASS gate. The placeholder creator token (`0x…0003`) has no on-chain authority on the fork, so the handler correctly stops at the creator-token authority check. Reaching this 403 proves the full plumbing chain: server up → DB configured → auth passed → rate-limit passed → body parsed → fork RPC resolved → creator-authority validation reached.

**Source trace**: The 403 is thrown by `assertCreatorTokenAuthority` (`_createCore.ts:2386-2411`) via `validateDeploySessionRequest` (`_createCore.ts:2593`), called from `_dryRunCore.ts:2113`. The catch block at `_dryRunCore.ts:2660-2662` returns `res.status(error.status).json({ success: false, error: error.message })` — correctly returning HTTP 403 with the error message. The smoke script's grep matches "Creator token authority mismatch" and treats it as PASS.

**Launch impact**: None — this is the expected PASS behavior. Stop condition #4 NOT triggered.

### LAUNCH-005

**Severity**: Positive finding (no drift — bypass surface removed)
**Domain**: Deploy dry-run auth / legacy dev-bypass header
**Command**: `curl` with `x-deploy-dry-run-dev` header (no session token)
**Result**: HTTP 401 "Not authenticated"

**Verification**: The legacy `X-Deploy-Dry-Run-Dev` bypass header is fully rejected. The dry-run handler (`_dryRunCore.ts:2090`) calls `readDeployAuthFromRequest(req)` which only accepts:
1. Session cookie/bearer token via `readSessionFromRequest`
2. SIWA agent receipt via `readSiwaAgentFromRequest`

No bypass header path exists in production code. The only references to `x-deploy-dry-run-dev` are:
- `deploySessionDryRun.test.ts:465` — test that locks in the rejection ("requires authenticated deploy auth even when legacy dev-bypass header is present")
- Comments in `mint-dev-session-token.mjs` and `smoke-deploy-dry-run.sh` explaining the removal

The smoke script authenticates via a real session token minted from `AUTH_SESSION_SECRET` using the same HMAC-SHA256 format as `makeSessionToken` in `server/auth/_shared.ts`.

**Launch impact**: None — security invariant intact. Stop condition #2 NOT triggered.

### LAUNCH-006

**Severity**: Positive finding (no drift — read-only confirmed)
**Domain**: Deploy status/preflight read-only invariant
**Files inspected**:
- `frontend/api/_handlers/deploy/v2/session/_status.ts` — only imports `getDeploySessionById` (DB read). No `transitionDeploySession`, `updateDeploySession`, `sendUserOperation`, or `sendTransaction` calls.
- `frontend/api/_handlers/deploy/_solanaInfraStatus.ts` — uses `createPublicClient` (read-only) with view-only ABI (`stateMutability: 'view'`). Probes provisioner health via HTTP GET. No mutation calls.
- `frontend/api/_handlers/deploy/v2/session/_statusCore.ts` — DOES contain mutations (`transitionDeploySession`, `updateDeploySession`, `sendUserOperation`) but is imported by `_resume.ts` (execution path), NOT by `_status.ts` (status path).

**Verification**: The deploy status endpoint (`_status.ts`) is strictly read-only. The preflight endpoint (`_solanaInfraStatus.ts`) is strictly read-only. The execution path (`_resume.ts` → `_statusCore.ts`) is correctly separated and requires its own auth + execution context.

**Launch impact**: None — read-only invariant intact. Stop condition #3 NOT triggered for deploy endpoints. (See LAUNCH-002 for the prelaunch script's keeper bridge exercise, which is a separate concern.)

### LAUNCH-007

**Severity**: Positive finding (no drift — local-fork-only invariant confirmed)
**Domain**: Deploy dry-run handler / mainnet safety
**File**: `frontend/api/_handlers/deploy/v2/session/_dryRunCore.ts:2122-2124`

**Verification**: The dry-run handler explicitly rejects non-local-fork RPC URLs:
```typescript
if (!isLocalFork) {
  throw new DeploySessionRequestError(400, LOCAL_FORK_ONLY_ERROR)
}
```

All `sendTransaction` calls (line 1916) and fork manipulation calls (`anvil_reset`, `anvil_impersonateAccount`, `anvil_snapshot`) go to the local Anvil fork only. No mainnet mutation is possible via the dry-run endpoint.

**Launch impact**: None — mainnet safety invariant intact.

### LAUNCH-008

**Severity**: Positive finding (supplementary gates clean)
**Domain**: Typecheck + lint
**Commands**:
- `pnpm -C frontend typecheck` → exit 0 (tsc --noEmit -p tsconfig.app.json && tsc --noEmit -p tsconfig.node.json)
- `pnpm -C frontend lint` → exit 0 (eslint . --ext ts,tsx --max-warnings 0)

**Launch impact**: None — code quality gates clean.

### Launch Audit Summary

| ID | Severity | Domain | Finding |
|----|----------|--------|---------|
| LAUNCH-001 | P0 | Vultr orchestrator + provisioner DNS | 7 prelaunch blockers — orchestrator.4626.fun and provisioner.4626.fun return Vercel SPA HTML; DNS A-records point at Vercel not Vultr; POST /reconcile returns 405 |
| LAUNCH-002 | P2 | Prelaunch script read-only behavior | Script triggers DB writes (keepr_workflow_checkpoints) + orchestrator actions (settle_fees, winner_relay) via keeper reconcile; not strictly read-only but these are keeper operations, not deploy mutations |
| LAUNCH-003 | P2 | Local .env file | Bare `ALFACLUB` line at .env:504 blocks dev:deploy-dry-run; fixed locally |
| LAUNCH-004 | Positive | Dry-run smoke 403 PASS gate | Confirmed: HTTP 403 "Creator token authority mismatch" correctly returned and treated as PASS |
| LAUNCH-005 | Positive | Legacy dev-bypass header | Confirmed: `x-deploy-dry-run-dev` header rejected (401); no bypass surface in production code |
| LAUNCH-006 | Positive | Deploy status/preflight read-only | Confirmed: _status.ts and _solanaInfraStatus.ts are read-only; _statusCore.ts mutations are in _resume.ts execution path only |
| LAUNCH-007 | Positive | Dry-run local-fork-only | Confirmed: _dryRunCore.ts:2122 rejects non-local-fork RPC; all sendTransaction calls go to Anvil fork only |
| LAUNCH-008 | Positive | Typecheck + lint | Both exit 0 — clean |

### P0 Stop Condition #1 — Confirmed

LAUNCH-001 matches P0 stop condition #1: "production launch-readiness probe shows real non-local blockers." The `--production` flag was used (not a localhost false blocker). 7 of 15 gates fail, all tracing to Vultr orchestrator/provisioner DNS pointing at Vercel SPA. Platform contracts, tests, Vercel infra status, Solana share mesh, and creator entitlements all PASS. Per audit-only constraint, no fixes applied.

### No code changes applied (audit-only)

This launch readiness audit is audit-only. No product/code fixes were applied. The local .env fix (LAUNCH-003) was a local env file correction to unblock the dry-run smoke, not a product code change. All findings are recorded for the maintainer to triage.

---

## Current P0/P1 Launch Decisions

Consolidated 2026-06-26. All P0 and P1 findings from the deep-risk-audit-2026-06 audit cycle. Audit-only — no product/code fixes applied. LAUNCH-003 (local .env precondition) included as a note because the user asked to verify its git impact.

### Classification summary

| Finding ID | Current severity | Launch decision | Owner | Audit can continue before remediation? |
|------------|-----------------|-----------------|-------|---------------------------------------|
| DRIFT-001 | P0 | fix before launch | docs | Yes — broader audit may continue; launch docs must be corrected before release |
| DRIFT-002 | P1 | fix before launch | docs | Yes — broader audit may continue; launch docs must be corrected before release |
| DRIFT-003 | P1 | fix before launch | docs | Yes — broader audit may continue; launch docs must be corrected before release |
| DRIFT-004 | P1 | fix before launch | docs | Yes — broader audit may continue; launch docs must be corrected before release |
| LAUNCH-001 | P0 | block launch | external DNS/infra | Yes — audit may continue; launch is blocked until DNS is corrected |

Note: LAUNCH-003 (P2, local .env bare ALFACLUB line) is not a P0/P1 blocker. Verified: `frontend/.env` is gitignored (`git check-ignore frontend/.env` confirms). The local fix created no dirty tracked file — 0 unstaged, 0 staged changes after the fix. It is a local development precondition only, no production impact.

### DRIFT-001

- **Finding ID**: DRIFT-001
- **Current severity**: P0 (canonical account model contradiction)
- **Launch decision**: fix before launch
- **Owner**: docs
- **Classification**: docs-only — implementation is correct, the doc is wrong
- **What's wrong**: `frontend/docs/waitlist-accounts-architecture.md:41` states "the canonical path is sub-account setup, not direct owner delegation" and "the parent CSW remains the canonical asset-holding account but is not the execution address." This contradicts `frontend/server/_lib/wallet/executionTrack.ts:6-9` which routes user-initiated frontend execution through the parent CSW only via canonical4337, and 5 other docs that confirm parent CSW as the default execution address.
- **Exact unblock condition**: Correct `frontend/docs/waitlist-accounts-architecture.md:41` to state that the canonical path is parent CSW + embedded-owner signing (legacy-owner-install / canonical4337), not sub-account setup. Remove or qualify the claim that the parent CSW "is not the execution address."
- **Exact validation command after remediation**: `grep -n 'canonical path is sub-account\|parent CSW.*not the execution address' frontend/docs/waitlist-accounts-architecture.md` — must return 0 matches after fix.
- **Broader audit can continue before remediation**: Yes. This is a docs-only drift; the implementation is correct. Broader audit work is not blocked. Launch docs must be corrected before release.

### DRIFT-002

- **Finding ID**: DRIFT-002
- **Current severity**: P1 (same root cause as DRIFT-001, different lines)
- **Launch decision**: fix before launch
- **Owner**: docs
- **Classification**: docs-only — implementation is correct, the doc is wrong
- **What's wrong**: `frontend/docs/waitlist-accounts-architecture.md:43` says "resume sub-account setup" — AGENTS.md says "resume embedded-owner signing setup for the canonical parent CSW" and "Do not make waitlist onboarding explicitly create a sub-account." Line 44 says readiness = "sub-account persisted + signer configured" — AGENTS.md says readiness = parent CSW + embedded EOA owner confirmation.
- **Exact unblock condition**: Correct lines 43-44 to say "resume embedded-owner signing setup for the canonical parent CSW" and gate readiness on "parent CSW recorded + embedded EOA confirmed as owner/signing authority."
- **Exact validation command after remediation**: `grep -n 'resume sub-account setup\|sub-account persisted.*signer configured' frontend/docs/waitlist-accounts-architecture.md` — must return 0 matches after fix.
- **Broader audit can continue before remediation**: Yes. Same docs-only root cause as DRIFT-001.

### DRIFT-003

- **Finding ID**: DRIFT-003
- **Current severity**: P1 (internal contradiction within a single canonical doc)
- **Launch decision**: fix before launch
- **Owner**: docs
- **Classification**: docs-only — internal contradiction within `docs/4626-connection-methods.md`
- **What's wrong**: The warning banner (lines 14-20) says "sub-accounts are dormant... Onboarding does not create a Base sub-account, and deploy never sends from one." But the body §3-§11 still describe sub-account as the default user execution path, with diagrams showing "Execution address: sub-account" and "PHASE 1: Sub-Account Creation" as a default onboarding step.
- **Exact unblock condition**: Update §3, §4, §10, §11, and §12 of `docs/4626-connection-methods.md` to align with the warning banner — describe parent CSW + embedded-owner signing as the default user execution path, and mark sub-account as flag-gated swap-only fallback. Remove or qualify "Execution address: sub-account" and "PHASE 1: Sub-Account Creation" as default.
- **Exact validation command after remediation**: `grep -n 'Execution address: sub-account\|PHASE 1: Sub-Account Creation\|wallet_addSubAccount.*readiness gate' docs/4626-connection-methods.md` — must return 0 unqualified matches after fix.
- **Broader audit can continue before remediation**: Yes. Docs-only internal contradiction.

### DRIFT-004

- **Finding ID**: DRIFT-004
- **Current severity**: P1 (canonical reference doc recommends superseded path)
- **Launch decision**: fix before launch
- **Owner**: docs
- **Classification**: docs-only — the §5.2 recommendation is superseded; §2 of the same doc is correct
- **What's wrong**: `docs/ACCOUNT_MODEL.md` §5.2 (lines 220-222) recommends "Use Sub Accounts + Spend Permissions for population (b)." The actual solution shipped was `legacy-owner-install` — Privy embedded EOA as direct owner of parent CSW. Sub-accounts became flag-gated fallback, not the recommended path. §5.2 was not updated when the model shifted. The §2 population table in the same document correctly describes the current model, creating an internal contradiction. Same issue in `docs/owner-mutation-decision-2026-05.md` lines 9-13.
- **Exact unblock condition**: Update `docs/ACCOUNT_MODEL.md` §5.2 to reflect the shipped legacy-owner-install solution as the decision for population (b), and mark the "Use Sub Accounts + Spend Permissions" recommendation as superseded. Update `docs/owner-mutation-decision-2026-05.md` lines 9-13 to match. The "drop addOwnerAddress from third-party dapp" part of §5.2 remains valid and should be preserved.
- **Exact validation command after remediation**: `grep -n 'Use Sub Accounts + Spend Permissions for population' docs/ACCOUNT_MODEL.md docs/owner-mutation-decision-2026-05.md` — must return 0 unqualified matches after fix (or matches must be clearly marked as superseded).
- **Broader audit can continue before remediation**: Yes. Docs-only; implementation is correct.

### LAUNCH-001

- **Finding ID**: LAUNCH-001
- **Current severity**: P0 (production launch-readiness probe — real non-local blockers)
- **Launch decision**: block launch
- **Owner**: external DNS/infra
- **Classification**: external DNS/infra — the 4626 repo code is correct; the prelaunch script correctly probes and reports the blockers. The fix is DNS A-record configuration, not a code change.
- **What's wrong**: `orchestrator.4626.fun` and `provisioner.4626.fun` DNS A-records point at Vercel, not the Vultr hosts where the actual orchestrator and provisioner services run. Both domains return Vercel SPA HTML (`<div id="root"></div>`) instead of service JSON. POST /reconcile returns 405 because the Vercel SPA doesn't accept POST. 7 of 15 prelaunch gates fail, all tracing to this root cause.
- **Passing gates (not blocked)**: Platform contracts (pipe_a_batcher, release_target_guard, hook_mainnet_canonical, 53 vitest tests, 6 forge tests), Vercel infra status (readyForAutoRegistration=true, blockers=[]), Solana share mesh deferral, creator entitlements (ajna_sleeve, charm_active_lp, solana_bridge_strategy, solana_ovault_mesh) — ALL PASS.
- **Exact unblock condition**: Correct DNS A-records for `orchestrator.4626.fun` and `provisioner.4626.fun` to point at the Vultr hosts where the orchestrator and provisioner services run (not Vercel). Verify `curl https://orchestrator.4626.fun/healthz` returns JSON `{ok: true}` and `curl https://provisioner.4626.fun/healthz` returns JSON with `payerHealthy: true`.
- **Exact validation command after remediation**: `pnpm -C frontend ops:verify-akita-prelaunch --production` — must exit 0 with 0 blockers.
- **Broader audit can continue before remediation**: Yes. This is an external infrastructure issue, not a repo code issue. Audit work on the repo is not blocked. Launch is blocked until DNS is corrected.

### LAUNCH-003 note (P2 — local precondition, not a P0/P1 blocker)

- **Finding ID**: LAUNCH-003
- **Current severity**: P2 (local env file issue)
- **Launch decision**: accepted risk (local dev only)
- **Owner**: N/A (local env)
- **Git impact verified**: `git check-ignore frontend/.env` confirms the file is gitignored. After the local fix (commenting out bare `ALFACLUB` line at .env:504), `git diff --name-only` shows 0 unstaged changes and `git diff --cached --name-only` shows 0 staged changes. No dirty tracked file was created. The fix is a local precondition for running `dev:deploy-dry-run` only.
- **Broader audit can continue**: Yes. No production impact, no git impact.

### Cross-finding notes

1. **DRIFT-001 through DRIFT-004 share a common root cause**: the sub-account execution model was superseded by the parent-CSW legacy-owner-install model, but 4 docs (waitlist-accounts-architecture.md, 4626-connection-methods.md body sections, ACCOUNT_MODEL.md §5.2, owner-mutation-decision-2026-05.md) were not updated. All 4 are docs-only — the implementation correctly uses parent CSW + canonical4337. They can be fixed in a single docs sweep.

2. **LAUNCH-001 is independent of DRIFT-001–004**: the DNS issue is external infrastructure, unrelated to the docs drift. Both must be resolved before launch, but they can be remediated in parallel by different owners (docs team vs ops/infra team).

3. **No P0/P1 findings in APIAUTH, WALLET, or RACE namespaces**: all APIAUTH findings (001–019) are Medium/Low/Low-Medium/Very Low. All WALLET findings (001–004) are Low. All RACE findings (001–004) are below P1. These do not appear in this consolidation.

4. **All positive LAUNCH findings (004–008) confirmed no drift**: dry-run 403 PASS gate, legacy bypass header rejection, read-only status/preflight, local-fork-only invariant, typecheck + lint clean. These are not blockers.

---

## Backtest Feature Deep Audit

Audited 2026-06-26. Audit-only — no product/code fixes applied. All source files read, unit tests run, CLI backtests executed and artifacts verified.

### Scope

Files deep-inspected:
- `frontend/api/_handlers/v1/alfaclub/_backtest-run.ts` (220 lines) — POST compute-heavy backtest API
- `frontend/api/_handlers/v1/alfaclub/_backtest-sweep.ts` (161 lines) — GET sweep CSV listing
- `frontend/api/_handlers/v1/alfaclub/_backtest-series.ts` (GET series JSON)
- `frontend/api/_handlers/v1/alfaclub/_backtest-audit.ts` (GET rebalance audit CSV)
- `frontend/api/_handlers/v1/alfaclub/_backtest-markets.ts` (GET available markets)
- `frontend/server/_lib/alfaclub/backtestCounterRebalance.ts` (~880 lines) — core simulation engine
- `frontend/server/_lib/alfaclub/backtestIntervalPolicy.ts` (55 lines) — interval selection + coverage thresholds
- `frontend/server/_lib/alfaclub/backtestMarketBars.ts` (~270 lines) — bar loader with degradation fallback
- `frontend/server/_lib/alfaclub/backtestSeriesDownsample.ts` (26 lines) — series point downsampling
- `frontend/server/_lib/alfaclub/bybitKlines.ts` (~200 lines) — Bybit kline fetcher
- `frontend/server/_lib/alfaclub/binanceKlines.ts` (154 lines) — Binance kline fetcher
- `frontend/scripts/backtest-counter-rebalance.ts` — CLI entry point
- `frontend/scripts/cache-backtest-minute-bars.ts` — 1m cache backfill script
- `frontend/server/agents/eliza/plugins/virtuals/backtestJobs.ts` — Eliza chat backtest job runner
- `frontend/server/agents/eliza/plugins/virtuals/service.ts` — chat entry point (lines 220–277)
- `frontend/server/agents/eliza/plugins/virtuals/paymentGate.ts` — payment gate for ACP backtests
- `frontend/src/pages/Arena.tsx` (lines 60–79, 880–1040) — Arena UI payload + interval display
- `frontend/src/components/arena/ArenaBacktestAnalysis.tsx` (lines 140–195) — series analysis UI

### P0 stop condition check

All 4 P0 stop conditions checked and cleared:

1. **Anonymous callers can trigger compute-heavy backtest API**: NOT triggered. `_backtest-run.ts:94-100` requires `verifyPrivyForAccounts(req)` — unauthenticated callers get 401 "Privy authentication required" before any compute. Rate limit (5/min per privyUserId + IP) at line 102-110. Anonymous access is blocked. No P0.

2. **90-day minute cache misses silently present as minute-fidelity results**: NOT triggered. `backtestIntervalPolicy.ts:8` returns `'1m'` only when `windowHours <= 24*90` (2160). `backtestMarketBars.ts` resolves actual bars from Supabase cache; if coverage falls below `minCoverageRatio` (92% for 1m at 30+ days, 85% for shorter 1m), the interval degrades to `'5m'` / `'15m'` / `'1h'` and the resolved interval is surfaced in the API response (`_backtest-run.ts:171` `resolvedInterval`) and the Arena UI (`Arena.tsx:1026-1035` `setLastResolvedInterval`). The 90-day CLI test confirmed: `source=supabese coverage=95.3%` with `interval=1m` — honest. If the cache were incomplete, the interval would degrade and be reported. No P0.

3. **No-commingle invariant is violated**: NOT triggered. The rebalance audit CSV (`-rebalances.csv`) has a `noCrossLegTransfer` column. Every rebalance row in both the 24h and 90-day test runs has `noCrossLegTransfer=true`. The sweep CSV `commingleViolationCount` column is 0 in all 135 parameter rows for both runs. The `requireNoCommingle` flag defaults to `true` (`_backtest-run.ts:139`) and is passed through to the engine. No P0.

4. **Generated artifacts are empty or series has zero points without explicit expected reason**: NOT triggered. All 6 artifacts (3 per run) are non-empty: sweep CSVs have 136 lines (135 data rows + header), rebalance CSVs have 490/412 lines, series JSON has 1440/123448 data points. The series JSON includes `dataQuality.source`, `dataQuality.barCount`, `dataQuality.coveragePct`, and `summary` fields. No empty artifacts. No P0.

### Findings

#### BACKTEST-001 — Backtest GET endpoints (sweep, series, audit, markets) are unauthenticated

- **Severity**: P2 (Low-Medium)
- **Component**: `frontend/api/_handlers/v1/alfaclub/_backtest-sweep.ts`, `_backtest-series.ts`, `_backtest-audit.ts`, `_backtest-markets.ts`
- **Description**: The 4 GET backtest endpoints have IP-only rate limits (`smartWalletOwnerRead` / `creatorQuickstart`) but no auth gate. Any caller can list sweep CSVs, read series JSON, read rebalance audit CSVs, and fetch available markets. The data exposed is simulation output (not user PII or secrets), and the sweep handler uses `path.basename()` validation (line 78-83) to prevent path traversal. However, the sweep/series/audit endpoints read from the server filesystem (`tmp/backtests/`), and the markets endpoint makes an external API call (Hyperliquid). An anonymous caller can enumerate and read all backtest results.
- **Classification**: This is already documented as APIAUTH-016 in the endpoint matrix (PASS — rate limit gap). Not a new finding; confirmed consistent.
- **Recommendation**: Consider adding session auth for sweep/series/audit if backtest results should be operator-scoped. Markets endpoint is low-risk (public market data).

#### BACKTEST-002 — No explicit timeout on Eliza chat backtest execution path

- **Severity**: P2 (Low-Medium)
- **Component**: `frontend/server/agents/eliza/plugins/virtuals/service.ts:247-275`, `frontend/server/agents/eliza/plugins/virtuals/backtestJobs.ts`
- **Description**: The chat entry point calls `await runRealBacktestJob(backtestRequest)` (service.ts:248) with no `AbortController`, `setTimeout`, or explicit timeout wrapper. If the backtest engine hangs (e.g. Hyperliquid API stalls, Supabase query deadlock), the Eliza session tool execution blocks indefinitely. The Binance/Bybit/Hyperliquid fetchers each have their own 15s/10s fetch timeouts, but the overall `executeBacktestCounterRebalance` call has no outer timeout. The API path (`_backtest-run.ts`) is similarly unbounded but benefits from Vercel function timeout. The Eliza/chat path runs in a Railway process with no platform-enforced per-call timeout.
- **Stop condition check**: This does NOT meet the P0 bar (anonymous compute trigger) because the chat path requires a paid/funded ACP job signal (`paymentGate.ts` — `config.requirePaidBacktests` defaults to `true`, service.ts:228-244 blocks unpaid requests). The entry point is not anonymous.
- **Recommendation**: Wrap `runRealBacktestJob` in a `Promise.race` with a configurable timeout (e.g. 60s) that returns a user-friendly error message instead of hanging the session.

#### BACKTEST-003 — CLI script does not call loadEnvFile(), relies on ambient env

- **Severity**: P2 (Low)
- **Component**: `frontend/scripts/backtest-counter-rebalance.ts`
- **Description**: The CLI script imports `executeBacktestCounterRebalance` directly but does not call `loadEnvFile()` or `dotenv.config()`. It relies on either (a) ambient shell env vars (exported before invocation) or (b) Vite's env loading if run through a Vite-aware runner. When `DATABASE_URL` is not in the ambient env, the 90-day backtest silently falls back from `supabase` source to `hyperliquid_chunked` (which only has ~3.5 days of 1m data), producing a degraded result without an explicit warning that the DB cache was not consulted. The 24h test worked because Hyperliquid has sufficient 1m data for short windows. The 90-day test worked because `DATABASE_URL` was present in `frontend/.env` and the script was run from the `frontend/` directory where tsx picks up `.env`. But this is fragile — if run from repo root or without `.env`, the DB cache is silently skipped.
- **Note**: This is consistent with the existing memory note: "4626 tsx scripts don't get Vite .env loading — must call loadEnvFile(). Without it getDb() returns null silently."
- **Recommendation**: Add explicit `loadEnvFile()` at the top of the CLI script, or emit a warning when `DATABASE_URL` is not found and the window exceeds 24*7 hours (where Hyperliquid 1m data is insufficient).

#### BACKTEST-004 — Backtest run API trims stdout to 8000 chars, losing sweep detail

- **Severity**: P2 (Low)
- **Component**: `frontend/api/_handlers/v1/alfaclub/_backtest-run.ts:77-80` (`trimOutput`), line 163 (`trimmedStdout`)
- **Description**: The API handler trims `result.stdout` to the last 8000 characters before returning it to the client. For large sweep outputs (135 parameter rows × ~200 chars/row = ~27,000 chars), the top-ranked configurations are truncated and only the last ~40 rows are visible in `stdout`. The full sweep data is available via the `sweepFile` field and the separate `_backtest-sweep` endpoint, so this is a UX issue, not a data-loss issue. The Arena UI reads `payload.data.stdout` (Arena.tsx:1021) for inline display but also calls `sweep.refetch()` to load the full CSV (Arena.tsx:1037).
- **Recommendation**: Consider returning only the top-N rows in `stdout` instead of tail-truncating, or increase the limit to 16,000 chars. Low priority since the full data is accessible via the sweep endpoint.

#### BACKTEST-005 — Interval degradation honesty is correct but display labeling could be clearer for 5m/15m

- **Severity**: P3 (Informational)
- **Component**: `frontend/src/pages/Arena.tsx:64-79` (`describeLastRunBarSize`), `frontend/src/components/arena/ArenaBacktestAnalysis.tsx:145-195`
- **Description**: The Arena UI correctly surfaces `resolvedInterval` from the API response and displays it. The 90-day coarse case (`1h` bars for 90-day window) gets an explicit amber warning banner (`ArenaBacktestAnalysis.tsx:191-195`). However, the intermediate degradation cases (1m → 5m or 1m → 15m) only show the resolved interval label ("5-minute" / "15-minute") without explaining that the 1m cache was insufficient. A user seeing "5-minute price snapshots" may not realize this is a degradation from the requested 1m fidelity. The `dataQuality.coveragePct` and `dataQuality.source` badges are displayed, which provides indirect signal, but there is no explicit "degraded from 1m" callout for the 5m/15m cases.
- **Classification**: Informational. The data is honest — the resolved interval is always reported. This is a UX clarity suggestion, not a correctness issue.
- **Recommendation**: Add a subtle "(degraded from 1m — cache coverage was {coveragePct}%)" suffix when `resolvedInterval !== '1m'` and the requested interval was `'auto'` or `'1m'`.

### Cross-finding notes (backtest)

1. **No P0 stop conditions triggered**: All 4 P0 criteria checked and cleared. Anonymous compute is blocked (Privy auth gate), interval degradation is honest (resolved interval + coverage surfaced), no-commingle invariant holds (0 violations in all test runs), and all artifacts are non-empty with valid data.

2. **BACKTEST-001 is not a new finding**: The unauthenticated GET endpoints are already classified as APIAUTH-016 in the endpoint matrix. The backtest audit confirms this classification is accurate — the endpoints are low-risk (simulation data, path-traversal-safe) but lack auth.

3. **BACKTEST-002 and BACKTEST-003 are operational hardening, not correctness bugs**: The missing timeout (BACKTEST-002) and missing env loading (BACKTEST-003) affect reliability under adverse conditions (API stalls, missing env) but do not produce incorrect results under normal operation. Both are P2.

4. **Unit test coverage is adequate for the chat path but absent for the core engine**: `backtestJobs.test.ts` (7 tests) covers `parseBacktestRequestFromText` and `runRealBacktestJob` with mocked engine. The full alfaclub+virtuals suite (404 tests) passes. However, `backtestCounterRebalance.ts`, `backtestMarketBars.ts`, `backtestIntervalPolicy.ts`, and `backtestSeriesDownsample.ts` have no dedicated unit test files. The engine is exercised only via CLI runs. This is a test-coverage gap, not a correctness finding — the CLI runs produce correct results.

5. **No-commingle invariant is structurally enforced**: The rebalance audit CSV `noCrossLegTransfer` column is `true` in every row of both test runs. The `requireNoCommingle` flag defaults to `true` in the API and is respected by the engine. The invariant holds.
