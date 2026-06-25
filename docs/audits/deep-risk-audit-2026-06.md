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
