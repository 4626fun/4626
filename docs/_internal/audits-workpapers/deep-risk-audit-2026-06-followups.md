# 4626 Deep Risk Audit — Followups

Date: 2026-06-27
Companion to: `deep-risk-audit-2026-06-final-report.md`
Mode: audit-only — no product/code fixes applied. This file tracks actionable items for post-audit remediation owners.

## Priority tiers

- **Tier 1 — Launch path**: blocks or should be fixed before public launch.
- **Tier 2 — Pre-launch hardening**: defense-in-depth gaps recommended before launch but not blocking.
- **Tier 3 — Post-launch / backlog**: accepted risk, polish, or low-impact items.

---

## Tier 1 — Launch path

### F-001 — LAUNCH-001: DNS A-records for orchestrator + provisioner (P0, block launch)

- **Owner**: ops / infrastructure (external, not repo code)
- **Action**: Correct DNS A-records for `orchestrator.4626.fun` and `provisioner.4626.fun` to point at the Vultr hosts, not Vercel.
- **Verification**: `curl https://orchestrator.4626.fun/healthz` returns JSON `{ok: true}`. `curl https://provisioner.4626.fun/healthz` returns JSON with `payerHealthy: true`. `pnpm -C frontend ops:verify-akita-prelaunch --production` exits 0 with 0 blockers.
- **Status**: open — only active launch blocker. All 7 failing prelaunch gates trace to this root cause.

### F-002 — APIAUTH-001: Unthrottled mutating GET on /api/accounts/me (P2, fix before launch)

- **Owner**: backend / API
- **Action**: Either split `GET /api/accounts/me` into a true read-only snapshot (no identity writes) + a separate bounded rate-limited sync endpoint, or add `RATE_LIMITS.accountsMe` keyed on Privy user ID + IP with `Retry-After` on 429. Add regression tests for auth failure and rate-limit behavior.
- **Verification**: `grep -n 'checkRateLimit\|checkDurableRateLimit\|RATE_LIMITS\|Retry-After' frontend/api/_handlers/accounts/_me.ts` returns ≥1 match. New vitest test asserts 429 before schema/DB mutation helpers run.
- **Status**: open — most serious APIAUTH finding. Not anonymous (requires Privy auth), but DB write amplification + external Privy API cost on every request.

---

## Tier 2 — Pre-launch hardening

### F-003 — Systemic in-memory rate-limit pattern (13 APIAUTH findings)

- **Owner**: backend / API
- **Findings covered**: APIAUTH-003, 004, 006, 008, 009, 010, 011, 013, 014, 015, 017, 018, 019
- **Action**: Replace `checkRateLimit` (in-memory, per-isolate) with `checkDurableRateLimit(... { failClosed: true })` on all mutating and auth-adjacent endpoints. The correct durable pattern is already established in `auth/_verify.ts`, `auth/_privy.ts`, `deploy/_createCore.ts`, and the AMOE lottery handlers. Key by `privyUserId + ip` when authenticated, `ip` when pre-auth.
- **Verification**: `grep -rn 'checkRateLimit(' frontend/api/_handlers/ | grep -v checkDurableRateLimit` returns 0 matches on mutating POST handlers. Existing durable-limiter tests pass.
- **Status**: open — a single sweep closes 13 of 19 APIAUTH findings. Highest-leverage remediation action.
- **Note**: APIAUTH-002, 005, 016 are read-only GET endpoints where in-memory limits are acceptable (defense-in-depth only).

### F-004 — APIAUTH-007: Unauthenticated relay proxy with API key exposure (P2)

- **Owner**: backend / API
- **Action**: Add `readRequestPrincipalAddress(req)` at top of `relay/_execute.ts` and `relay/_quote.ts`. Reject unauthenticated with 401. For `relay/execute`, validate principal matches `user` field. For `relay/quote`, gate `subsidizeFees: true` behind auth.
- **Verification**: Unauthenticated POST to `/api/relay/execute` and `/api/relay/quote` returns 401.
- **Status**: open — API key consumption + fee subsidy abuse. Not fund theft (UserOp signature required).

### F-005 — WALLET-001: Tombstone pointer gap in recoverProfileIdFromPrivyHints (P2)

- **Owner**: backend / identity
- **Action**: Add `AND merged_into_profile_id IS NULL` to email and profiles-column lookups in `recoverProfileIdFromPrivyHints`. For `profile_wallets` lookup, join `profiles` and apply COALESCE + IS NULL filter as `findExistingProfileByAddress` does.
- **Verification**: Unit test that creates a tombstoned profile, then calls `recoverProfileIdFromPrivyHints` with the tombstoned email/wallet — must return null or the live canonical profile, never the tombstoned ID.
- **Status**: open — delegation state divergence on fallback path. Primary resolver is correct; this is the fallback path only.

### F-006 — RACE-001: Deploy session transition bypasses lease (P2)

- **Owner**: backend / deploy
- **Action**: Add `AND (lock_owner IS NULL OR lock_owner = ${callerWorkerId} OR lock_expires_at <= NOW())` to `transitionDeploySession`'s WHERE clause, or have `_statusCore.ts` claim a short-lived lease before transitioning.
- **Verification**: Test that status-poll transition while workflow runner holds an active lease either blocks or coordinates, rather than causing spurious `CONCURRENT_MODIFICATION`.
- **Status**: open — CAS prevents corruption. Risk is spurious retries + latency, not data loss.

### F-007 — APIAUTH-006: Non-atomic Supabase path in waitlist bootstrap (P2)

- **Owner**: backend / waitlist
- **Action**: For the non-transactional Supabase path, add `pg_advisory_lock(hash(privyUserId))` around `rebindEmailProfileToPrivyUser` when `db.query` is unavailable, or document why conditional UPDATEs are sufficient.
- **Verification**: Manual review confirming advisory lock or documented sufficiency.
- **Status**: open — referral point corruption risk on concurrent same-user bootstrap. Only relevant if Supabase sql-only path is active in production.

### F-008 — APIAUTH-004: Unlink value asymmetry + missing error handling (P2)

- **Owner**: backend / identity
- **Action**: Trace `recordProviderUnlink` to confirm caller-supplied `value` cannot affect profiles other than the authenticated user's. If it can, nullify the value (matching `_link.ts`). Add `isIdentityRecoveryRequiredError` handling to `_unlink.ts` catch block (return 409, matching `_link.ts`).
- **Verification**: `recordProviderUnlink` traced and confirmed owner-scoped. `_unlink.ts` catch returns 409 for recovery-required errors.
- **Status**: open — manual review required for the value asymmetry.

### F-009 — DRIFT-005, 006, 007: Stale file path references in docs (P2)

- **Owner**: docs
- **Action**: Update 4 stale paths in `docs/_internal/4626-connection-methods.md` (§5, §9, §13), 5 stale paths in `docs/operations/telegram-canonical-link-preservation.md`, and remove/replace the stale `WaitlistSetupWorkspace.tsx` reference in `frontend/docs/waitlist-accounts-architecture.md:65`.
- **Verification**: `grep` for each old path returns 0 matches in the respective doc files.
- **Status**: open — developer/operator friction, not production impact. 3 findings, 10 path corrections total.

---

## Tier 3 — Post-launch / backlog

### F-010 — Validation gate failures (VG-001, VG-002, VG-003)

- **Owner**: backend / test infrastructure
- **Actions**:
  - VG-001: Replace `readJsonBody` with `readBoundedJsonObjectBody` in `_backtest-run.ts:114`.
  - VG-002: Fix rate-limit check ordering in accounts/wallet handlers (429 before 503/401) or update test expectations. Relates to F-003.
  - VG-003: Map paymaster rate-limit rejection to JSON-RPC error code `-32005` instead of `-32000`.
- **Verification**: `pnpm -C frontend guard:api-nonv1-hardening` exit 0. `vitest run accountsWalletRateLimitHardening` exit 0. `vitest run paymasterRateLimit` exit 0.
- **Status**: open — all 3 pre-existing. VG-001 is a real hardening gap (unbounded body read); VG-002 and VG-003 are test/code mismatch.

### F-011 — APIAUTH-012: Session cookie HMAC as sole deploy auth (P3, known debt)

- **Owner**: backend / deploy
- **Action**: For `resume` and `cancel` handlers, require a fresh Privy JWT (validated within last 5 minutes) in addition to session cookie. Reject stale JWTs even if session cookie is valid.
- **Verification**: Resume/cancel with stale JWT + valid session cookie returns 401.
- **Status**: open — FINDING-09 already documented in code. 45-min TTL provides baseline. Higher-assurance remediation.

### F-012 — WALLET-002: Execution signer policy defense-in-depth (P3)

- **Owner**: backend / wallet
- **Action**: In `assertCanonicalPolicyContext`, after resolving `canonicalIdentity`, add execution-signer hard block: `if (isCanonicalCsw(canonicalIdentity) && !isAllowedCanonicalCswExecutionSigner(context.signerAddress)) throw`.
- **Verification**: Test that a signer in `CANONICAL_CSW_ALLOWED_OWNER_EOAS` but not in `CANONICAL_CSW_EXECUTION_OWNER_ADDRESSES` is rejected on sendCalls/canonicalDirect.
- **Status**: open — no current exploitable gap (allowlists in sync). Hardening before adding new owner EOAs.

### F-013 — WALLET-004: primary_wallet column precedence flip-flop (P3)

- **Owner**: backend / wallet
- **Action**: Change third branch of `resolveProfilesPrimaryWalletColumn` to `return input.embedded ?? input.activeOwner ?? input.classificationPrimary ?? null`.
- **Verification**: Test that embedded wins over activeOwner when canonical is absent.
- **Status**: open — cosmetic display column, not execution address.

### F-014 — RACE-002: Cross-tab swap nonce coordination (P3)

- **Owner**: frontend / swap
- **Action**: Use `BroadcastChannel` or `localStorage` storage event to share pending UserOp hashes across tabs for the same smart wallet. Alternatively, document as known limitation.
- **Verification**: Manual test: two tabs, same CSW, concurrent swap → second tab shows "pending operation in another tab" instead of confusing bundler rejection error.
- **Status**: open — edge case. Bundler rejection prevents fund loss.

### F-015 — RACE-003: Non-transactional mergePlaceholderProfiles (P3)

- **Owner**: backend / identity
- **Action**: Wrap `mergePlaceholderProfiles` call in `withDbTransaction` (helper already exists in `walletSync.ts:38-50`).
- **Verification**: Test that concurrent same-Privy-user adoptions do not interleave point moves.
- **Status**: open — rare edge case. Idempotent UPDATEs provide informal safety.

### F-016 — BACKTEST-002, 003, 004, 005: Backtest hardening (P2/P3)

- **Owner**: backend / backtest
- **Actions**:
  - BACKTEST-002: Wrap `runRealBacktestJob` in `Promise.race` with configurable timeout (e.g. 60s).
  - BACKTEST-003: Add `loadEnvFile()` at top of CLI script `backtest-counter-rebalance.ts`. Emit warning when `DATABASE_URL` not found and window > 7 days.
  - BACKTEST-004: Return top-N rows in stdout instead of tail-truncating, or increase limit to 16,000 chars.
  - BACKTEST-005: Add "(degraded from 1m — cache coverage was {coveragePct}%)" suffix when resolved interval ≠ 1m.
- **Verification**: CLI script runs from repo root without `frontend/.env` in CWD and produces correct 90-day result. API call with hanging upstream returns timeout error instead of hanging.
- **Status**: open — operational hardening, not correctness bugs.

### F-017 — UX-001, 002, 003: UX polish (P2)

- **Owner**: frontend / UX
- **Actions**:
  - UX-001: Use "On the list" instead of "Confirmed" when execution-ready not achieved, or add "Wallet setup remaining" below "Enter app" button.
  - UX-002: Do not auto-open Privy modal on redirect to /waitlist. Let user click "Join with email" themselves.
  - UX-003: Add collapsible hamburger menu or tab bar for Arena sub-pages visible below `lg` (1024px).
- **Verification**: Manual browser test on mobile viewport (375px) — Arena sub-pages reachable. Unauthenticated /swap redirect shows waitlist card without auto-modal. Waitlist card status reflects execution-ready state.
- **Status**: open — no safety/correctness violation. Swap page correctly gates regardless of waitlist card status.

### F-018 — UX-004, 005: UX backlog (P3)

- **Owner**: frontend / UX
- **Actions**:
  - UX-004: Add global account menu (header avatar/dropdown) with "Sign out" on all authenticated app-shell pages.
  - UX-005: Preserve PhaseTimeline above error boundary fallback, or include last-known phase state in error fallback.
- **Verification**: Sign-out accessible from /swap and /arena. Deploy render crash shows last-known phase.
- **Status**: open — low priority. Multi-account testing convenience + edge-case error context.

### F-019 — LAUNCH-002: Prelaunch script "read-only" header clarification (P2, informational)

- **Owner**: docs / ops
- **Action**: Clarify the prelaunch script header to distinguish "deploy read-only" from "exercises keeper control-plane" (the script triggers keeper checkpoint writes and orchestrator actions, which are normal keeper operations, not deploy mutations).
- **Verification**: Header text updated.
- **Status**: open — informational. No deploy state is mutated.

---

## Closed items

### C-001 — DRIFT-001 through DRIFT-004: Account model docs drift (P0/P1, remediated)

- **Status**: closed 2026-06-27
- **Verification**: Grep patterns return 0 matches in actual documentation files. `git diff --check` exit 0. Two rechecks performed (2026-06-26, 2026-06-27). All fixes survived docs reorganization (files moved to `docs/_internal/`).
- **Details**: See final report DRIFT-001 through DRIFT-004 entries.

---

## Summary

| Tier | Count | Action required |
|------|-------|-----------------|
| Tier 1 (launch path) | 2 | 1 external DNS fix + 1 API hardening |
| Tier 2 (pre-launch hardening) | 7 | Systemic rate-limit sweep + 6 targeted fixes |
| Tier 3 (post-launch/backlog) | 10 | Test fixes, defense-in-depth, UX polish, operational hardening |
| Closed | 1 (4 findings) | DRIFT-001–004 remediated and verified |
| **Total open followups** | **19** | |

Highest-leverage single action: **F-003** (systemic durable rate-limit sweep) closes 13 of 19 APIAUTH findings in one pass.

Only active launch blocker: **F-001** (LAUNCH-001 — external DNS, ops-owned, no code change).
