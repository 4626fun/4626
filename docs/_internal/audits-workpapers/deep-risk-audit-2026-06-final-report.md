# 4626 Deep Risk Audit — Final Consolidated Report

Date: 2026-06-27
Mode: audit-only — no product/code fixes applied
Repository: `/home/akitav2/projects/4626`
Branch: `main`

## Sources merged

- `docs/_internal/audits-workpapers/deep-risk-audit-2026-06.md` — primary audit document (1481 lines)
- `docs/_internal/audits-workpapers/deep-risk-audit-2026-06-endpoint-matrix.md` — endpoint inspection matrix (182 lines)
- `docs/_internal/audits-workpapers/deep-risk-audit-2026-06-validation-log.md` — validation log (1292 lines)

## Severity scale

| Level | Meaning |
|-------|---------|
| P0 | Critical — blocks launch or causes fund loss / security bypass |
| P1 | High — fix before launch; serious correctness or security gap |
| P2 | Medium — monitor; hardening gap or data-integrity concern, not a direct security bypass |
| P3 | Low — accepted risk or informational; defense-in-depth or UX polish |

## Deduplication and merge notes

1. **BACKTEST-001 merged into APIAUTH-016** — BACKTEST-001 explicitly states "This is already documented as APIAUTH-016 in the endpoint matrix." Single merged entry retained as APIAUTH-016.
2. **WALLET-003 merged into APIAUTH-010** — Both cover the same four wallet handler endpoints (`_sync`, `_confirm-owner`, `_prepare-add-privy-owner`, `_disconnect-external`) with the same in-memory rate-limit gap. WALLET-003 was the wallet/identity audit pass rediscovery of the same finding. Single merged entry retained as APIAUTH-010.
3. **Validation-gate failures** promoted to standalone findings VG-001 through VG-003, cross-referenced to their related APIAUTH findings. They represent distinct guard/test failures, not duplicates of the APIAUTH findings.
4. **APIAUTH-001 severity normalized** — Original finding classified as "High" with "Launch blocker" language. The P0/P1 consolidation (2026-06-26) determined no APIAUTH finding meets the P0/P1 bar because all require authentication and none allow fund loss or anonymous mutation. APIAUTH-001 is normalized to P2 (high-end) with launch decision "fix before launch" — it is the most serious APIAUTH finding but does not block the launch gate.
5. **DRIFT-001 through DRIFT-004** remediated and verified clean (2026-06-27). Grep patterns return 0 matches in actual documentation files. Launch decision updated to "closed (remediated + verified)."
6. **LAUNCH-004 through LAUNCH-008** are positive findings (verified safe). Listed in the Positive Findings section, not in the risk-ordered finding list.

## Executive summary

| Severity | Count | Launch-blocking |
|----------|-------|-----------------|
| P0 | 2 (1 active, 1 remediated) | 1 (LAUNCH-001) |
| P1 | 3 (all remediated) | 0 |
| P2 | 22 | 0 |
| P3 | 21 | 0 |
| **Total findings** | **48** | **1** |

Active launch blockers: **1** (LAUNCH-001 — external DNS configuration).
Remediated pending closure: **0** (DRIFT-001–004 all verified clean 2026-06-27).
Fix-before-launch (non-blocking): **1** (APIAUTH-001 — unthrottled mutating GET, should be fixed before public launch but does not block the current gate).

---

## P0 — Critical

### LAUNCH-001

- **ID**: LAUNCH-001
- **Severity**: P0
- **Domain**: Vultr orchestrator + provisioner infrastructure / DNS routing
- **Launch decision**: block launch
- **Finding**: `orchestrator.4626.fun` and `provisioner.4626.fun` DNS A-records point at Vercel, not the Vultr hosts where the actual orchestrator and provisioner services run. Both domains return Vercel SPA HTML (`<div id="root"></div>`) instead of service JSON. POST /reconcile returns 405 because the Vercel SPA does not accept POST. 7 of 15 prelaunch gates fail, all tracing to this root cause. The 4626 repo code is correct — the prelaunch script correctly probes and reports the blockers. The fix is DNS A-record configuration, not a code change.
- **Evidence**: `pnpm -C frontend ops:verify-akita-prelaunch --production` exit 1. `curl https://orchestrator.4626.fun/healthz` returns 200 + HTML SPA body. `curl https://provisioner.4626.fun/healthz` returns 200 + HTML SPA body. Failing gates: vultr_orchestrator_health, vultr_orchestrator_settle_fees (405), vultr_orchestrator_winner_relay (405), vultr_relay_entries_paused (405 vs expected 503), vultr_provisioner_health (payerHealthy=undefined), vultr_provisioner_dns, vercel_solana_reconcile_chain (upstream 405). Passing gates (8/15): pipe_a_batcher, release_target_guard, hook_mainnet_canonical, vitest (53 tests), forge (6 tests), vercel_solana_infra_status, kpr_preflight_share_mesh_deferral, strategy_entitlement (ajna/charm/solana).
- **Pass/Fail Criterion**: PASS when `curl https://orchestrator.4626.fun/healthz` returns JSON `{ok: true}` and `curl https://provisioner.4626.fun/healthz` returns JSON with `payerHealthy: true`, and `pnpm -C frontend ops:verify-akita-prelaunch --production` exits 0 with 0 blockers.
- **Recommended Fix**: Correct DNS A-records for `orchestrator.4626.fun` and `provisioner.4626.fun` to point at the Vultr hosts where the orchestrator and provisioner services run (not Vercel). External infrastructure fix — no code change required.
- **Launch Impact**: Blocks launch until DNS is corrected. Platform contracts, tests, Vercel infra, Solana share mesh, and creator entitlements are all ready. Only the Vultr orchestrator/provisioner bridge is inaccessible.

### DRIFT-001

- **ID**: DRIFT-001
- **Severity**: P0 (remediated)
- **Domain**: Account model / wallet execution path
- **Launch decision**: closed (remediated + verified 2026-06-27)
- **Finding**: `frontend/docs/waitlist-accounts-architecture.md:41` stated "the canonical path is sub-account setup, not direct owner delegation" and "the parent CSW remains the canonical asset-holding account but is not the execution address." This contradicted `executionTrack.ts:6-9` which routes user-initiated frontend execution through the parent CSW only via canonical4337, and 5 other docs confirming parent CSW as the default execution address.
- **Evidence**: Remediation applied: line 41 now reads "canonical path is parent CSW + Privy embedded-owner signer (`legacy-owner-install`), not sub-account setup" with sub-account marked as flag-gated swap-only fallback. Verification: `grep -n 'canonical path is sub-account\|parent CSW.*not the execution address' frontend/docs/waitlist-accounts-architecture.md` returns 0 matches (exit 1).
- **Pass/Fail Criterion**: PASS — 0 matches for drift patterns in actual documentation files.
- **Recommended Fix**: None required. Remediation verified clean.
- **Launch Impact**: None — remediated and verified. No longer blocks launch.

---

## P1 — High

### DRIFT-002

- **ID**: DRIFT-002
- **Severity**: P1 (remediated)
- **Domain**: Account model / wallet execution path / readiness gating
- **Launch decision**: closed (remediated + verified 2026-06-27)
- **Finding**: `frontend/docs/waitlist-accounts-architecture.md:43-44` said "resume sub-account setup" and gated readiness on "sub-account persisted + signer configured." AGENTS.md says "resume embedded-owner signing setup for the canonical parent CSW" and "Do not make waitlist onboarding explicitly create a sub-account." Readiness = parent CSW + embedded EOA owner confirmation.
- **Evidence**: Remediation applied: line 43 now reads "resume embedded-owner signing setup for the canonical parent CSW"; readiness gate changed to "parent CSW + embedded EOA owner confirmation." Verification: `grep -n 'resume sub-account setup\|sub-account persisted.*signer configured' frontend/docs/waitlist-accounts-architecture.md` returns 0 matches (exit 1).
- **Pass/Fail Criterion**: PASS — 0 matches for drift patterns.
- **Recommended Fix**: None required. Remediation verified clean.
- **Launch Impact**: None — remediated and verified.

### DRIFT-003

- **ID**: DRIFT-003
- **Severity**: P1 (remediated)
- **Domain**: Account model / wallet execution path
- **Launch decision**: closed (remediated + verified 2026-06-27)
- **Finding**: `docs/_internal/4626-connection-methods.md` (formerly `docs/4626-connection-methods.md`) had an internal contradiction — the warning banner (lines 14-20) said "sub-accounts are dormant" but body sections §3-§11 still described sub-account as the default user execution path, with diagrams showing "Execution address: sub-account" and "PHASE 1: Sub-Account Creation" as default onboarding steps.
- **Evidence**: Remediation applied: §3, §4, §10, §11, §12 rewritten to describe parent CSW + embedded-owner signing as the default path; sub-account marked as flag-gated swap-only fallback; execution address in post-setup diagram changed to parent CSW; §12 readiness checkpoint = parent CSW owner confirmation; "PHASE 1: Sub-Account Creation" renamed to "SUB-ACCOUNT CREATION." Verification: `grep -n 'Execution address: sub-account\|PHASE 1: Sub-Account Creation' docs/_internal/4626-connection-methods.md` returns 0 matches (exit 1).
- **Pass/Fail Criterion**: PASS — 0 matches for drift patterns.
- **Recommended Fix**: None required. Remediation verified clean. Note: file moved from `docs/` to `docs/_internal/` during docs reorganization; fix verified intact at new location.
- **Launch Impact**: None — remediated and verified.

### DRIFT-004

- **ID**: DRIFT-004
- **Severity**: P1 (remediated)
- **Domain**: Account model / owner-mutation decision
- **Launch decision**: closed (remediated + verified 2026-06-27)
- **Finding**: `docs/_internal/ACCOUNT_MODEL.md` §5.2 (lines 220-222) recommended "Use Sub Accounts + Spend Permissions for population (b)." The actual shipped solution was `legacy-owner-install` — Privy embedded EOA as direct owner of parent CSW. Sub-accounts became flag-gated fallback. Same issue in `docs/_internal/wallet-notes/owner-mutation-decision-2026-05.md` (formerly `docs/owner-mutation-decision-2026-05.md`).
- **Evidence**: Remediation applied: ACCOUNT_MODEL.md §3 invariant removed "Use Sub Accounts + Spend Permissions"; §5.2 updated to reflect legacy-owner-install as the shipped decision; owner-mutation-decision-2026-05.md decision text, practice table, "What does not ship" section, and "Next work" section all updated. Verification: `grep -n 'Use Sub Accounts + Spend Permissions for population' docs/_internal/ACCOUNT_MODEL.md docs/_internal/wallet-notes/owner-mutation-decision-2026-05.md` returns 0 matches (exit 1).
- **Pass/Fail Criterion**: PASS — 0 matches for drift patterns.
- **Recommended Fix**: None required. Remediation verified clean. Note: both files moved from `docs/` to `docs/_internal/` during docs reorganization; fixes verified intact at new locations.
- **Launch Impact**: None — remediated and verified.

---

## P2 — Medium

### APIAUTH-001

- **ID**: APIAUTH-001
- **Severity**: P2 (High-end — most serious APIAUTH finding)
- **Domain**: API auth / accounts — unthrottled mutating GET
- **Launch decision**: fix before launch
- **Finding**: `GET /api/accounts/me` is an authenticated (Privy required) but completely unthrottled GET path that performs identity/profile DB writes via `syncEmailIdentity()` (upserts account/email rows, awards point events) and external Privy API calls on every request. No `checkRateLimit`, `checkDurableRateLimit`, `RATE_LIMITS`, or `Retry-After` logic exists in the handler. Any authenticated session can repeatedly hit this hot bootstrap endpoint, causing DB writes and external Privy calls without throttling. This blurs snapshot semantics for `/api/accounts/me` and increases waitlist/account-setup race risk under repeated bootstrap retries.
- **Evidence**: `frontend/api/_handlers/accounts/_me.ts:22-29` handles only GET. `:39-54` verifies Privy, ensures schema, calls `syncEmailIdentity()`, builds payload. `accountsIdentity.ts:665-688` implements `syncEmailIdentity` with `upsertAccount`, `upsertLinkedMethod`, `applyPointEvent`. Search for `checkRateLimit|RATE_LIMITS|rateLimitKey|Retry-After` in `_me.ts` returned zero matches. Existing tests (`accountsMe.test.ts:49-110`) cover normalized state and emailVerified preservation but not rate limiting or auth failure.
- **Pass/Fail Criterion**: FAIL until `GET /api/accounts/me` either becomes a true read-only snapshot (no identity writes) or enforces a rate limit keyed by Privy user + IP, returns 429 with `Retry-After`, and has regression coverage for auth failure and rate-limit behavior.
- **Recommended Fix**: Split the route into a read-only `GET /api/accounts/me` (no writes) and a separate bounded, authenticated, rate-limited sync/refresh endpoint for identity writes. If write-on-read must remain temporarily, add `RATE_LIMITS.accountsMe` keyed on Privy user ID + IP, set `Retry-After` on 429, and add tests asserting the limiter blocks before schema/DB mutation helpers run.
- **Launch Impact**: Should be fixed before public launch. Not an anonymous mutation — requires Privy auth. The risk is DB write amplification and external API cost, not fund loss or security bypass. Does not block the current launch gate.

### APIAUTH-003

- **ID**: APIAUTH-003
- **Severity**: P2
- **Domain**: API auth — in-memory rate limits on auth-adjacent POST
- **Launch decision**: monitor
- **Finding**: `auth/_agent-nonce.ts` and `auth/_agent-verify.ts` use `checkRateLimit` (in-memory, per-isolate) with `RATE_LIMITS.authAgentWrite`, keyed by client IP. In Vercel serverless, each warm instance has its own counter — concurrent instances do not share the rate-limit budget, allowing cross-instance budget bypass. The primary auth endpoints (`auth/_verify.ts`, `auth/_privy.ts`) correctly use `checkDurableRateLimit` with `failClosed: true`. `_agent-nonce` also makes an on-chain `isOwnerAddress` call (12s RPC timeout) per request, amplifying RPC load under bypass.
- **Evidence**: `auth/_agent-nonce.ts`: `checkRateLimit(rateLimitKey('auth-agent-nonce', getClientIp(req)), RATE_LIMITS.authAgentWrite)`. `auth/_agent-verify.ts`: same pattern. Contrast: `auth/_verify.ts`: `checkDurableRateLimit(... failClosed: true)` with comment "H-07 / 4626-299: auth endpoints must use the durable Postgres-backed limiter."
- **Pass/Fail Criterion**: FAIL until both agent endpoints use `checkDurableRateLimit` with `failClosed: true`, matching the pattern in `auth/_verify.ts`.
- **Recommended Fix**: Replace `checkRateLimit(...)` with `checkDurableRateLimit(... { failClosed: true })` in both files, same key and limit.
- **Launch Impact**: Not a launch blocker. SIWA on-chain validation prevents direct auth bypass. The gap is defense-in-depth: cross-instance budget bypass and RPC load amplification.

### APIAUTH-004

- **ID**: APIAUTH-004
- **Severity**: P2
- **Domain**: API accounts — in-memory IP-only rate limits on mutating POST
- **Launch decision**: monitor
- **Finding**: `accounts/_link.ts` and `accounts/_unlink.ts` are mutating POSTs (syncEmailIdentity + recordProviderLink/Unlink) using `checkRateLimit` (in-memory, IP-only) with `RATE_LIMITS.cswLink`. Not keyed by Privy user ID — an attacker with multiple IPs can exceed the per-user budget. In-memory limiter resets per cold start. Additional: `_unlink.ts` passes caller-supplied `value` to `recordProviderUnlink` (asymmetry with `_link.ts` which passes `value: null`), and catch block does not handle `isIdentityRecoveryRequiredError` (returns 500 instead of 409).
- **Evidence**: `accounts/_link.ts:70-77`: in-memory, IP-only. `:108`: `value: null` with comment "Never trust caller-supplied identity values." `accounts/_unlink.ts:69-76`: in-memory, IP-only. `:106`: caller-supplied `value` passed through. `:115-118`: catch block has no `isIdentityRecoveryRequiredError` check. Validation gate VG-002 confirms test failures on these endpoints.
- **Pass/Fail Criterion**: FAIL until both endpoints use `checkDurableRateLimit` with `failClosed: true` keyed by Privy user ID + IP. NEEDS MANUAL REVIEW: trace `recordProviderUnlink` to confirm caller-supplied value cannot affect other profiles.
- **Recommended Fix**: Replace `checkRateLimit` with `checkDurableRateLimit(... { failClosed: true })` keyed by `privyUserId + ip`. Add `isIdentityRecoveryRequiredError` handling to `_unlink.ts` catch (return 409). Trace `recordProviderUnlink` to determine if value should be nullified.
- **Launch Impact**: Not a launch blocker. Endpoints require Privy auth and mutations are scoped to authenticated user. Gap is defense-in-depth.

### APIAUTH-006

- **ID**: APIAUTH-006
- **Severity**: P2
- **Domain**: API waitlist — in-memory rate limit + non-atomic Supabase path
- **Launch decision**: monitor
- **Finding**: `POST /api/waitlist/bootstrap` is the heaviest shard A handler. Uses `checkRateLimit` (in-memory, IP-only) with `RATE_LIMITS.general`. The full bootstrap path (requires Privy token) performs Privy verify + email retry (up to 10 retries × 300ms) + schema ensures + syncEmailIdentity + collision checks + upserts + referral code generation (external Zora SDK + Basename RPC, up to 6s) + point awards. Non-atomic: when `db.query` is unavailable (Supabase sql-only path), `runBootstrapTransaction` skips the transaction wrapper — `rebindEmailProfileToPrivyUser` point moves are NOT atomic, allowing concurrent bootstrap calls for the same user to interleave and corrupt referral points.
- **Evidence**: `waitlist/_bootstrap.ts:520`: in-memory, IP-only. `:109-138`: `runBootstrapTransaction` skips transaction when `db.query` not a function. `:114-123`: R6 comment documents non-atomic risk. `:281-299`: external Zora SDK calls. `:580-585`: 10-retry Privy email polling.
- **Pass/Fail Criterion**: FAIL until `checkDurableRateLimit` with `failClosed: true` keyed by `privyUserId + ip`. NEEDS MANUAL REVIEW: confirm whether `pg_advisory_lock` serialization is in place for the non-transactional Supabase path.
- **Recommended Fix**: Replace with `checkDurableRateLimit(... { failClosed: true })` keyed by `privyUserId + ip`. For non-atomic Supabase path, add `pg_advisory_lock(hash(privyUserId))` around `rebindEmailProfileToPrivyUser`, or document why conditional UPDATEs are sufficient.
- **Launch Impact**: Not a launch blocker (heavy path requires auth). The non-atomic Supabase path is a data-integrity concern for referral points, not a security bypass. Should be remediated before launch if Supabase sql-only path is active in production.

### APIAUTH-007

- **ID**: APIAUTH-007
- **Severity**: P2
- **Domain**: API relay — unauthenticated external proxy with API key exposure
- **Launch decision**: monitor
- **Finding**: `relay/execute` and `relay/quote` accept POST with no authentication check (no `readRequestPrincipalAddress`, no `verifyPrivyForAccounts`). `relay/execute` proxies to Relay.link with the project's `x-api-key` header — the `user` field is validated as an address but not checked against caller identity, and inner UserOp calls are not decoded. `relay/quote` includes `subsidizeFees: true` for unauthenticated callers, exposing the project's fee subsidy. Only access control is in-memory IP-only rate limit.
- **Evidence**: `relay/_execute.ts:111-305`: no auth check, proxies with project API key. `:188-193`: user field validated as address but not identity-checked. `:170-176`: data only checked for `handleOps` selector prefix. `relay/_quote.ts:75-209`: `subsidizeFees: true` + `explicitDeposit: true` for unauthenticated callers. Mitigating: `value` forced to `"0"`, `to` restricted to EntryPoint addresses, UserOp must be signed by wallet owner.
- **Pass/Fail Criterion**: FAIL until both endpoints require authenticated principal and validate caller owns the `user` address. `relay/quote` `subsidizeFees` should be gated behind authentication.
- **Recommended Fix**: Add `readRequestPrincipalAddress(req)` at top of both handlers. Reject unauthenticated with 401. For `relay/execute`, validate principal matches `user` field. For `relay/quote`, gate `subsidizeFees: true` behind auth; use `subsidizeFees: false` for unauthenticated.
- **Launch Impact**: Not a launch blocker (UserOp signature prevents fund theft). Abuse is API key consumption and fee subsidy, not direct chain mutation. Should be remediated before public launch if Relay API key has financial cost.

### APIAUTH-008

- **ID**: APIAUTH-008
- **Severity**: P2
- **Domain**: API paymaster — in-memory rate limits on sponsorship path
- **Launch decision**: monitor
- **Finding**: The paymaster JSON-RPC proxy uses three layers of in-memory (non-durable) rate limits: per-IP, per-sender (`checkSponsorshipLimit`), and per-session (`enforceRateLimit`). None use `checkDurableRateLimit` with `failClosed`. On Vercel serverless, each instance has separate in-memory state — an attacker can multiply their sponsorship quota by hitting different instances. The paymaster is the most security-critical endpoint (sponsors gas for UserOps). Validation gate VG-003 confirms the rate-limit error code mismatch (-32000 vs expected -32005).
- **Evidence**: `paymaster/_paymaster.ts:3608` per-IP in-memory. `:3690` per-sender in-memory. `:3743` per-session in-memory. Contrast: `auth/_verify.ts` and `_privy.ts` use `checkDurableRateLimit` with `failClosed: true`. Mitigating: `validateSponsoredSmartWalletCalls` (line 3757) is thorough and correct — sender ownership, inner calls, deploy session ownership, cleanup-only mode, creator allowlisting all validated.
- **Pass/Fail Criterion**: FAIL until `checkSponsorshipLimit` and `enforceRateLimit` use `checkDurableRateLimit` with `failClosed: true`, keyed by sender and session address respectively. Per-IP limiter can remain in-memory as first-line throttle.
- **Recommended Fix**: Replace `checkSponsorshipLimit` with durable limiter keyed by sender address. Replace `enforceRateLimit` with durable limiter keyed by session address. Both with `failClosed: true`.
- **Launch Impact**: Not a launch blocker (validation logic is thorough). Rate-limit bypass is a gas-budget abuse concern, not a security bypass. Should be remediated before public launch.

### APIAUTH-009

- **ID**: APIAUTH-009
- **Severity**: P2
- **Domain**: API deploy — no rate limit on mutating workflow POST
- **Launch decision**: monitor
- **Finding**: `deploy/v2/session/_resume.ts` has no `checkRateLimit` or `checkDurableRateLimit`. It authenticates via `loadAuthorizedDeploySession` (session cookie HMAC + sessionAddress match) then calls `runDeployWorkflow` which sends on-chain UserOps via `advanceDeploySession`. An authenticated caller can spam resume calls, each triggering a new workflow run that may send UserOps, bypassing the per-run tick limit (8-25 ticks) by making multiple calls.
- **Evidence**: `_resume.ts`: no rate limit call found. Contrast: `_start.ts:134` uses `checkRateLimit` (per auth.address). `_cancelCore.ts:148` uses `checkRateLimit`. `_createCore.ts` uses `checkDurableRateLimit` with `failClosed`. Mitigating: auth required, 45-min TTL, per-run tick limiting.
- **Pass/Fail Criterion**: FAIL until `_resume.ts` has at least in-memory rate limit keyed by auth.address, or preferably `checkDurableRateLimit` with `failClosed`.
- **Recommended Fix**: Add `checkRateLimit(rateLimitKey('deploy-resume', auth.address), RATE_LIMITS.deployWrite)` after `loadAuthorizedDeploySession` resolves auth. For stronger protection, use `checkDurableRateLimit` with `failClosed: true`.
- **Launch Impact**: Not a launch blocker (auth + TTL + tick limiting provide baseline). Should be remediated before public launch to prevent gas-budget abuse.

### APIAUTH-014

- **ID**: APIAUTH-014
- **Severity**: P2
- **Domain**: API backtest — in-memory rate limit on compute-heavy execution
- **Launch decision**: monitor
- **Finding**: `alfaclub/backtest-run` uses `checkRateLimit` (in-memory, 5/min per privy user + IP) with no durable fallback. Privy auth required (not anonymous). On Vercel serverless, in-memory limits reset per cold start — a valid Privy user can bypass the 5/min throttle by triggering cold starts. The endpoint calls `executeBacktestCounterRebalance` (fetches candle data + runs full simulation), making it the most compute-expensive v1 endpoint. Validation gate VG-001 confirms additional hardening gap: `_backtest-run.ts:114` uses `readJsonBody` instead of `readBoundedJsonObjectBody` — unbounded body read on a mutating endpoint.
- **Evidence**: `_backtest-run.ts:103-110`: in-memory rate limit. `:94-100`: Privy auth required. `:77-80`: `trimOutput` trims stdout to 8000 chars. Guard failure: `guard:api-nonv1-hardening` exit 1 — `_backtest-run.ts:114` uses `readJsonBody` instead of `readBoundedJsonObjectBody`. Numeric parameters clamped to safe ranges (`toRangeNumber`, `clampBacktestHealthFloor`). No DB or chain side effects.
- **Pass/Fail Criterion**: FAIL until durable rate limit is layered on top of in-memory (matching AMOE lottery handler pattern) and body read uses `readBoundedJsonObjectBody`.
- **Recommended Fix**: Add `checkDurableRateLimit` with `failClosed: true` on top of `checkRateLimit`, keyed by `privyUserId + ip`. Replace `readJsonBody` with `readBoundedJsonObjectBody(req, { maxBytes: ... })` at line 114.
- **Launch Impact**: Not a launch blocker (auth required, no fund loss path). Should be remediated before public launch to prevent compute abuse.

### WALLET-001

- **ID**: WALLET-001
- **Severity**: P2
- **Domain**: Identity / tombstone integrity
- **Launch decision**: monitor
- **Finding**: `recoverProfileIdFromPrivyHints` in `canonicalCswDelegation.ts:170-210` performs three profile ID lookups (email, wallet address, profiles column) that do NOT follow `merged_into_profile_id` tombstone pointers. Any can return a tombstoned profile ID. In `resolveCanonicalCsw`, this ID is used to write `privy_user_id`, `csw_address`, and `primary_smart_wallet` onto the tombstoned row, resurrecting the merged fragment and causing delegation state divergence.
- **Evidence**: `canonicalCswDelegation.ts:159`: `SELECT id FROM profiles WHERE LOWER(email) = ${normalized} LIMIT 1` — no `merged_into_profile_id IS NULL` filter. `:184-193`: `profile_wallets` lookup — no tombstone join. `:195-207`: profiles column lookup — no tombstone filter. Contrast: `walletSync.ts:129-130` and `profileIdForPrivyUser.ts:52-53` both apply `COALESCE(m.merged_into_profile_id, m.id)` + `WHERE p.merged_into_profile_id IS NULL`.
- **Pass/Fail Criterion**: FAIL if `recoverProfileIdFromPrivyHints` follows tombstone pointers (COALESCE + IS NULL filter) on all three lookup paths. Currently FAIL — no tombstone filtering on any path.
- **Recommended Fix**: Add `AND merged_into_profile_id IS NULL` to email and profiles-column lookups. For `profile_wallets` lookup, join `profiles` and apply COALESCE + IS NULL filter as `findExistingProfileByAddress` does.
- **Launch Impact**: Low-medium. Primary resolver (`readProfileIdByPrivyUserId`) correctly follows tombstones — this only triggers in the fallback path (alias table missing or stale Privy user ID). Consequence is delegation state divergence, not fund loss.

### RACE-001

- **ID**: RACE-001
- **Severity**: P2
- **Domain**: Deploy session / concurrent worker transitions
- **Launch decision**: monitor
- **Finding**: `transitionDeploySession` uses CAS on `step = fromStep` but does NOT check `lock_owner` or `lock_expires_at`. The status-poll path in `_statusCore.ts:2282` calls `transitionDeploySession` directly, bypassing the workflow runner's lease. If the runner holds a lease and the status poll transitions the step, the runner's subsequent transition fails with `CONCURRENT_MODIFICATION` (CAS miss on fromStep).
- **Evidence**: `deploySessions.ts:378-480`: CAS on step, no lock_owner check. `_statusCore.ts:2282-2291`: status-poll triggered transition bypasses lease. `workflow/runner.ts:116`: workflow runner lease claim. Why not worse: CAS prevents data corruption — two concurrent transitions serialize at Postgres row level, only first matches. System is self-healing.
- **Pass/Fail Criterion**: FAIL if `transitionDeploySession` checks `lock_owner` or status-poll path coordinates with lease. Currently FAIL — no lock_owner check.
- **Recommended Fix**: Add `AND (lock_owner IS NULL OR lock_owner = ${callerWorkerId} OR lock_expires_at <= NOW())` to `transitionDeploySession`'s WHERE clause, or have `_statusCore.ts` claim a short-lived lease before transitioning.
- **Launch Impact**: Low-medium. CAS prevents corruption. Risk is spurious `CONCURRENT_MODIFICATION` errors triggering retries — adds latency, not data loss.

### DRIFT-005

- **ID**: DRIFT-005
- **Severity**: P2
- **Domain**: File path drift / developer guidance
- **Launch decision**: monitor
- **Finding**: 4 file paths in `docs/_internal/4626-connection-methods.md` are stale due to file reorganization. `onboardingWallet.ts` does NOT exist (split into 3 files), `deploy/session/_create.ts` is now `deploy/v2/session/_create.ts`, `privyXmtpSigner.ts` moved to `wallet/` subdirectory, `agentRegistration.ts` moved to `agent/` subdirectory.
- **Evidence**: §5 (line 214, 234): references `onboardingWallet.ts` (actual: `onboardingWalletDelegation.ts`, `onboardingWalletPrepared.ts`, `onboardingWalletReplayable.ts`). §9 (line 473): `deploy/session/_create.ts` (actual: `deploy/v2/session/_create.ts`). §13 (lines 696-698): `privyXmtpSigner.ts` (actual: `wallet/privyXmtpSigner.ts`), `agentRegistration.ts` (actual: `agent/agentRegistration.ts`). All verified via filesystem.
- **Pass/Fail Criterion**: FAIL until all 4 paths corrected to current locations.
- **Recommended Fix**: Update §5, §9, §13 file path references to current locations.
- **Launch Impact**: Low — developer friction, not a production issue.

### DRIFT-006

- **ID**: DRIFT-006
- **Severity**: P2
- **Domain**: File path drift / operator guidance
- **Launch decision**: monitor
- **Finding**: 5 file paths in `docs/operations/telegram-canonical-link-preservation.md` are stale due to directory reorganization. All 5 files exist at their new locations but the doc references old paths.
- **Evidence**: Line 45: `telegramMiniAppLink.ts` (actual: `telegram/telegramMiniAppLink.ts`). Line 67: `telegramWebApp.ts` (actual: `telegram/telegramWebApp.ts`). Lines 110, 156: `accountsIdentity.ts` (actual: `identity/accountsIdentity.ts`). Line 157: `walletSync.ts` (actual: `wallet/walletSync.ts`). Line 158: `telegramTrading.ts` (actual: `messaging/telegramTrading.ts`). All verified via filesystem.
- **Pass/Fail Criterion**: FAIL until all 5 paths corrected to current locations.
- **Recommended Fix**: Update file path references to current subdirectory locations.
- **Launch Impact**: Low — operator/developer friction when locating files during Telegram link flow debugging.

### DRIFT-007

- **ID**: DRIFT-007
- **Severity**: P2
- **Domain**: File path drift / developer guidance
- **Launch decision**: monitor
- **Finding**: `frontend/docs/waitlist-accounts-architecture.md:65` references `WaitlistSetupWorkspace.tsx` as a file new product work should build on. The file does NOT exist — it was removed or renamed during a refactoring pass. The doc's own "Legacy note" section says the older heavy waitlist flow was removed, but then lists this file as a build-on target, contradicting itself.
- **Evidence**: `waitlist-accounts-architecture.md:65` references `frontend/src/features/waitlist/WaitlistSetupWorkspace.tsx`. Filesystem check: directory contains `WaitlistFlow.tsx`, `WaitlistConnectBaseApp.tsx`, `LaunchCoinCard.tsx`, etc. — no `WaitlistSetupWorkspace.tsx`.
- **Pass/Fail Criterion**: FAIL until reference removed or replaced with the actual successor file.
- **Recommended Fix**: Remove the stale reference or replace with the actual file (`WaitlistFlow.tsx` or `AccountSetupWorkspaceView.tsx` depending on intended scope).
- **Launch Impact**: Low — developer friction.

### LAUNCH-002

- **ID**: LAUNCH-002
- **Severity**: P2
- **Domain**: Prelaunch script behavior / keeper control-plane
- **Launch decision**: monitor
- **Finding**: The prelaunch script header says "read-only by default" but it triggers DB writes (`keepr_workflow_checkpoints` INSERT/UPDATE) and upstream orchestrator actions (`settle_fees`, `winner_relay`) via the keeper reconcile endpoint. These are keeper operations (Solana bridge fee settlement, winner relay), not deploy mutations. The endpoint is idempotent (checkpoint-based). The "read-only by default" header is slightly misleading.
- **Evidence**: `verify-akita-prelaunch-readiness.ts:162-223`: sends POST to orchestrator with `action: 'settle_fees'`, `action: 'winner_relay'`, `action: 'relay_entries'`. `:268-282`: sends POST to `/api/keeper/solana/reconcile`. `_solanaReconcile.ts:239-312`: writes to `keepr_workflow_checkpoints`. Deploy status/preflight endpoints themselves (`_status.ts`, `_solanaInfraStatus.ts`) are confirmed read-only (LAUNCH-006).
- **Pass/Fail Criterion**: PASS (informational — the DB writes are checkpoint records, not deploy state. The orchestrator actions are normal keeper operations. No deploy state is mutated.)
- **Recommended Fix**: Clarify the prelaunch script header to distinguish "deploy read-only" from "exercises keeper control-plane."
- **Launch Impact**: Low — informational. No deploy state is mutated.

### LAUNCH-003

- **ID**: LAUNCH-003
- **Severity**: P2
- **Domain**: Local development environment / .env file
- **Launch decision**: accepted risk (local dev only)
- **Finding**: Line 504 of `frontend/.env` contains bare `ALFACLUB` without an `=` sign. When `dev-deploy-dry-run.sh` sources the .env file, the shell interprets `ALFACLUB` as a command, producing `ALFACLUB: command not found` and causing the script to exit. Fixed locally by commenting out the bare line.
- **Evidence**: `frontend/.env:504` — bare `ALFACLUB` line. `git check-ignore frontend/.env` confirms the file is gitignored. After local fix: `git diff --name-only` shows 0 unstaged, `git diff --cached --name-only` shows 0 staged. No dirty tracked file created.
- **Pass/Fail Criterion**: PASS (local precondition resolved. No production impact.)
- **Recommended Fix**: None required beyond the local fix already applied.
- **Launch Impact**: None — local development issue only. Does not affect production.

### APIAUTH-016 (merged with BACKTEST-001)

- **ID**: APIAUTH-016 (also BACKTEST-001 — merged)
- **Severity**: P2
- **Domain**: API backtest — unauthenticated read-only endpoints
- **Launch decision**: monitor
- **Finding**: The 4 backtest GET endpoints (`_backtest-sweep`, `_backtest-series`, `_backtest-audit`, `_backtest-markets`) have no auth gate — only in-memory IP-only rate limits. Any caller can list sweep CSVs, read series JSON, read rebalance audit CSVs, and fetch available markets. The data is simulation output (not PII or secrets). Sweep handler uses `path.basename()` validation to prevent path traversal. Markets endpoint makes an unauthenticated external API call (Hyperliquid).
- **Evidence**: `_backtest-sweep.ts:97-104`: in-memory IP-only, no auth. `_backtest-series.ts:56-63`: same. `_backtest-audit.ts:91-98`: same. `_backtest-markets.ts:30-37`: same. All read-only (filesystem reads or external API fetch). Path sanitization via `path.basename` + `.csv` extension check.
- **Pass/Fail Criterion**: FAIL until session auth is added for sweep/series/audit if backtest results should be operator-scoped. Markets endpoint is low-risk (public market data).
- **Recommended Fix**: Consider adding session auth for sweep/series/audit endpoints. Markets endpoint can remain unauthenticated (public data).
- **Launch Impact**: Low — simulation data, path-traversal-safe. Not a launch blocker.

### BACKTEST-002

- **ID**: BACKTEST-002
- **Severity**: P2
- **Domain**: Backtest — no timeout on Eliza chat execution path
- **Launch decision**: monitor
- **Finding**: The chat entry point calls `await runRealBacktestJob(backtestRequest)` with no `AbortController`, `setTimeout`, or explicit timeout wrapper. If the backtest engine hangs (Hyperliquid API stalls, Supabase deadlock), the Eliza session tool execution blocks indefinitely. Individual fetchers have 15s/10s timeouts, but the overall `executeBacktestCounterRebalance` call has no outer timeout. The Railway process has no platform-enforced per-call timeout.
- **Evidence**: `service.ts:247-275`: `await runRealBacktestJob` with no timeout. `backtestJobs.ts`: no timeout wrapper. Does NOT meet P0 bar — entry point requires paid/funded ACP job signal (`paymentGate.ts` — `config.requirePaidBacktests` defaults to `true`).
- **Pass/Fail Criterion**: FAIL until `runRealBacktestJob` is wrapped in a `Promise.race` with a configurable timeout.
- **Recommended Fix**: Wrap `runRealBacktestJob` in `Promise.race` with a configurable timeout (e.g. 60s) that returns a user-friendly error instead of hanging.
- **Launch Impact**: Not a launch blocker (not anonymous — requires paid ACP job). Operational hardening, not correctness bug.

### BACKTEST-003

- **ID**: BACKTEST-003
- **Severity**: P2
- **Domain**: Backtest — CLI script missing loadEnvFile
- **Launch decision**: monitor
- **Finding**: The CLI script `backtest-counter-rebalance.ts` does not call `loadEnvFile()` or `dotenv.config()`. When `DATABASE_URL` is not in ambient env, the 90-day backtest silently falls back from `supabase` source to `hyperliquid_chunked` (only ~3.5 days of 1m data), producing a degraded result without explicit warning that the DB cache was skipped.
- **Evidence**: `backtest-counter-rebalance.ts`: imports `executeBacktestCounterRebalance` directly, no `loadEnvFile()`. 24h test worked (Hyperliquid has sufficient 1m for short windows). 90-day test worked only because `DATABASE_URL` was in `frontend/.env` and script ran from `frontend/` directory. Consistent with memory note: "4626 tsx scripts don't get Vite .env loading."
- **Pass/Fail Criterion**: FAIL until `loadEnvFile()` is called at the top of the CLI script, or a warning is emitted when `DATABASE_URL` is not found and window exceeds 7 days.
- **Recommended Fix**: Add `loadEnvFile()` at the top of the CLI script. Optionally emit a warning when `DATABASE_URL` is not found and the window exceeds 24*7 hours.
- **Launch Impact**: Low — operational hardening. Does not produce incorrect results under normal operation (when run from `frontend/` with `.env` present).

### BACKTEST-004

- **ID**: BACKTEST-004
- **Severity**: P2
- **Domain**: Backtest — API trims stdout to 8000 chars
- **Launch decision**: monitor
- **Finding**: The API handler trims `result.stdout` to the last 8000 characters before returning to the client. For large sweep outputs (135 rows × ~200 chars = ~27,000 chars), the top-ranked configurations are truncated and only the last ~40 rows are visible in `stdout`. The full sweep data is available via `sweepFile` field and the separate `_backtest-sweep` endpoint, so this is a UX issue, not data loss.
- **Evidence**: `_backtest-run.ts:77-80` (`trimOutput`), `:163` (`trimmedStdout`). Arena UI reads `payload.data.stdout` (Arena.tsx:1021) but also calls `sweep.refetch()` to load the full CSV (Arena.tsx:1037).
- **Pass/Fail Criterion**: PASS (UX issue — full data accessible via sweep endpoint. Not a correctness bug.)
- **Recommended Fix**: Return only the top-N rows in `stdout` instead of tail-truncating, or increase limit to 16,000 chars.
- **Launch Impact**: Low — UX issue, not data loss.

### UX-001

- **ID**: UX-001
- **Severity**: P2
- **Domain**: UX — waitlist status conflation
- **Launch decision**: monitor
- **Finding**: The waitlist card shows "Confirmed" status badge, "You are on the list" heading, and "Enter app" button linking to `/swap` when `sessionAddress` is present (email OTP verified = waitlist-joined). Per AGENTS.md: "linked / waitlist-joined is not the same as wallet-ready." A user who completed email OTP but not `legacy-owner-install` sees "Confirmed" with no indication that swap execution will be gated. Clicking "Enter app" lands on /swap with a canonical setup gate and no prior warning.
- **Evidence**: `WaitlistFlow.tsx:514-542, 589`: "Confirmed" badge (line 516-519), "You are on the list" heading (line 536), "Enter app" button (line 589). `sessionAddress` sourced from `/api/auth/me` (line 64-73). `Swap.tsx:1108-1109`: `primaryActionHint: 'Finish one-time account setup before canonical swaps can execute'`. Swap page correctly blocks execution — no gate bypass — but status signal is misleading.
- **Pass/Fail Criterion**: PASS if the status badge differentiates waitlist-joined from wallet-ready, or if a secondary status line indicates remaining setup.
- **Recommended Fix**: Use "On the list" instead of "Confirmed" when execution-ready is not achieved, or add "Wallet setup remaining" below the "Enter app" button. Do not change the button (entering the app is correct); change the status framing.
- **Launch Impact**: Low — does not bypass any execution-ready gate. Swap page correctly gates canonical execution regardless of waitlist card status. UX polish, not a safety issue.

### UX-002

- **ID**: UX-002
- **Severity**: P2
- **Domain**: UX — auto-opened login modal on redirect
- **Launch decision**: monitor
- **Finding**: When an unauthenticated user navigates to `app.4626.fun/swap`, they are redirected to /waitlist AND a Privy login modal auto-opens on page load without any user click. Confirmed via live browser inspection: the page rendered both the waitlist card ("Join the launch list") AND a `dialog "log in or sign up"` overlay simultaneously. The modal is dismissible but jarring — the user sees two overlapping surfaces (waitlist card's "Join with email" button AND the auto-opened Privy modal's email input).
- **Evidence**: Live browser snapshot of `app.4626.fun/swap` (unauthenticated) → redirect to /waitlist + auto-opened `dialog "log in or sign up"`. Browser console: 0 JS errors. The modal has a "close modal" button (dismissible).
- **Pass/Fail Criterion**: PASS if the Privy modal does not auto-open on redirect, or if a contextual message explains the redirect before showing the modal.
- **Recommended Fix**: Do not auto-open the Privy modal on redirect. Let the redirected user see the waitlist card and click "Join with email" themselves. If auto-open is intentional for conversion, add a "You were redirected — sign in to continue" message.
- **Launch Impact**: Low — dismissible, no safety/correctness violation. UX polish.

### UX-003

- **ID**: UX-003
- **Severity**: P2
- **Domain**: UX — Arena sidebar invisible on mobile/tablet
- **Launch decision**: monitor
- **Finding**: The Arena navigation sidebar uses `hidden lg:block` (line 248), making it invisible below the `lg` breakpoint (1024px). On mobile phones and small tablets, there is NO way to navigate between Arena sub-pages (Introduction, Status, Chart, Backtest, How-it-works, Positions). No hamburger menu, mobile drawer, or bottom navigation fallback exists. A mobile user landing on `/arena` can only see the Introduction page — they cannot reach Status, Backtest, or Positions without manual URL entry.
- **Evidence**: `Arena.tsx:248`: `hidden lg:block` on sidebar nav. `:290`: `lg:pl-[16rem]` vs `lg:pl-[6rem]` padding adjustment, no mobile nav alternative. Sub-pages: Introduction, Live counter-trade status, View chart, Backtest workspace, How the pieces fit together, Positions — all unreachable below 1024px.
- **Pass/Fail Criterion**: PASS if a mobile navigation affordance exists for Arena sub-pages below `lg`.
- **Recommended Fix**: Add a collapsible hamburger menu, top dropdown, or horizontal scrollable tab bar visible below `lg`.
- **Launch Impact**: Low — mobile users cannot navigate Arena, but Arena is not the primary launch surface. UX functional gap, not a safety issue.

### VG-001

- **ID**: VG-001
- **Severity**: P2
- **Domain**: Validation gate — guard:api-nonv1-hardening FAIL
- **Launch decision**: monitor
- **Finding**: The `guard:api-nonv1-hardening` guard script fails with exit 1. `_backtest-run.ts:114` uses `readJsonBody` instead of `readBoundedJsonObjectBody` for its POST body read — an unbounded body read on a mutating endpoint. This is an additional hardening gap beyond the in-memory rate limit noted in APIAUTH-014. The guard script is the authoritative check for this pattern.
- **Evidence**: `pnpm -C frontend guard:api-nonv1-hardening` exit 1. Error: "Mutating v1 handlers must use readBoundedJsonObjectBody: api/_handlers/v1/alfaclub/_backtest-run.ts:114." Pre-existing failure — no code changed in any audit shard.
- **Pass/Fail Criterion**: FAIL until `_backtest-run.ts:114` uses `readBoundedJsonObjectBody(req, { maxBytes: ... })` instead of `readJsonBody(req, ...)`.
- **Recommended Fix**: Replace `readJsonBody` with `readBoundedJsonObjectBody` at line 114 of `_backtest-run.ts`.
- **Launch Impact**: Low — hardening gap on an authenticated endpoint. Not a launch blocker. Cross-ref APIAUTH-014.

---

## P3 — Low

### APIAUTH-002

- **ID**: APIAUTH-002
- **Severity**: P3
- **Domain**: API auth — no rate limit on DB-heavy admin GET
- **Launch decision**: accepted risk
- **Finding**: `GET /api/auth/admin` performs admin-status lookup via `getSessionAddress(req)` and `lookupAdminContextByWallet(address)` (up to 4 DB queries). No rate limit. Read-only: returns `{ address, isAdmin: boolean }`. Admin privilege inheritance via linked wallets and email is by-design.
- **Evidence**: `auth/_admin.ts`: no `checkRateLimit`, `RATE_LIMITS`, `rateLimitKey`, or `Retry-After` in file. Uses `getSessionAddress` (session snapshot), not fresh Privy verification.
- **Pass/Fail Criterion**: FAIL until rate limit keyed by session address and/or IP is added.
- **Recommended Fix**: Add `checkRateLimit(rateLimitKey('auth-admin', getClientIp(req)), RATE_LIMITS.authRead)` at top of handler.
- **Launch Impact**: Not a launch blocker. Read-only with session auth. Missing rate limit is defense-in-depth.

### APIAUTH-005

- **ID**: APIAUTH-005
- **Severity**: P3
- **Domain**: API waitlist — no rate limit on read-only GETs
- **Launch decision**: accepted risk
- **Finding**: `waitlist/_stats.ts` (PUBLIC, no auth, no rate limit — runs `SELECT COUNT(*) FROM profiles WHERE email IS NOT NULL`), `waitlist/_me.ts` (auth-optional, no rate limit — 3 DB queries), and `waitlist/_leaderboard.ts` (auth-optional, no rate limit — paginated DB query) all lack rate limits. `_stats` is the most concerning — fully public with no auth gate and no rate limit, making it the easiest DB-load amplification vector.
- **Evidence**: All three files: no `checkRateLimit`, `RATE_LIMITS`, `rateLimitKey`, or `Retry-After`. Contrast: `waitlist/_position.ts`, `_pointsActivity.ts`, `_referrer.ts` all enforce in-memory 60/min per IP.
- **Pass/Fail Criterion**: FAIL until all three enforce a rate limit (in-memory acceptable for read-only).
- **Recommended Fix**: Add `checkRateLimit(rateLimitKey('waitlist-stats', getClientIp(req)), { windowMs: 60_000, maxRequests: 60 })` to each, matching the pattern in `_position.ts`.
- **Launch Impact**: Not a launch blocker. Read-only with minimal information disclosure. Defense-in-depth gap.

### APIAUTH-010 (merged with WALLET-003)

- **ID**: APIAUTH-010 (also WALLET-003 — merged)
- **Severity**: P3
- **Domain**: API wallet — in-memory IP-only rate limits on wallet mutation POSTs
- **Launch decision**: accepted risk
- **Finding**: All four wallet mutation endpoints (`_sync`, `_confirm-owner`, `_prepare-add-privy-owner`, `_disconnect-external`) use `checkRateLimit` (in-memory, IP-only) with `RATE_LIMITS.cswLink`. Same durable-limiter gap as APIAUTH-004. In-memory limiter resets per cold start. IP-only keying means NAT/proxy users share a budget.
- **Evidence**: `_sync.ts:60`: in-memory, IP-only. `_confirm-owner.ts:68`: same. `_prepare-add-privy-owner.ts:54`: same. `_disconnect-external.ts:43`: same. All require Privy auth via `resolveAuthorizedRequestPrincipal` or `verifyPrivyForAccounts`. Validation gate VG-002 confirms test failure on `/wallet/sync` (returns 401 instead of 429 — auth check fires before rate limit check).
- **Pass/Fail Criterion**: FAIL until wallet mutation endpoints use `checkDurableRateLimit` with `failClosed: true` keyed by Privy user ID + IP.
- **Recommended Fix**: Replace `checkRateLimit` with `checkDurableRateLimit(... { failClosed: true })`, keyed by `privyUserId + ip`. Match `auth/_verify.ts` pattern.
- **Launch Impact**: Not a launch blocker (all require auth). Should be remediated before public launch for defense-in-depth.

### APIAUTH-011

- **ID**: APIAUTH-011
- **Severity**: P3
- **Domain**: API deploy — in-memory rate limits on deploy session POSTs
- **Launch decision**: accepted risk
- **Finding**: Deploy session handlers (`_start`, `_cancelCore`, `_dryRunCore`, `_statusCore`) use `checkRateLimit` (in-memory, per auth.address). Same durable-limiter gap as APIAUTH-003. `_statusCore.ts` (internal, invoked by resume workflow) calls `advanceDeploySession` which sends on-chain UserOps. Contrast: `_createCore.ts` (full create) correctly uses `checkDurableRateLimit` with `failClosed`.
- **Evidence**: `_start.ts:134`: in-memory. `_cancelCore.ts:148`: in-memory. `_dryRunCore.ts:2097`: in-memory. `_statusCore.ts:2810+`: in-memory. `_createCore.ts`: `checkDurableRateLimit` with `failClosed: true`. Mitigating: all require auth, `_dryRunCore.ts` is local-fork-only, `_cancelCore.ts` validates calls via `validateSponsoredSmartWalletCalls`.
- **Pass/Fail Criterion**: FAIL until deploy session handlers use `checkDurableRateLimit` with `failClosed: true` keyed by auth.address.
- **Recommended Fix**: Replace `checkRateLimit` with `checkDurableRateLimit(... { failClosed: true })` keyed by `auth.address`. Match `_createCore.ts` pattern.
- **Launch Impact**: Not a launch blocker (all require auth). Should be remediated before public launch.

### APIAUTH-012

- **ID**: APIAUTH-012
- **Severity**: P3
- **Domain**: API deploy — session cookie HMAC as sole auth (known debt)
- **Launch decision**: accepted risk
- **Finding**: `loadAuthorizedDeploySession` authenticates deploy session access solely via the 7-day session cookie HMAC. The code contains an explicit comment (FINDING-09) acknowledging this is insufficient: a stolen session cookie can control active deploys (resume, cancel, status) without proving wallet ownership. The 45-minute deploy TTL limits the abuse window, but the session cookie itself is valid for 7 days.
- **Evidence**: `_sessionAccess.ts:60-64`: FINDING-09 comment. Mitigating: 45-min deploy TTL, HTTP-only + SameSite cookies. The finding is already documented in code.
- **Pass/Fail Criterion**: FAIL until deploy-critical operations (resume, cancel) require a fresh proof of wallet ownership in addition to the session cookie.
- **Recommended Fix**: For `resume` and `cancel`, require a fresh Privy JWT (validated within last 5 minutes) in addition to session cookie. Reject stale JWTs even if session cookie is valid.
- **Launch Impact**: Not a launch blocker (45-min TTL + HTTP-only cookies provide baseline). Should be remediated for higher-assurance deploy flows.

### APIAUTH-013

- **ID**: APIAUTH-013
- **Severity**: P3
- **Domain**: API Telegram — in-memory IP-only rate limit on link completion
- **Launch decision**: accepted risk
- **Finding**: `telegram/_link-complete.ts` uses `checkRateLimit` (in-memory, IP-only) with `RATE_LIMITS.telegramLinkWrite`. Same durable-limiter gap as APIAUTH-006. The endpoint is heavy: Privy verify + multiple DB schema ensures + syncEmailIdentity + syncUserWallets + Telegram session verification + link token claim/consume + merge preflight + provider link record + telegram user link upsert.
- **Evidence**: `_link-complete.ts:68-75`: in-memory, IP-only. Mitigating: Privy auth required, Telegram session proof verified, link token single-use/claim-bound/consumed on success, merge preflight prevents silent cross-account conflicts, bounded body (16KB).
- **Pass/Fail Criterion**: FAIL until `checkDurableRateLimit` with `failClosed: true` keyed by `privyUserId + ip`.
- **Recommended Fix**: Replace `checkRateLimit` with `checkDurableRateLimit(... { failClosed: true })` keyed by `privyUserId + ip`. Match `auth/_verify.ts` pattern.
- **Launch Impact**: Not a launch blocker (auth + session proof + token consumption provide strong access control).

### APIAUTH-015

- **ID**: APIAUTH-015
- **Severity**: P3
- **Domain**: API chat — in-memory rate limits on chat/media mutations
- **Launch decision**: accepted risk
- **Finding**: Three chat handlers (`_hermit`, `_hermit-meme-save`, `_hermit-meme-delete`) use in-memory `checkRateLimit` with no durable fallback. Auth is session-based in all three. `_hermit` requires `isHermitUserAllowed` (allowlist) and blocks keeper write commands. Meme save/delete check `isHermitOwner` + `isHermitRoomAllowedForOwner` before DB writes, and delete passes `ownerAddress` for owner-scoped queries.
- **Evidence**: `_hermit.ts:57-64`: in-memory. `_hermit-meme-save.ts:59-66`: in-memory. `_hermit-meme-delete.ts:51-58`: in-memory. All session auth + owner-scoped.
- **Pass/Fail Criterion**: FAIL (defense-in-depth — durable limiter recommended but blast radius is small).
- **Recommended Fix**: Add `checkDurableRateLimit` with `failClosed: true` for consistency with the durable-limiter standard.
- **Launch Impact**: Low. Blast radius limited to Hermit-allowlisted users (small set). Owner-scoping is correct.

### APIAUTH-017

- **ID**: APIAUTH-017
- **Severity**: P3
- **Domain**: API AlfaClub — in-memory rate limits on CRON_SECRET/admin endpoints
- **Launch decision**: accepted risk
- **Finding**: Four AlfaClub cron/admin endpoints (`_run`, `_chat-token`, `_chat-token-refresh`, `_chat-bridge-run`) use in-memory `checkRateLimit`. All require CRON_SECRET (machine auth) or admin session. `_chat-token.ts` handles sensitive credential material (stores Privy JWT, access/refresh tokens) but GET correctly returns only fingerprints.
- **Evidence**: All four: in-memory `checkRateLimit` with `adminAction` limit. `_chat-token.ts`: GET returns fingerprints only, POST validates JWT shape, checks `assertRefreshTokenSeedAllowed`.
- **Pass/Fail Criterion**: FAIL (defense-in-depth — durable limiter recommended but caller set is restricted).
- **Recommended Fix**: Add `checkDurableRateLimit` for consistency. Low priority given restricted caller set.
- **Launch Impact**: Low. Machine auth or admin session required. A compromised CRON_SECRET would already grant full access.

### APIAUTH-018

- **ID**: APIAUTH-018
- **Severity**: P3
- **Domain**: API build — in-memory rate limits on build-only calldata endpoints
- **Launch decision**: accepted risk
- **Finding**: Four build handlers (`_submitBid`, `_vote`, `_lock`, `_borrow`) use in-memory `checkRateLimit`. All authenticated via `guardAgentApiRequest` (build kind). All are build-only — encode calldata via `encodeFunctionData` and return to client; no server-side chain mutation. `_submitBid` and `_borrow` accept client-provided `owner`/`borrower` fields without validating against auth address, but this is acceptable for build-only (on-chain checks enforce sender = owner/borrower at execution).
- **Evidence**: All four: in-memory `checkRateLimit` with respective limits. All `guardAgentApiRequest` auth. All build-only (no chain mutation).
- **Pass/Fail Criterion**: FAIL (defense-in-depth — durable limiter recommended but cost is only calldata encoding).
- **Recommended Fix**: Add `checkDurableRateLimit` for consistency. Low priority given build-only nature.
- **Launch Impact**: Low. Build-only endpoints with no server-side mutation.

### APIAUTH-019

- **ID**: APIAUTH-019
- **Severity**: P3
- **Domain**: API agents — in-memory rate limits on agent management endpoints
- **Launch decision**: accepted risk
- **Finding**: Three agent management endpoints (`_enable`, `_provisionWallet`, `_setAgentWallet`) use in-memory `checkRateLimit`. All authenticated via `guardAgentApiRequest`. All perform server-side ownership resolution (resolve canonical CSW, validate against principal, validate requested address against allowed targets). `_enable` and `_provisionWallet` perform DB writes (getOrCreate pattern — idempotent). `_setAgentWallet` is build-only (returns EIP-712/calldata, no chain mutation).
- **Evidence**: All three: in-memory `checkRateLimit`. All `guardAgentApiRequest` auth + server-side ownership resolution. P0 criterion for "financial mutation without server-side ownership" NOT met.
- **Pass/Fail Criterion**: FAIL (defense-in-depth — durable limiter recommended but ownership gates prevent cross-user abuse).
- **Recommended Fix**: Add `checkDurableRateLimit` for consistency. Low priority given ownership validation.
- **Launch Impact**: Low. Authenticated + ownership validated. Blast radius limited to own account.

### WALLET-002

- **ID**: WALLET-002
- **Severity**: P3
- **Domain**: Canonical CSW execution signer policy / defense-in-depth
- **Launch decision**: accepted risk
- **Finding**: `assertCanonicalPolicyContext` checks `isAllowedCanonicalSigner` (broader set: canonical CSW + all owner EOAs) for `sendCalls` and `canonicalDirect` paths, but only `sendViaCanonical4337` adds the stricter `isAllowedCanonicalCswExecutionSigner` hard block. The gap becomes exploitable only if a future owner EOA is added to `CANONICAL_CSW_ALLOWED_OWNER_EOAS` without also adding it to `CANONICAL_CSW_EXECUTION_OWNER_ADDRESSES`. On-chain `isOwner` check is the ultimate enforcement for `canonicalDirect`.
- **Evidence**: `txRouter.ts:383`: `isAllowedCanonicalSigner` (broader). `txRouter.ts:700`: `isAllowedCanonicalCswExecutionSigner` (stricter, only canonical4337). Currently the two allowlists' only difference is identical — no signer can currently bypass. Comment at `canonicalWalletPolicy.ts:29-30` instructs adding to both.
- **Pass/Fail Criterion**: FAIL if `assertCanonicalPolicyContext` checks `isAllowedCanonicalCswExecutionSigner` when canonical identity is `CANONICAL_CSW_ADDRESS`.
- **Recommended Fix**: In `assertCanonicalPolicyContext`, after resolving `canonicalIdentity`, add: `if (isCanonicalCsw(canonicalIdentity) && !isAllowedCanonicalCswExecutionSigner(context.signerAddress)) throw new Error(...)`.
- **Launch Impact**: Low. No current exploitable gap. Defense-in-depth hardening before adding new owner EOAs.

### WALLET-004

- **ID**: WALLET-004
- **Severity**: P3
- **Domain**: Wallet sync / primary_wallet column precedence
- **Launch decision**: accepted risk
- **Finding**: `resolveProfilesPrimaryWalletColumn` requires `canonical && embedded` to return `embedded`. When canonical is absent but embedded is present, the third branch returns `activeOwner ?? embedded` — the external EOA wins over embedded. This contradicts the function's own comment and `disconnectExternalWallet`'s `nextPrimary` logic (which prioritizes embedded unconditionally). Result: `profiles.primary_wallet` flip-flops between external EOA and embedded EOA when canonical setup is incomplete.
- **Evidence**: `disconnectExternalWallet.ts:32`: `if (input.canonical && input.embedded) return input.embedded` — requires canonical. `:75`: `const nextPrimary = embedded ?? canonical ?? ...` — does not require canonical.
- **Pass/Fail Criterion**: FAIL if `resolveProfilesPrimaryWalletColumn` returns `embedded` when embedded is present, regardless of canonical.
- **Recommended Fix**: Change third branch to `return input.embedded ?? input.activeOwner ?? input.classificationPrimary ?? null`.
- **Launch Impact**: Low. `primary_wallet` is legacy display/lookup, not execution address. Flip-flop is cosmetic — does not affect swap routing or custody.

### RACE-002

- **ID**: RACE-002
- **Severity**: P3
- **Domain**: Swap execution / ERC-4337 nonce coordination
- **Launch decision**: accepted risk
- **Finding**: `readAnyPendingUserOpHashForWallet` reads from `sessionStorage` (per-tab). Tab A's pending UserOp hash is not visible to Tab B. Both tabs can submit UserOps concurrently with potentially conflicting nonces. The CDP paymaster/bundler is the final arbiter — it rejects the second UserOp with a nonce error. No double-spend possible.
- **Evidence**: `coinbaseErc4337.ts:809-851`: `readAnyPendingUserOpHashForWallet` uses sessionStorage. `useSwapExecution.ts:2724-2731`: receipt polling with AbortController (handles stale completions within single tab). Bundler enforces nonce ordering.
- **Pass/Fail Criterion**: PASS if cross-tab concurrent swaps are either coordinated or safely rejected. Currently PASS (bundler rejection prevents fund loss) — FAIL for UX (confusing error on second tab).
- **Recommended Fix**: Use `BroadcastChannel` or `localStorage` storage event to share pending UserOp hashes across tabs for the same smart wallet. Alternatively, document as known limitation and rely on bundler rejection.
- **Launch Impact**: Low. Multi-tab swap from same CSW is an edge case. Bundler rejection prevents fund loss. UX impact is a confusing error message.

### RACE-003

- **ID**: RACE-003
- **Severity**: P3
- **Domain**: Identity / email collision profile merge
- **Launch decision**: accepted risk
- **Finding**: `mergePlaceholderProfiles` does `SELECT id FROM profiles WHERE privy_user_id = ... AND id <> targetProfileId` then iterates rows performing individual UPDATEs. Not wrapped in `BEGIN/COMMIT`. Between SELECT and UPDATEs, another concurrent adoption could modify the same placeholder rows. The `ON CONFLICT DO NOTHING` patterns and idempotent UPDATEs provide informal safety. `assertNoEmailPrivyCollision` blocks cross-user collisions.
- **Evidence**: `emailCollisionAdoption.ts:109-123`: SELECT then iterate UPDATE, no transaction wrapper. `_bootstrap.ts:39`: caller (no transaction wrapper). `walletSync.ts:38-50`: `withDbTransaction` helper exists but is not used here.
- **Pass/Fail Criterion**: FAIL if `mergePlaceholderProfiles` is not wrapped in a DB transaction. Currently FAIL (no transaction) but informal safety via idempotent operations.
- **Recommended Fix**: Wrap `mergePlaceholderProfiles` call in `withDbTransaction` (helper already exists in `walletSync.ts:38-50`).
- **Launch Impact**: Low. Scenario requires same Privy user triggering two concurrent bootstraps — rare edge case. Idempotent UPDATEs provide informal safety.

### RACE-004

- **ID**: RACE-004
- **Severity**: P3 (informational)
- **Domain**: AlfaClub counter-trade / multi-actor enforcement
- **Launch decision**: accepted risk
- **Finding**: `listActiveCounterTradeOptIns` returns active opt-ins, then `enforceSingleActiveCounterTradeActor` pauses all but the first. If an opt-in becomes active between the list and the enforcement, it will not be paused until the next tick. The `inFlight` boolean guard ensures only one tick runs at a time. The enforcement is idempotent and runs every tick. Any missed opt-in is caught on the next tick.
- **Evidence**: `counterTradeRunner.ts:126-143`: list then enforce, no lock between. `counterTradeTicker.ts:107`: `inFlight` boolean guard with `finally` cleanup. `spotSweepAttempted` Set prevents double-sweeps within a tick.
- **Pass/Fail Criterion**: PASS (informational — the inFlight guard and idempotent enforcement make this self-healing).
- **Recommended Fix**: None required. Self-correcting by design.
- **Launch Impact**: None. Benign TOCTOU that is self-correcting.

### BACKTEST-005

- **ID**: BACKTEST-005
- **Severity**: P3 (informational)
- **Domain**: Backtest — interval degradation display labeling
- **Launch decision**: accepted risk
- **Finding**: The Arena UI correctly surfaces `resolvedInterval` from the API. The 90-day coarse case (`1h` bars) gets an explicit amber warning banner. However, intermediate degradation cases (1m → 5m or 1m → 15m) only show the resolved interval label ("5-minute" / "15-minute") without explaining that the 1m cache was insufficient. `dataQuality.coveragePct` and `dataQuality.source` badges provide indirect signal but no explicit "degraded from 1m" callout.
- **Evidence**: `Arena.tsx:64-79`: `describeLastRunBarSize`. `ArenaBacktestAnalysis.tsx:145-195`: series analysis UI with amber warning for `1h` only.
- **Pass/Fail Criterion**: PASS (informational — data is honest, resolved interval always reported).
- **Recommended Fix**: Add a subtle "(degraded from 1m — cache coverage was {coveragePct}%)" suffix when `resolvedInterval !== '1m'` and requested interval was `'auto'` or `'1m'`.
- **Launch Impact**: None. Informational — data is honest.

### UX-004

- **ID**: UX-004
- **Severity**: P3
- **Domain**: UX — no global sign-out in app shell
- **Launch decision**: accepted risk
- **Finding**: Sign-out is available only in scoped panels: waitlist card (`WaitlistFlow.tsx:597`), `CanonicalIdentityCard.tsx:301`, `AddOwnerConnectionStatusPanel.tsx:140`, `BaseAppCanonicalWalletLinkPanel.tsx:95`, `AdminLayout.tsx:157`. No global account header, dropdown, or tray with "Sign out" accessible from any authenticated page (e.g., `/swap`, `/arena`). A user on `/swap` who wants to switch accounts must navigate to a specific settings page.
- **Evidence**: Search for `signOut|logout` in `frontend/src`: 50 matches, all in contextual panels. No `AccountTray`/`AccountMenu`/`UserMenu` files found. No global account menu in layout.
- **Pass/Fail Criterion**: PASS if a global account menu with sign-out is visible on all authenticated app-shell pages. Currently FAIL.
- **Recommended Fix**: Add a global account menu (header avatar/dropdown or settings link) with "Sign out" on all authenticated app-shell pages. Low priority for launch.
- **Launch Impact**: Low. Relevant for multi-account testing and user trust, not a safety issue.

### UX-005

- **ID**: UX-005
- **Severity**: P3
- **Domain**: UX — deploy error boundary replaces phase context
- **Launch decision**: accepted risk
- **Finding**: When a React render error occurs during deploy, `DeployVaultErrorBoundary` replaces the entire deploy view with "Something went wrong" + generic sanitized message + Retry. The `PhaseTimeline` with phase-specific status badges is unmounted and lost. For a multi-phase deploy, this removes all visual context about which phase was in progress. Only affects React render crashes, not deploy transaction failures — dry-run and on-chain failures DO preserve phase context via `PhaseCard` badges.
- **Evidence**: `DeployVault.tsx:874-920`: error boundary. `:907`: "Something went wrong". `:909`: generic sanitized message. `:917`: Retry button. `:901`: raw error text dev-only (`import.meta.env.DEV`). Normal flows: `PhaseCard` state + `dryRunPhaseStatusByName` badges (line 6329, 6419-6422) preserve context.
- **Pass/Fail Criterion**: PASS if PhaseTimeline is preserved above the error boundary fallback, or if last-known phase state is included in the error fallback.
- **Recommended Fix**: Preserve PhaseTimeline above the error boundary fallback, or include last-known phase state in the error fallback view. Low priority — render crashes are rare.
- **Launch Impact**: Low. Edge case only. Normal transaction failures preserve phase context.

### VG-002

- **ID**: VG-002
- **Severity**: P3
- **Domain**: Validation gate — accountsWalletRateLimitHardening test FAIL (3/3)
- **Launch decision**: accepted risk
- **Finding**: The vitest suite `accountsWalletRateLimitHardening.test.ts` fails all 3 tests. `/accounts/link` and `/accounts/unlink` return 503 (DB not configured in test env) instead of 429 when rate-limited — the handler returns 503 before the rate limit check, or the mock setup does not match the handler's DB dependency path. `/wallet/sync` returns 401 (auth check fires before rate limit check) instead of 429. Pre-existing failures — no code changed in audit.
- **Evidence**: `pnpm -C frontend exec vitest run api/__tests__/accountsWalletRateLimitHardening.test.ts` exit 1. Errors: expected 429, received 503 (link/unlink) or 401 (sync). Relates to APIAUTH-004 and APIAUTH-010.
- **Pass/Fail Criterion**: FAIL until tests pass or are updated to match handler behavior (rate-limit check ordering, DB mock setup).
- **Recommended Fix**: Either fix the rate-limit check ordering so 429 is returned before DB/auth failures, or update the test expectations to match the current handler ordering (auth → rate limit → DB).
- **Launch Impact**: Low — test infrastructure issue, not a production bug. The handlers work correctly in production (DB is configured). Cross-ref APIAUTH-004, APIAUTH-010.

### VG-003

- **ID**: VG-003
- **Severity**: P3
- **Domain**: Validation gate — paymasterRateLimit test FAIL (1/1)
- **Launch decision**: accepted risk
- **Finding**: The vitest suite `paymasterRateLimit.test.ts` fails its single test. The paymaster handler returns JSON-RPC error code `-32000` (generic server error) instead of `-32005` (rate-limit specific) when the limiter rejects. The rate-limit rejection path does not use the expected error code mapping. Pre-existing failure — no code changed in audit.
- **Evidence**: `pnpm -C frontend exec vitest run api/__tests__/paymasterRateLimit.test.ts` exit 1. Error: expected -32005, received -32000. Relates to APIAUTH-008.
- **Pass/Fail Criterion**: FAIL until the paymaster rate-limit rejection path returns `-32005` (rate-limit specific JSON-RPC error code) instead of `-32000` (generic).
- **Recommended Fix**: Map the rate-limit rejection to JSON-RPC error code `-32005` in the paymaster handler's rate-limit catch path.
- **Launch Impact**: Low — error code mismatch, not a security bypass. The rate limit still fires; only the error code is wrong. Cross-ref APIAUTH-008.

---

## Positive Findings (verified safe)

These were checked during the audit and confirmed safe. No finding issued.

| ID | Domain | Verification |
|----|--------|-------------|
| LAUNCH-004 | Deploy dry-run 403 PASS gate | HTTP 403 "Creator token authority mismatch" correctly returned and treated as PASS. Full plumbing chain verified. |
| LAUNCH-005 | Legacy dev-bypass header | `x-deploy-dry-run-dev` header fully rejected (401). No bypass surface in production code. Test locks in rejection. |
| LAUNCH-006 | Deploy status/preflight read-only | `_status.ts` and `_solanaInfraStatus.ts` are strictly read-only. `_statusCore.ts` mutations are in `_resume.ts` execution path only, correctly separated. |
| LAUNCH-007 | Dry-run local-fork-only | `_dryRunCore.ts:2122` rejects non-local-fork RPC. All `sendTransaction` and fork manipulation calls go to Anvil fork only. |
| LAUNCH-008 | Typecheck + lint | `pnpm -C frontend typecheck` exit 0. `pnpm -C frontend lint` exit 0. Both clean. |

### Patterns verified as safe (no finding)

1. Deploy session lease acquisition (`claimDeploySessionLease`) — atomic optimistic lease.
2. Telegram link-start token consumption — atomic INSERT/UPDATE with `WHERE consumed_at IS NULL`.
3. Counter-trade event dedup — atomic `INSERT ... ON CONFLICT DO NOTHING`.
4. `useSiweAuth` shared session fetch — in-flight Promise deduplication.
5. KPR runner — single-workflow CLI, no concurrency.
6. Solana keeper orchestrator — stateless HTTP dispatch.
7. Counter-trade ticker overlap guard — `inFlight` boolean with `finally`.
8. Deploy session transition CAS — `WHERE step = fromStep RETURNING id`.
9. `walletSync.ts withDbTransaction` — proper BEGIN/COMMIT with rollback.
10. Swap submit epoch ref — `swapSubmitEpochRef` + `swapReceiptPollRef` AbortController.

---

## Validation gate summary

| # | Gate | Exit | Result | Related finding |
|---|------|------|--------|-----------------|
| 1 | guard:api-readjsonbody-maxbytes | 0 | PASS | — |
| 2 | guard:api-rate-limit-guards | 0 | PASS | — |
| 3 | guard:api-429-retry-after | 0 | PASS | — |
| 4 | guard:api-nonv1-hardening | 1 | FAIL | VG-001 / APIAUTH-014 |
| 5 | vitest accountsWalletRateLimitHardening | 1 | FAIL (3/3) | VG-002 / APIAUTH-004, APIAUTH-010 |
| 6 | vitest authRateLimitHardening | 0 | PASS (7/7) | — |
| 7 | vitest deployRateLimitHardening | 0 | PASS (3/3) | — |
| 8 | vitest paymasterRateLimit | 1 | FAIL (1/1) | VG-003 / APIAUTH-008 |
| 9 | pnpm -C frontend lint:a11y | 0 | PASS | — |
| 10 | pnpm -C frontend smoke:a11y -- --serve | 0 | PASS | — |
| 11 | pnpm -C frontend typecheck | 0 | PASS | — |
| 12 | pnpm -C frontend lint | 0 | PASS | — |
| 13 | forge test | 0 | PASS (72 tests) | — |
| 14 | pnpm -C frontend test | 0 | PASS (289 tests) | — |

3 of 14 gates failed (gates 4, 5, 8). All 3 failures are pre-existing — no code was modified in any audit shard. The failures provide additional evidence for existing APIAUTH findings and are tracked as VG-001 through VG-003.

---

## Cross-finding notes

1. **DRIFT-001 through DRIFT-004 share a common root cause**: the sub-account execution model was superseded by the parent-CSW legacy-owner-install model, but 4 docs were not updated. All 4 are docs-only — the implementation correctly uses parent CSW + canonical4337. All 4 remediated and verified clean 2026-06-27.

2. **LAUNCH-001 is independent of DRIFT-001–004**: the DNS issue is external infrastructure, unrelated to the docs drift. Both must be resolved before launch, but they can be remediated in parallel by different owners (ops/infra vs docs).

3. **The in-memory rate-limit pattern is systemic**: APIAUTH-003, 004, 006, 008, 009, 010, 011, 013, 014, 015, 017, 018, 019 all share the same root pattern — `checkRateLimit` (in-memory, per-isolate) instead of `checkDurableRateLimit` (Postgres-backed, fail-closed). The AMOE lottery handlers and `auth/_verify.ts` / `auth/_privy.ts` / `deploy/_createCore.ts` demonstrate the correct durable pattern. A single sweep to replace in-memory with durable limiters on all mutating/auth-adjacent endpoints would close 13 of 19 APIAUTH findings.

4. **No P0/P1 findings in WALLET or RACE namespaces**: all WALLET findings (001–004) are P3 or P2. All RACE findings (001–004) are P3 or P2. No race condition was found that could cause fund loss, account takeover, or double-spend.

5. **No UX finding blocks launch**: all UX findings (001–005) are P2 or P3. No finding indicates a safety/correctness violation. The waitlist status conflation (UX-001) is the most user-impactful but does not bypass any execution-ready gate.

6. **No credentials, tokens, or secrets are present in this report.**

---

## Audit finalization

- **Date finalized**: 2026-06-27
- **Total findings**: 48 (including 3 validation-gate findings, excluding 5 positive findings)
- **Active launch blockers**: 1 (LAUNCH-001)
- **Remediated and verified**: 4 (DRIFT-001 through DRIFT-004)
- **Fix-before-launch (non-blocking)**: 1 (APIAUTH-001)
- **Followups tracked**: see `deep-risk-audit-2026-06-followups.md`
- **No product/code fixes applied** — audit-only mode throughout.
