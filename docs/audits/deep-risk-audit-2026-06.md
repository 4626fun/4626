# 4626 Deep Risk Audit — Canonical Final Report

Date: 2026-06-27
Mode: audit-only consolidation — no product/code fixes applied
Repository: `/home/akitav2/projects/4626`
Branch confirmed before edits: `audit/deep-risk-2026-06`
Pre-edit command: `git status --short --branch` → `## audit/deep-risk-2026-06` with one pre-existing tracked modification (`frontend/scripts/dev-deploy-dry-run.sh`) and unrelated untracked files. No implementation code was patched for this consolidation.

## Sources merged

- `docs/_internal/audits-workpapers/deep-risk-audit-2026-06.md` — primary audit workpaper with APIAUTH/WALLET/RACE/DRIFT/LAUNCH/BACKTEST/UX findings.
- `docs/_internal/audits-workpapers/deep-risk-audit-2026-06-endpoint-matrix.md` — endpoint inspection matrix.
- `docs/_internal/audits-workpapers/deep-risk-audit-2026-06-validation-log.md` — validation log and gate output history.
- Existing public audit docs in `docs/audits/` were treated as draft targets and overwritten/updated into the canonical public report set.

No new broad audit was run. This report only merges, deduplicates, severity-normalizes, and risk-orders already documented findings. Additional source lookups during consolidation were limited to locating current moved doc/script paths so stale path references were not copied forward.

## Severity scale

| Level | Meaning |
|-------|---------|
| P0 | Critical — active launch blocker, fund loss risk, direct security bypass, or anonymous mutation. |
| P1 | High — serious correctness/security gap that could cause a P0 under specific conditions, or canonical docs drift likely to induce wrong launch behavior. |
| P2 | Medium — pre-launch hardening, data-integrity, cost-amplification, operational, or functional UX issue without direct fund loss/security bypass. |
| P3 | Low — accepted risk, defense-in-depth, informational, or backlog UX polish. |

## Deduplication and merge notes

1. `BACKTEST-001` is merged into `APIAUTH-016` because both identify the same four unauthenticated read-only backtest GET endpoints. `APIAUTH-016` is retained as the primary ID with BACKTEST cross-reference.
2. `WALLET-003` is merged into `APIAUTH-010` because both identify the same four wallet handler endpoints using in-memory IP-only rate limits. `APIAUTH-010` is retained as the primary ID with WALLET cross-reference.
3. `VG-001`, `VG-002`, and `VG-003` are not duplicates of APIAUTH findings. They are validation-gate failures promoted to standalone findings and cross-referenced to the APIAUTH item they validate.
4. `LAUNCH-004` through `LAUNCH-008` are positive findings, not risks, and are listed separately.
5. Route-map-only coverage gaps (keepr/uniswap/wallet.solana remaining routes and remaining v1 route-map entries) were not promoted to findings because they were enumerated but not deep-inspected; that is a coverage limitation, not evidence of a defect.

## Executive summary

| Severity | Count | Active launch-blocking |
|----------|-------|------------------------|
| P0 | 2 (1 active, 1 remediated) | 1 (`LAUNCH-001`) |
| P1 | 3 (all remediated) | 0 |
| P2 | 22 | 0 |
| P3 | 21 | 0 |
| **Total findings** | **48** | **1** |

Active P0 blocker: `LAUNCH-001` only. `DRIFT-001` through `DRIFT-004` were remediated and verified clean before this consolidation. `APIAUTH-001` is the highest-risk non-blocking fix-before-launch item.

Final launch recommendation: **unsafe to launch now** because `LAUNCH-001` is an active P0 external DNS/infra blocker. After `LAUNCH-001` passes production prelaunch verification, the codebase is **safe only after listed launch-path fixes** for public launch: at minimum fix/accept `APIAUTH-001`, and schedule the P2/P3 hardening followups.

---

## Globally risk-ordered findings

## P0 — Critical

### LAUNCH-001

- **ID**: LAUNCH-001
- **Severity**: P0
- **Domain**: Vultr orchestrator + provisioner infrastructure / DNS routing
- **Launch decision**: block launch — external DNS/infra-owned until production prelaunch probe passes
- **Exact file path(s)**: `frontend/scripts/verify-akita-prelaunch-readiness.ts`; external DNS records for `orchestrator.4626.fun` and `provisioner.4626.fun`
- **Function / component / route**: Production prelaunch probe routes: `GET /healthz`, `POST /reconcile`, Vercel `/api/keeper/solana/reconcile` upstream checks
- **Trigger or precondition**: Run `pnpm -C frontend ops:verify-akita-prelaunch --production` or curl the orchestrator/provisioner health endpoints.
- **Expected invariant**: Production prelaunch health checks must reach the real Vultr orchestrator/provisioner services and return service JSON before launch.
- **Observed behavior**: Confirmed again 2026-06-27. `orchestrator.4626.fun/healthz` returns HTTP 200 with Vercel SPA `index.html` (`server: Vercel`, `content-disposition: inline; filename="index.html"`, body starts `<!doctype html>`) instead of orchestrator JSON. `provisioner.4626.fun/healthz` returns the same Vercel SPA HTML instead of provisioner JSON. Both hostnames resolve to Vercel IPs `216.150.1.193` and `216.150.16.193`. `POST /reconcile` paths return 405/HTML behavior because they are landing on Vercel, not the orchestrator. Fresh `pnpm -C frontend ops:verify-akita-prelaunch --production` exits 1.
- **Severity rationale**: P0 because it is an active launch-blocking infrastructure failure. No repo code defect identified; DNS prevents required production services from being reachable.
- **Pass/Fail criterion**: PASS when both health endpoints return service JSON (`ok: true` / `payerHealthy: true`) instead of Vercel `index.html`, DNS no longer resolves both service subdomains to Vercel IPs, authenticated orchestrator `/reconcile` probes behave as expected, and `pnpm -C frontend ops:verify-akita-prelaunch --production` exits 0 with no LAUNCH-001 blockers.
- **Minimal remediation recommendation**: External infra only — no repo-side code patch. Verify the Vultr services locally (`solana-keeper-orchestrator` on port 8789 and `solana-route-provisioner` on port 8788), configure nginx/Caddy/Cloudflare Tunnel so `orchestrator.4626.fun` routes to port 8789 and `provisioner.4626.fun` routes to port 8788, update DNS away from Vercel, verify public `/healthz` returns JSON not `index.html`, then rerun `pnpm -C frontend ops:verify-akita-prelaunch --production`.
- **Launch impact**: Unsafe to launch until fixed; all 7 failing prelaunch gates trace to this external DNS root cause.

### DRIFT-001

- **ID**: DRIFT-001
- **Severity**: P0 (remediated)
- **Domain**: Account model / wallet execution path
- **Launch decision**: cleared after remediation/recheck
- **Exact file path(s)**: `frontend/docs/waitlist-accounts-architecture.md`; implementation cross-check `frontend/server/_lib/wallet/executionTrack.ts`
- **Function / component / route**: Docs section around waitlist account architecture line 41; `ExecutionTrack` parent-CSW policy
- **Trigger or precondition**: A developer/operator follows stale waitlist account docs to implement or validate user execution readiness.
- **Expected invariant**: User-initiated canonical execution uses parent CSW + Privy embedded-owner signer; sub-account is only optional flag-gated swap fallback.
- **Observed behavior**: Doc previously stated canonical path was sub-account setup and parent CSW was not the execution address; implementation and repo invariants say the opposite. Remediation changed the doc to parent CSW + `legacy-owner-install` and sub-account fallback language.
- **Severity rationale**: Originally P0 because stale docs could drive launch work onto the wrong execution sender. Remediated and verified, so no active launch risk remains.
- **Pass/Fail criterion**: PASS now: grep for `canonical path is sub-account` or `parent CSW.*not the execution address` returns 0 matches in the actual doc.
- **Minimal remediation recommendation**: None required; remediation verified clean.
- **Launch impact**: No active launch impact; cleared.


## P1 — High

### DRIFT-002

- **ID**: DRIFT-002
- **Severity**: P1 (remediated)
- **Domain**: Account model / readiness gating
- **Launch decision**: cleared after remediation/recheck
- **Exact file path(s)**: `frontend/docs/waitlist-accounts-architecture.md`; repo invariant in `AGENTS.md`
- **Function / component / route**: Waitlist architecture readiness/setup text around lines 43-44
- **Trigger or precondition**: A user flow or developer task uses the doc to decide what completes wallet-ready status after waitlist/email verification.
- **Expected invariant**: Readiness for the user-initiated canonical track means parent CSW recorded, embedded EOA present, and embedded EOA confirmed as parent-CSW owner.
- **Observed behavior**: Doc previously said to resume sub-account setup and gate on sub-account persisted + signer configured. Remediation changed it to embedded-owner signing setup for the canonical parent CSW.
- **Severity rationale**: P1 because wrong readiness guidance could gate legitimate users incorrectly or route setup work to the wrong track. Remediated.
- **Pass/Fail criterion**: PASS now: grep for `resume sub-account setup` or `sub-account persisted.*signer configured` returns 0 matches.
- **Minimal remediation recommendation**: None required; remediation verified clean.
- **Launch impact**: No active launch impact; cleared.

### DRIFT-003

- **ID**: DRIFT-003
- **Severity**: P1 (remediated)
- **Domain**: Account model / execution path
- **Launch decision**: cleared after remediation/recheck
- **Exact file path(s)**: `docs/_internal/4626-connection-methods.md`
- **Function / component / route**: Sections 3, 4, 10, 11, and 12; execution setup diagrams and readiness checkpoint text
- **Trigger or precondition**: A developer reads the canonical connection-methods doc to understand default sender and setup phases.
- **Expected invariant**: Default user execution sender is the parent CSW through canonical4337; sub-accounts are dormant/optional fallback unless explicitly route-used.
- **Observed behavior**: Doc banner said sub-accounts were dormant but body/diagrams still described sub-account as default execution address and phase-1 setup. Remediation rewrote body/diagrams to parent CSW default.
- **Severity rationale**: P1 because internal contradiction in the canonical connection doc could produce wrong implementation or launch runbook decisions. Remediated.
- **Pass/Fail criterion**: PASS now: grep for `Execution address: sub-account` or `PHASE 1: Sub-Account Creation` returns 0 matches in the actual doc.
- **Minimal remediation recommendation**: None required; remediation verified clean at the moved `docs/_internal/` path.
- **Launch impact**: No active launch impact; cleared.

### DRIFT-004

- **ID**: DRIFT-004
- **Severity**: P1 (remediated)
- **Domain**: Account model / owner-mutation decision
- **Launch decision**: cleared after remediation/recheck
- **Exact file path(s)**: `docs/_internal/ACCOUNT_MODEL.md`; `docs/_internal/wallet-notes/owner-mutation-decision-2026-05.md`
- **Function / component / route**: ACCOUNT_MODEL §5.2 and owner-mutation decision sections
- **Trigger or precondition**: A developer uses account-model docs to choose the owner-install architecture for population (b).
- **Expected invariant**: Shipped default is `legacy-owner-install`: Privy embedded EOA as direct owner of parent CSW; sub-account is not the default path.
- **Observed behavior**: Docs previously recommended “Use Sub Accounts + Spend Permissions for population (b).” Remediation replaced this with parent CSW + embedded-owner signer language.
- **Severity rationale**: P1 because stale canonical architecture docs could reintroduce a superseded account model. Remediated.
- **Pass/Fail criterion**: PASS now: grep for `Use Sub Accounts + Spend Permissions for population` returns 0 matches in actual docs.
- **Minimal remediation recommendation**: None required; remediation verified clean at moved `docs/_internal/` paths.
- **Launch impact**: No active launch impact; cleared.


## P2 — Medium

### APIAUTH-001

- **ID**: APIAUTH-001
- **Severity**: P2 (high-end)
- **Domain**: API auth / accounts — unthrottled mutating GET
- **Launch decision**: fix before launch
- **Exact file path(s)**: `frontend/api/_handlers/accounts/_me.ts`; `frontend/server/_lib/identity/accountsIdentity.ts`
- **Function / component / route**: Route `GET /api/accounts/me`; helper `syncEmailIdentity()`
- **Trigger or precondition**: Any authenticated Privy session repeatedly calls `/api/accounts/me`, including app bootstrap/retry loops.
- **Expected invariant**: Authenticated hot bootstrap endpoints that perform DB writes or external identity calls must be read-only snapshots or bounded by user/IP rate limits with 429 + Retry-After.
- **Observed behavior**: Handler verifies Privy then calls `syncEmailIdentity()` which upserts account/link rows and point events. No `checkRateLimit`, `checkDurableRateLimit`, `RATE_LIMITS`, or `Retry-After` path exists.
- **Severity rationale**: P2, not P0/P1, because the endpoint requires Privy auth and does not allow anonymous mutation or fund loss. It is the most serious APIAUTH item due to write amplification and external API cost.
- **Pass/Fail criterion**: FAIL until the GET becomes read-only or enforces a Privy-user + IP limiter before write helpers run, with regression tests for 429 behavior.
- **Minimal remediation recommendation**: Split read-only `GET /api/accounts/me` from a bounded sync endpoint, or add durable/user+IP limiting and tests to the existing route.
- **Launch impact**: Should be fixed before public launch, but it does not block the current launch gate.

### APIAUTH-003

- **ID**: APIAUTH-003
- **Severity**: P2
- **Domain**: API auth — in-memory limits on auth-adjacent POST
- **Launch decision**: monitor
- **Exact file path(s)**: `frontend/api/_handlers/auth/_agent-nonce.ts`; `frontend/api/_handlers/auth/_agent-verify.ts`
- **Function / component / route**: Routes `POST /api/auth/agent-nonce`, `POST /api/auth/agent-verify`
- **Trigger or precondition**: Public SIWA nonce/verify traffic fans out across Vercel isolates or cold starts.
- **Expected invariant**: Auth-adjacent write endpoints should use durable fail-closed rate limits like `_verify.ts` and `_privy.ts`.
- **Observed behavior**: Both endpoints use per-IP in-memory `checkRateLimit`; `_agent-nonce` also performs 12s on-chain owner checks.
- **Severity rationale**: P2 because SIWA validation prevents direct auth bypass, but cross-instance limiter bypass can amplify RPC and DB load.
- **Pass/Fail criterion**: FAIL until both routes use `checkDurableRateLimit(... failClosed: true)`.
- **Minimal remediation recommendation**: Replace in-memory limiter with durable fail-closed limiter using the existing auth durable pattern.
- **Launch impact**: Not launch-blocking; pre-launch hardening recommended.

### APIAUTH-004

- **ID**: APIAUTH-004
- **Severity**: P2
- **Domain**: API accounts — mutating link/unlink limiter + unlink asymmetry
- **Launch decision**: monitor
- **Exact file path(s)**: `frontend/api/_handlers/accounts/_link.ts`; `frontend/api/_handlers/accounts/_unlink.ts`
- **Function / component / route**: Routes `POST /api/accounts/link`, `POST /api/accounts/unlink`; helpers `recordProviderLink`, `recordProviderUnlink`
- **Trigger or precondition**: Authenticated user repeatedly links/unlinks providers, or malformed unlink value is supplied.
- **Expected invariant**: Mutating identity endpoints should be durable-limited by Privy user + IP and must not trust caller-supplied identity values across profile boundaries.
- **Observed behavior**: Both use IP-only in-memory `RATE_LIMITS.cswLink`; `_unlink.ts` passes caller-supplied `value` and lacks `isIdentityRecoveryRequiredError` handling.
- **Severity rationale**: P2 because auth scopes mutation to the user, but limiter bypass and unlink asymmetry are identity-integrity hardening gaps.
- **Pass/Fail criterion**: FAIL until durable user+IP limiting exists and unlink value/error behavior is reviewed/fixed.
- **Minimal remediation recommendation**: Use durable fail-closed limiter; add 409 recovery handling; trace/nullify unlink value if needed.
- **Launch impact**: Not launch-blocking; should be covered in the durable limiter/identity hardening sweep.

### APIAUTH-006

- **ID**: APIAUTH-006
- **Severity**: P2
- **Domain**: API waitlist — heavy bootstrap limiter + non-atomic Supabase path
- **Launch decision**: monitor
- **Exact file path(s)**: `frontend/api/_handlers/waitlist/_bootstrap.ts`
- **Function / component / route**: Route `POST /api/waitlist/bootstrap`; helper `runBootstrapTransaction()`
- **Trigger or precondition**: Authenticated/full bootstrap calls retry concurrently for the same user, especially when only Supabase sql-like DB API is available.
- **Expected invariant**: Heavy mutating bootstrap should be durable-limited and profile/rebind point moves should be atomic or serialized.
- **Observed behavior**: Route uses IP-only in-memory `RATE_LIMITS.general`. `runBootstrapTransaction` skips transaction wrapper when `db.query` is unavailable, leaving `rebindEmailProfileToPrivyUser` point moves non-atomic.
- **Severity rationale**: P2 because auth is required for the full heavy path and impact is referral/points data integrity, not security bypass.
- **Pass/Fail criterion**: FAIL until durable limiter exists and non-transactional Supabase path has advisory locking or documented safe conditional updates.
- **Minimal remediation recommendation**: Add durable Privy-user + IP limiter; add `pg_advisory_lock(hash(privyUserId))` or equivalent serialization around rebind path.
- **Launch impact**: Not launch-blocking; fix before launch if sql-only Supabase path is active in production.

### APIAUTH-007

- **ID**: APIAUTH-007
- **Severity**: P2
- **Domain**: API relay — unauthenticated proxy using project API key
- **Launch decision**: monitor
- **Exact file path(s)**: `frontend/api/_handlers/relay/_execute.ts`; `frontend/api/_handlers/relay/_quote.ts`
- **Function / component / route**: Routes `POST /api/relay/execute`, `POST /api/relay/quote`
- **Trigger or precondition**: Anonymous caller submits relay quote/execute requests with arbitrary `user` address and consumes project Relay quota/subsidy.
- **Expected invariant**: Project API keys and subsidized quote behavior should be gated by authenticated principal ownership of the requested user/sender.
- **Observed behavior**: No auth check; execute validates address shape but not caller ownership; quote sets `subsidizeFees: true` for unauthenticated callers. UserOp signature still prevents fund theft.
- **Severity rationale**: P2 because abuse can consume API key/quota/subsidy but signed UserOps prevent direct fund loss or arbitrary chain mutation.
- **Pass/Fail criterion**: FAIL until both routes require auth and execute validates principal equals `user`; subsidy is auth-gated.
- **Minimal remediation recommendation**: Add `readRequestPrincipalAddress(req)` to both routes; return 401 unauthenticated; bind execute `user` to principal; gate `subsidizeFees`.
- **Launch impact**: Not launch-blocking, but should be remediated before public launch if Relay quota/subsidy has cost.

### APIAUTH-008

- **ID**: APIAUTH-008
- **Severity**: P2
- **Domain**: API paymaster — in-memory sponsorship limits
- **Launch decision**: monitor
- **Exact file path(s)**: `frontend/api/_handlers/paymaster/_paymaster.ts`
- **Function / component / route**: Route `POST /api/paymaster`; helpers `checkSponsorshipLimit`, `enforceRateLimit`, `validateSponsoredSmartWalletCalls`
- **Trigger or precondition**: Authenticated/session callers submit paymaster JSON-RPC sponsorship requests across multiple serverless isolates.
- **Expected invariant**: Gas sponsorship budgets must be enforced durably by sender/session and fail closed; validation must continue to prove ownership and call safety.
- **Observed behavior**: Per-IP, per-sender, and per-session limits are in-memory. Validation logic is thorough, but quota can multiply by isolate/cold start. Related test expects -32005 but observes -32000.
- **Severity rationale**: P2 because robust call validation prevents security bypass, but gas-budget abuse is financially relevant.
- **Pass/Fail criterion**: FAIL until sender/session sponsorship limits are durable fail-closed and rate-limit errors map correctly.
- **Minimal remediation recommendation**: Use durable fail-closed limiter for sender and session budgets; keep per-IP in-memory as first-line throttle; map rate-limit JSON-RPC code to -32005.
- **Launch impact**: Not launch-blocking; public-launch hardening recommended.

### APIAUTH-009

- **ID**: APIAUTH-009
- **Severity**: P2
- **Domain**: API deploy — unthrottled workflow resume
- **Launch decision**: monitor
- **Exact file path(s)**: `frontend/api/_handlers/deploy/v2/session/_resume.ts`; `frontend/server/_lib/deploy/workflow/runner.ts`
- **Function / component / route**: Route `POST /api/deploy/v2/session/resume`; function `runDeployWorkflow()`
- **Trigger or precondition**: Authorized deploy-session caller repeatedly calls resume within the 45-minute session window.
- **Expected invariant**: Mutating deploy workflow entrypoints should be rate-limited so one caller cannot bypass per-run tick budgets by repeated resumes.
- **Observed behavior**: `_resume.ts` has no limiter; it loads authorized session then runs deploy workflow, which can send UserOps.
- **Severity rationale**: P2 because session auth and TTL exist, but repeated resumes can amplify gas/workflow attempts.
- **Pass/Fail criterion**: FAIL until resume has at least auth-address in-memory limiting, preferably durable fail-closed.
- **Minimal remediation recommendation**: Add durable limiter keyed by `auth.address` after `loadAuthorizedDeploySession`, matching create/start patterns.
- **Launch impact**: Not launch-blocking; pre-launch hardening recommended for deploy cost control.

### APIAUTH-014

- **ID**: APIAUTH-014
- **Severity**: P2
- **Domain**: API backtest — compute-heavy run limiter/body hardening
- **Launch decision**: monitor
- **Exact file path(s)**: `frontend/api/_handlers/v1/alfaclub/_backtest-run.ts`
- **Function / component / route**: Route `POST /api/v1/alfaclub/backtest-run`; function `executeBacktestCounterRebalance()`
- **Trigger or precondition**: Authenticated user submits repeated backtest runs or a large request body.
- **Expected invariant**: Compute-heavy authenticated POSTs should have durable limits and bounded body parsing.
- **Observed behavior**: Route uses in-memory 5/min per Privy user + IP and `readJsonBody`; guard `api-nonv1-hardening` flags unbounded body read.
- **Severity rationale**: P2 because auth is required and no DB/chain mutation occurs, but compute and body-size abuse remain possible.
- **Pass/Fail criterion**: FAIL until durable limiter is layered and `readBoundedJsonObjectBody` is used.
- **Minimal remediation recommendation**: Add durable fail-closed limiter and replace `readJsonBody` with bounded parser.
- **Launch impact**: Not launch-blocking; should be fixed before public use of Arena backtests.

### WALLET-001

- **ID**: WALLET-001
- **Severity**: P2
- **Domain**: Identity / tombstone integrity
- **Launch decision**: monitor
- **Exact file path(s)**: `frontend/server/_lib/wallet/canonicalCswDelegation.ts`; references `frontend/server/_lib/wallet/walletSync.ts`, `frontend/server/_lib/wallet/profileIdForPrivyUser.ts`
- **Function / component / route**: Function `recoverProfileIdFromPrivyHints()`; caller `resolveCanonicalCsw()`
- **Trigger or precondition**: Primary Privy-user profile lookup misses and fallback recovers by email/wallet/profile column that points to a merged tombstone.
- **Expected invariant**: Fallback identity recovery must follow `merged_into_profile_id` pointers and never write delegation state to tombstoned profiles.
- **Observed behavior**: Three fallback lookups do not filter or coalesce tombstones; resolved ID can receive `privy_user_id`, `csw_address`, and `primary_smart_wallet` writes.
- **Severity rationale**: P2 because primary resolver is correct and fallback-only, but consequence is identity/delegation state divergence.
- **Pass/Fail criterion**: FAIL until all three lookup paths filter tombstones or coalesce to live profile IDs.
- **Minimal remediation recommendation**: Add `merged_into_profile_id IS NULL` filters and profile join/coalesce for `profile_wallets` lookup.
- **Launch impact**: Low-medium; not fund loss, but should be fixed before scale.

### RACE-001

- **ID**: RACE-001
- **Severity**: P2
- **Domain**: Deploy session / concurrent worker transitions
- **Launch decision**: monitor
- **Exact file path(s)**: `frontend/server/_lib/deploy/deploySessions.ts`; `frontend/api/_handlers/deploy/v2/session/_statusCore.ts`; `frontend/server/_lib/deploy/workflow/runner.ts`
- **Function / component / route**: Function `transitionDeploySession()`; status-poll transition path; workflow lease claim
- **Trigger or precondition**: Status polling transitions a session while a workflow runner holds an active lease.
- **Expected invariant**: Only the lease owner, no owner, or expired lease holder should transition deploy workflow state.
- **Observed behavior**: Transition CAS checks `step = fromStep` but not `lock_owner` or `lock_expires_at`; status path can cause runner CAS miss and `CONCURRENT_MODIFICATION` retry.
- **Severity rationale**: P2 because CAS prevents corruption, but active workflow lease bypass can create spurious failures/latency.
- **Pass/Fail criterion**: FAIL until transition checks lease ownership/expiry or status path claims a short lease.
- **Minimal remediation recommendation**: Add lease predicate to transition WHERE clause or coordinate status transitions through lease acquisition.
- **Launch impact**: Not launch-blocking; operational reliability hardening.

### DRIFT-005

- **ID**: DRIFT-005
- **Severity**: P2
- **Domain**: File path drift / developer guidance
- **Launch decision**: monitor
- **Exact file path(s)**: `docs/_internal/4626-connection-methods.md`
- **Function / component / route**: Sections 5, 9, and 13 file-reference text
- **Trigger or precondition**: Developer follows connection-methods doc references to inspect onboarding/deploy/XMTP files.
- **Expected invariant**: Canonical architecture docs should point to current file paths so operators do not chase removed files.
- **Observed behavior**: Doc references stale `onboardingWallet.ts`, `deploy/session/_create.ts`, `privyXmtpSigner.ts`, and `agentRegistration.ts` paths after reorganization.
- **Severity rationale**: P2 because it slows or misdirects remediation/development, but does not affect runtime behavior.
- **Pass/Fail criterion**: FAIL until all four stale paths are corrected.
- **Minimal remediation recommendation**: Update references to current split/moved files.
- **Launch impact**: Developer friction only; not launch-blocking.

### DRIFT-006

- **ID**: DRIFT-006
- **Severity**: P2
- **Domain**: File path drift / operator guidance
- **Launch decision**: monitor
- **Exact file path(s)**: `docs/_internal/operations/operations/messaging/telegram-canonical-link-preservation.md`
- **Function / component / route**: Telegram preservation runbook file-reference lines
- **Trigger or precondition**: Operator/debugger follows Telegram Mini App preservation doc during incident or flow maintenance.
- **Expected invariant**: Telegram flow runbooks should reference current server helper paths.
- **Observed behavior**: Doc references stale paths for `telegramMiniAppLink.ts`, `telegramWebApp.ts`, `accountsIdentity.ts`, `walletSync.ts`, and `telegramTrading.ts`; files exist in subdirectories.
- **Severity rationale**: P2 because Telegram flow reliability depends on accurate runbooks, but runtime code is unaffected.
- **Pass/Fail criterion**: FAIL until all five paths are corrected.
- **Minimal remediation recommendation**: Replace old paths with current subdirectory paths.
- **Launch impact**: Operator/developer friction; not launch-blocking.

### DRIFT-007

- **ID**: DRIFT-007
- **Severity**: P2
- **Domain**: File path drift / developer guidance
- **Launch decision**: monitor
- **Exact file path(s)**: `frontend/docs/waitlist-accounts-architecture.md`
- **Function / component / route**: Waitlist architecture “build on” file-reference text around line 65
- **Trigger or precondition**: Developer starts waitlist/account product work from the doc.
- **Expected invariant**: Docs should name existing components or deliberately omit removed legacy files.
- **Observed behavior**: Doc references `frontend/src/features/waitlist/WaitlistSetupWorkspace.tsx`, which no longer exists; nearby text says legacy heavy waitlist flow was removed.
- **Severity rationale**: P2 because it creates implementation friction and can revive removed flow assumptions.
- **Pass/Fail criterion**: FAIL until the stale reference is removed or replaced with actual successor component.
- **Minimal remediation recommendation**: Replace with `WaitlistFlow.tsx` or the correct current component, or remove the line.
- **Launch impact**: Developer friction only; not launch-blocking.

### LAUNCH-002

- **ID**: LAUNCH-002
- **Severity**: P2
- **Domain**: Prelaunch script behavior / keeper control-plane
- **Launch decision**: monitor
- **Exact file path(s)**: `frontend/scripts/verify-akita-prelaunch-readiness.ts`; `frontend/api/_handlers/keeper/_solanaReconcile.ts`
- **Function / component / route**: Prelaunch actions `settle_fees`, `winner_relay`, `relay_entries`; keeper reconcile checkpoint writes
- **Trigger or precondition**: Operator runs production prelaunch verification.
- **Expected invariant**: Deploy status/preflight paths must be read-only; prelaunch messaging should accurately distinguish deploy read-only checks from keeper control-plane exercises.
- **Observed behavior**: Script header says read-only by default, but the script triggers keeper checkpoint DB writes and orchestrator actions. These are idempotent keeper operations, not deploy state mutation.
- **Severity rationale**: P2 informational because misleading wording can surprise operators; no dangerous deploy mutation found.
- **Pass/Fail criterion**: PASS for product invariant; wording remains misleading until clarified.
- **Minimal remediation recommendation**: Clarify script header: “deploy read-only, but exercises keeper control-plane/checkpoints.”
- **Launch impact**: No launch block; docs/operator clarity followup.

### LAUNCH-003

- **ID**: LAUNCH-003
- **Severity**: P2
- **Domain**: Local development environment / gitignored .env
- **Launch decision**: accepted risk (local dev only)
- **Exact file path(s)**: `frontend/.env` (gitignored local file); `frontend/scripts/dev-deploy-dry-run.sh`
- **Function / component / route**: Shell sourcing path in local dry-run script
- **Trigger or precondition**: Run local dry-run script while `frontend/.env` contains a bare `ALFACLUB` line with no `=`.
- **Expected invariant**: Local shell env files sourced by scripts should contain valid assignments/comments only.
- **Observed behavior**: Bare local line caused `ALFACLUB: command not found` and script exit; fixed locally by commenting it out. File is gitignored.
- **Severity rationale**: P2 in audit history because it blocked local launch smoke during the pass; no production impact and now locally cleared.
- **Pass/Fail criterion**: PASS locally after commenting/removing bare line; no tracked repo change required.
- **Minimal remediation recommendation**: None for repo; keep `.env` syntactically valid locally.
- **Launch impact**: No production launch impact.

### APIAUTH-016 (also BACKTEST-001 — merged)

- **ID**: APIAUTH-016 (also BACKTEST-001 — merged)
- **Severity**: P2
- **Domain**: API backtest — unauthenticated read-only result endpoints
- **Launch decision**: monitor
- **Exact file path(s)**: `frontend/api/_handlers/v1/alfaclub/_backtest-sweep.ts`; `_backtest-series.ts`; `_backtest-audit.ts`; `_backtest-markets.ts`
- **Function / component / route**: Routes `GET /api/v1/alfaclub/backtest-sweep`, `backtest-series`, `backtest-audit`, `backtest-markets`
- **Trigger or precondition**: Anonymous caller requests simulation outputs or market list endpoints.
- **Expected invariant**: Operator-scoped simulation artifacts should require auth if they are not intended to be public; unauthenticated readers must remain path-traversal safe.
- **Observed behavior**: Four GET endpoints are unauthenticated with in-memory IP limits only. Data is simulation output/public market data; filesystem endpoints use basename/extension validation.
- **Severity rationale**: P2 because backtest artifacts may be operationally sensitive enough to auth-gate, but no PII/secrets/fund mutation were found.
- **Pass/Fail criterion**: FAIL if sweep/series/audit should be operator-scoped and remain unauthenticated; markets can remain public.
- **Minimal remediation recommendation**: Add session auth to sweep/series/audit if results are not public; keep basename validation.
- **Launch impact**: Low; not launch-blocking.

### BACKTEST-002

- **ID**: BACKTEST-002
- **Severity**: P2
- **Domain**: Backtest — no outer timeout on chat execution path
- **Launch decision**: monitor
- **Exact file path(s)**: `frontend/server/agents/eliza/src/service.ts`; `frontend/server/_lib/backtestJobs.ts`
- **Function / component / route**: Eliza service call to `runRealBacktestJob()`
- **Trigger or precondition**: Paid/funded ACP backtest job runs while upstream candle fetch, Supabase, or engine call hangs beyond per-fetch timeouts.
- **Expected invariant**: Long-running agent tool calls should have an outer timeout and user-facing failure mode.
- **Observed behavior**: Service awaits `runRealBacktestJob(backtestRequest)` without `AbortController`, `Promise.race`, or configurable timeout.
- **Severity rationale**: P2 because it can wedge a paid tool execution operationally, but it is not anonymous and not a fund/custody bug.
- **Pass/Fail criterion**: FAIL until an outer timeout wraps the full job.
- **Minimal remediation recommendation**: Wrap in `Promise.race`/timeout (e.g. 60s configurable) returning a friendly timeout error.
- **Launch impact**: Operational hardening; not launch-blocking.

### BACKTEST-003

- **ID**: BACKTEST-003
- **Severity**: P2
- **Domain**: Backtest — CLI env loading
- **Launch decision**: monitor
- **Exact file path(s)**: `frontend/scripts/backtest-counter-rebalance.ts`
- **Function / component / route**: CLI entrypoint for counter-rebalance backtests
- **Trigger or precondition**: Run CLI from a context where `DATABASE_URL` is not already in ambient env.
- **Expected invariant**: TSX scripts that need repo env should load `.env` explicitly or warn when DB cache is unavailable.
- **Observed behavior**: Script does not call `loadEnvFile()`/dotenv. Long-window runs can silently fall back from Supabase cache to degraded external candle source.
- **Severity rationale**: P2 because it can produce degraded operational output without clear warning; normal frontend env context may mask it.
- **Pass/Fail criterion**: FAIL until env is loaded or missing DB warning is explicit for long windows.
- **Minimal remediation recommendation**: Call `loadEnvFile()` at script start and warn when `DATABASE_URL` is missing for >7 day windows.
- **Launch impact**: Operational hardening; not launch-blocking.

### BACKTEST-004

- **ID**: BACKTEST-004
- **Severity**: P2
- **Domain**: Backtest — API stdout truncation UX
- **Launch decision**: monitor
- **Exact file path(s)**: `frontend/api/_handlers/v1/alfaclub/_backtest-run.ts`; `frontend/src/pages/Arena.tsx`
- **Function / component / route**: Function `trimOutput()`; Arena backtest result rendering and sweep refetch
- **Trigger or precondition**: Run a large sweep that emits more than 8000 stdout characters.
- **Expected invariant**: Backtest UI should surface the most relevant result rows or clearly direct users to full sweep data.
- **Observed behavior**: API returns last 8000 chars, so top-ranked rows can be omitted from stdout; full CSV remains available via `sweepFile` and sweep endpoint.
- **Severity rationale**: P2 UX because it hides important top rows in immediate output but does not lose data.
- **Pass/Fail criterion**: PASS for data retention; UX FAIL until top-N or larger/structured output is returned.
- **Minimal remediation recommendation**: Return top-N rows or structured summary instead of tail truncation; or raise limit.
- **Launch impact**: Low; not launch-blocking.

### UX-001

- **ID**: UX-001
- **Severity**: P2
- **Domain**: UX — waitlist status conflates join with wallet-ready
- **Launch decision**: monitor
- **Exact file path(s)**: `frontend/src/features/waitlist/WaitlistFlow.tsx`; `frontend/src/pages/Swap.tsx`
- **Function / component / route**: Component `WaitlistFlow`; `/swap` canonical setup gate
- **Trigger or precondition**: User verifies email/waitlist but has not completed embedded-owner parent-CSW setup, then clicks “Enter app”.
- **Expected invariant**: UI must distinguish waitlist/link success from execution-ready wallet status.
- **Observed behavior**: Waitlist card shows “Confirmed” / “You are on the list” / “Enter app” based on `sessionAddress`; `/swap` later correctly gates execution with setup hint.
- **Severity rationale**: P2 because it is a functional expectation gap, though swap execution remains safely gated.
- **Pass/Fail criterion**: PASS when status copy differentiates waitlist-joined from wallet-ready or shows setup remaining.
- **Minimal remediation recommendation**: Change badge/copy to “On the list” or add “Wallet setup remaining” secondary text.
- **Launch impact**: UX risk only; no gate bypass.

### UX-002

- **ID**: UX-002
- **Severity**: P2
- **Domain**: UX — auto-opened login modal on redirect
- **Launch decision**: monitor
- **Exact file path(s)**: `frontend/src/pages/Waitlist.tsx`; waitlist/auth redirect flow; live route `https://app.4626.fun/swap`
- **Function / component / route**: Unauthenticated app redirect to waitlist + Privy login modal
- **Trigger or precondition**: Unauthenticated user opens `/swap` and is redirected to `/waitlist`.
- **Expected invariant**: Redirected unauthenticated users should see a coherent entry surface before an auth modal opens, or the modal should explain context.
- **Observed behavior**: Live browser inspection showed waitlist card and Privy “log in or sign up” dialog simultaneously, with no click.
- **Severity rationale**: P2 UX because it is confusing but dismissible and not a security/correctness bug.
- **Pass/Fail criterion**: PASS when modal does not auto-open on redirect or carries redirect context.
- **Minimal remediation recommendation**: Disable auto-open on redirect; let “Join with email” open modal, or add contextual copy.
- **Launch impact**: UX polish; not launch-blocking.

### UX-003

- **ID**: UX-003
- **Severity**: P2
- **Domain**: UX — Arena mobile/tablet navigation unavailable
- **Launch decision**: monitor
- **Exact file path(s)**: `frontend/src/pages/Arena.tsx`
- **Function / component / route**: Arena sidebar navigation component around `hidden lg:block`
- **Trigger or precondition**: User visits Arena below 1024px viewport.
- **Expected invariant**: All Arena subpages should be reachable on supported mobile/tablet viewports.
- **Observed behavior**: Sidebar nav is hidden below `lg` and no hamburger/drawer/tab fallback exists; mobile users cannot navigate beyond intro without manual URL changes.
- **Severity rationale**: P2 because it is a functional UX gap for a secondary launch surface.
- **Pass/Fail criterion**: PASS when a mobile nav affordance exists below `lg`.
- **Minimal remediation recommendation**: Add hamburger, drawer, top select, or horizontal tab bar for Arena sections.
- **Launch impact**: Mobile Arena usability issue; not launch-blocking.

### VG-001

- **ID**: VG-001
- **Severity**: P2
- **Domain**: Validation gate — API non-v1 hardening failure
- **Launch decision**: monitor
- **Exact file path(s)**: `frontend/api/_handlers/v1/alfaclub/_backtest-run.ts`; `frontend/scripts/guard-*` via npm script
- **Function / component / route**: Validation command `pnpm -C frontend guard:api-nonv1-hardening`
- **Trigger or precondition**: Run API hardening guard.
- **Expected invariant**: Mutating v1 handlers must use bounded JSON body readers.
- **Observed behavior**: Guard exits 1: `_backtest-run.ts:114` uses `readJsonBody` instead of `readBoundedJsonObjectBody`.
- **Severity rationale**: P2 because it is a real body-size hardening gap on an authenticated endpoint.
- **Pass/Fail criterion**: FAIL until guard exits 0.
- **Minimal remediation recommendation**: Use `readBoundedJsonObjectBody(req, { maxBytes: ... })` at the flagged line.
- **Launch impact**: Not launch-blocking; cross-ref APIAUTH-014.


## P3 — Low

### APIAUTH-002

- **ID**: APIAUTH-002
- **Severity**: P3
- **Domain**: API auth — DB-heavy admin GET without limiter
- **Launch decision**: accepted risk
- **Exact file path(s)**: `frontend/api/_handlers/auth/_admin.ts`
- **Function / component / route**: Route `GET /api/auth/admin`; helper `lookupAdminContextByWallet()`
- **Trigger or precondition**: Session caller repeatedly requests admin-status lookup.
- **Expected invariant**: DB-heavy reads should have at least in-memory read throttles.
- **Observed behavior**: No limiter; route is read-only and uses session address lookup.
- **Severity rationale**: P3 because it is read-only and session-scoped; defense-in-depth only.
- **Pass/Fail criterion**: FAIL until read limiter is added.
- **Minimal remediation recommendation**: Add in-memory `authRead` limiter keyed by IP/session.
- **Launch impact**: Accepted low risk; not launch-blocking.

### APIAUTH-005

- **ID**: APIAUTH-005
- **Severity**: P3
- **Domain**: API waitlist — read-only GETs without limiters
- **Launch decision**: accepted risk
- **Exact file path(s)**: `frontend/api/_handlers/waitlist/_stats.ts`; `_me.ts`; `_leaderboard.ts`
- **Function / component / route**: Routes `GET /api/waitlist/stats`, `me`, `leaderboard`
- **Trigger or precondition**: Public or auth-optional callers repeatedly hit read endpoints.
- **Expected invariant**: Public DB reads should have a basic per-IP limiter.
- **Observed behavior**: No limiter on stats/me/leaderboard. `_stats` is public count; others are auth-optional DB reads.
- **Severity rationale**: P3 because endpoints are read-only with minimal disclosure.
- **Pass/Fail criterion**: FAIL until basic per-IP read limiters are added.
- **Minimal remediation recommendation**: Add in-memory read limiters matching `_position.ts` pattern.
- **Launch impact**: Accepted low risk; not launch-blocking.

### APIAUTH-010 (also WALLET-003 — merged)

- **ID**: APIAUTH-010 (also WALLET-003 — merged)
- **Severity**: P3
- **Domain**: API wallet — in-memory limits on wallet mutation POSTs
- **Launch decision**: accepted risk
- **Exact file path(s)**: `frontend/api/_handlers/wallet/_sync.ts`; `_confirm-owner.ts`; `_prepare-add-privy-owner.ts`; `_disconnect-external.ts`
- **Function / component / route**: Routes `POST /api/wallet/sync`, `confirm-owner`, `prepare-add-privy-owner`, `disconnect-external`
- **Trigger or precondition**: Authenticated wallet mutation traffic spans isolates/cold starts or NAT users share IP budget.
- **Expected invariant**: Wallet mutation endpoints should be durably limited by user + IP.
- **Observed behavior**: All four use IP-only in-memory `RATE_LIMITS.cswLink`; all require auth/ownership resolution.
- **Severity rationale**: P3 because auth/ownership gates prevent cross-user abuse; limiter durability is defense-in-depth.
- **Pass/Fail criterion**: FAIL until durable fail-closed limiter is used.
- **Minimal remediation recommendation**: Replace with `checkDurableRateLimit(... failClosed: true)` keyed by Privy user + IP.
- **Launch impact**: Low risk; included in systemic limiter sweep.

### APIAUTH-011

- **ID**: APIAUTH-011
- **Severity**: P3
- **Domain**: API deploy — in-memory limits on deploy session POSTs
- **Launch decision**: accepted risk
- **Exact file path(s)**: `frontend/api/_handlers/deploy/v2/session/_start.ts`; `_cancelCore.ts`; `_dryRunCore.ts`; `_statusCore.ts`
- **Function / component / route**: Deploy session start/cancel/dry-run/status-core write paths
- **Trigger or precondition**: Authenticated deploy-session traffic spans isolates/cold starts.
- **Expected invariant**: Deploy write paths should prefer durable fail-closed rate limits, as create already does.
- **Observed behavior**: Several deploy session handlers use in-memory `checkRateLimit`; full create path uses durable limiter.
- **Severity rationale**: P3 because all paths require auth, dry-run is local-fork-only, and call validation exists.
- **Pass/Fail criterion**: FAIL until durable limiter covers deploy write/session paths.
- **Minimal remediation recommendation**: Replace in-memory limits with durable fail-closed keyed by auth address.
- **Launch impact**: Low risk; not launch-blocking.

### APIAUTH-012

- **ID**: APIAUTH-012
- **Severity**: P3
- **Domain**: API deploy — session cookie HMAC as sole deploy auth
- **Launch decision**: accepted risk
- **Exact file path(s)**: `frontend/api/_handlers/deploy/v2/session/_sessionAccess.ts`
- **Function / component / route**: Function `loadAuthorizedDeploySession()`; resume/cancel/status session access
- **Trigger or precondition**: A 7-day HTTP-only deploy session cookie is stolen while a 45-minute deploy session is active.
- **Expected invariant**: Critical deploy actions should require fresh wallet/session proof, not only a long-lived cookie.
- **Observed behavior**: Code comment already documents FINDING-09: cookie HMAC is sole auth for active deploy access.
- **Severity rationale**: P3 because TTL and HTTP-only/SameSite reduce blast radius; known debt, not current bypass from normal auth.
- **Pass/Fail criterion**: FAIL until resume/cancel require fresh Privy JWT or wallet proof.
- **Minimal remediation recommendation**: Require fresh Privy JWT validated within short window for deploy-critical operations.
- **Launch impact**: Accepted risk for launch; higher-assurance followup.

### APIAUTH-013

- **ID**: APIAUTH-013
- **Severity**: P3
- **Domain**: API Telegram — in-memory link-complete limiter
- **Launch decision**: accepted risk
- **Exact file path(s)**: `frontend/api/_handlers/telegram/_link-complete.ts`
- **Function / component / route**: Route `POST /api/telegram/link/complete`
- **Trigger or precondition**: Authenticated Telegram link completion retries across isolates/cold starts.
- **Expected invariant**: Heavy account-linking writes should be durable-limited by Privy user + IP.
- **Observed behavior**: Endpoint uses IP-only in-memory limiter; otherwise verifies Privy, fresh Telegram session, claim-bound token, merge preflight, and consumes token on success.
- **Severity rationale**: P3 because semantic access controls are strong; limiter durability is defense-in-depth.
- **Pass/Fail criterion**: FAIL until durable fail-closed user+IP limiter exists.
- **Minimal remediation recommendation**: Use `checkDurableRateLimit(... failClosed: true)` keyed by Privy user + IP.
- **Launch impact**: Low risk; not launch-blocking.

### APIAUTH-015

- **ID**: APIAUTH-015
- **Severity**: P3
- **Domain**: API chat/media — in-memory Hermit limits
- **Launch decision**: accepted risk
- **Exact file path(s)**: `frontend/api/_handlers/v1/chat/_hermit.ts`; `_hermit-meme-save.ts`; `_hermit-meme-delete.ts`
- **Function / component / route**: Hermit command and meme save/delete routes
- **Trigger or precondition**: Allowlisted/session Hermit users issue repeated chat/media requests across isolates.
- **Expected invariant**: Mutating chat/media endpoints should use durable limits when they write DB records.
- **Observed behavior**: All three use in-memory limiters; save/delete are owner/room-scoped and `_hermit` blocks keeper write commands.
- **Severity rationale**: P3 because caller set and owner scoping sharply limit blast radius.
- **Pass/Fail criterion**: FAIL for durable-limiter standard; access control otherwise passes.
- **Minimal remediation recommendation**: Add durable fail-closed limiter for consistency.
- **Launch impact**: Low; backlog hardening.

### APIAUTH-017

- **ID**: APIAUTH-017
- **Severity**: P3
- **Domain**: API AlfaClub — in-memory limits on cron/admin endpoints
- **Launch decision**: accepted risk
- **Exact file path(s)**: `frontend/api/_handlers/v1/alfaclub/_run.ts`; `_chat-token.ts`; `_chat-token-refresh.ts`; `_chat-bridge-run.ts`
- **Function / component / route**: AlfaClub cron/admin routes
- **Trigger or precondition**: CRON_SECRET/admin callers repeat operations across isolates.
- **Expected invariant**: Privileged operational endpoints should be durably throttled where practical.
- **Observed behavior**: Endpoints use in-memory `adminAction` limits; all require CRON_SECRET or admin session. Token GET returns fingerprints only.
- **Severity rationale**: P3 because caller set is restricted; compromised CRON_SECRET would already be severe regardless of limiter.
- **Pass/Fail criterion**: FAIL for durable-limiter standard.
- **Minimal remediation recommendation**: Add durable limiter for consistency.
- **Launch impact**: Low; accepted launch risk.

### APIAUTH-018

- **ID**: APIAUTH-018
- **Severity**: P3
- **Domain**: API build — in-memory limits on calldata builders
- **Launch decision**: accepted risk
- **Exact file path(s)**: `frontend/api/_handlers/v1/build/auction/_submitBid.ts`; `gauge/_vote.ts`; `ve4626/_lock.ts`; `ajna/_borrow.ts`
- **Function / component / route**: Build-only calldata routes for auction/gauge/ve4626/ajna
- **Trigger or precondition**: Authenticated build callers repeatedly request calldata construction.
- **Expected invariant**: Build endpoints should be throttled, but server-side mutation must remain absent.
- **Observed behavior**: In-memory limiters only; all authenticated by `guardAgentApiRequest`; handlers encode calldata and return it without server-side chain mutation.
- **Severity rationale**: P3 because cost is CPU/calldata generation and on-chain owner checks enforce execution.
- **Pass/Fail criterion**: PASS for no server-side mutation; FAIL for durable-limiter consistency.
- **Minimal remediation recommendation**: Add durable limiter as low-priority consistency hardening.
- **Launch impact**: Low; not launch-blocking.

### APIAUTH-019

- **ID**: APIAUTH-019
- **Severity**: P3
- **Domain**: API agents — in-memory agent management limits
- **Launch decision**: accepted risk
- **Exact file path(s)**: `frontend/api/_handlers/v1/agents/creators/_enable.ts`; `_provisionWallet.ts`; `identity/_setAgentWallet.ts`
- **Function / component / route**: Agent enable/provision wallet/set-agent-wallet routes
- **Trigger or precondition**: Authenticated agent-management callers repeat DB/build operations across isolates.
- **Expected invariant**: Agent management writes should be throttled durably and validate ownership server-side.
- **Observed behavior**: In-memory limiters only. Ownership and canonical CSW checks are server-side; enable/provision writes are own-account/idempotent and set-agent-wallet is build-only.
- **Severity rationale**: P3 because ownership validation prevents cross-user abuse; limiter durability is defense-in-depth.
- **Pass/Fail criterion**: FAIL for durable-limiter standard; PASS for ownership validation.
- **Minimal remediation recommendation**: Add durable limiter for consistency.
- **Launch impact**: Low; not launch-blocking.

### WALLET-002

- **ID**: WALLET-002
- **Severity**: P3
- **Domain**: Canonical CSW execution signer policy / defense-in-depth
- **Launch decision**: accepted risk
- **Exact file path(s)**: `frontend/src/lib/tx/txRouter.ts`; `frontend/src/wallet/canonicalWalletPolicy.ts`
- **Function / component / route**: Function `assertCanonicalPolicyContext()`; function `sendViaCanonical4337()`
- **Trigger or precondition**: Future config adds an owner EOA to allowed-owner list but not execution-owner list, then sendCalls/canonicalDirect is used.
- **Expected invariant**: Canonical 4626 CSW execution should use the stricter execution signer allowlist across all canonical send modes.
- **Observed behavior**: sendCalls/canonicalDirect check broader `isAllowedCanonicalSigner`; canonical4337 uses stricter `isAllowedCanonicalCswExecutionSigner`. Current allowlists have no exploitable mismatch.
- **Severity rationale**: P3 because exploitable only after future config drift; on-chain owner checks still apply.
- **Pass/Fail criterion**: FAIL until strict execution-signer check is applied in `assertCanonicalPolicyContext()` for canonical CSW identity.
- **Minimal remediation recommendation**: Add hard block using `isAllowedCanonicalCswExecutionSigner(context.signerAddress)` when canonical identity is canonical CSW.
- **Launch impact**: Defense-in-depth before adding owner EOAs; not launch-blocking.

### WALLET-004

- **ID**: WALLET-004
- **Severity**: P3
- **Domain**: Wallet sync / primary_wallet precedence
- **Launch decision**: accepted risk
- **Exact file path(s)**: `frontend/server/_lib/wallet/disconnectExternalWallet.ts`
- **Function / component / route**: Function `resolveProfilesPrimaryWalletColumn()`
- **Trigger or precondition**: Canonical missing, embedded EOA present, and active external owner present during wallet sync/disconnect.
- **Expected invariant**: Embedded EOA should win primary_wallet display/lookup precedence consistently with disconnect logic and comments.
- **Observed behavior**: Function returns embedded only when canonical also exists; otherwise activeOwner can win over embedded. Nearby `nextPrimary` logic prioritizes embedded unconditionally.
- **Severity rationale**: P3 because `primary_wallet` is legacy display/lookup, not execution/custody truth.
- **Pass/Fail criterion**: FAIL until embedded wins whenever present.
- **Minimal remediation recommendation**: Change third branch to `input.embedded ?? input.activeOwner ?? input.classificationPrimary ?? null` and test.
- **Launch impact**: Cosmetic/identity display consistency; not launch-blocking.

### RACE-002

- **ID**: RACE-002
- **Severity**: P3
- **Domain**: Swap execution / ERC-4337 nonce coordination
- **Launch decision**: accepted risk
- **Exact file path(s)**: `frontend/src/lib/tx/coinbaseErc4337.ts`; `frontend/src/hooks/useSwapExecution.ts`
- **Function / component / route**: Function `readAnyPendingUserOpHashForWallet()`; swap receipt polling path
- **Trigger or precondition**: Same user submits swaps from two browser tabs for the same CSW concurrently.
- **Expected invariant**: Concurrent user operations should either coordinate across tabs or fail safely without double-spend.
- **Observed behavior**: Pending hash coordination uses per-tab `sessionStorage`; cross-tab submissions can collide and bundler rejects one nonce.
- **Severity rationale**: P3 because bundler nonce enforcement prevents fund loss; UX error may be confusing.
- **Pass/Fail criterion**: PASS for safety, FAIL for cross-tab UX coordination.
- **Minimal remediation recommendation**: Use `BroadcastChannel` or `localStorage` events to share pending operation state.
- **Launch impact**: Edge-case UX only.

### RACE-003

- **ID**: RACE-003
- **Severity**: P3
- **Domain**: Identity / email collision profile merge
- **Launch decision**: accepted risk
- **Exact file path(s)**: `frontend/server/_lib/identity/emailCollisionAdoption.ts`; `frontend/api/_handlers/waitlist/_bootstrap.ts`; `frontend/server/_lib/wallet/walletSync.ts`
- **Function / component / route**: Function `mergePlaceholderProfiles()`; helper `withDbTransaction()` exists elsewhere
- **Trigger or precondition**: Same Privy user triggers concurrent placeholder adoption/merge flows.
- **Expected invariant**: Profile merges should execute in one transaction or be otherwise serialized.
- **Observed behavior**: Function SELECTs placeholder IDs then iterates UPDATEs without `BEGIN/COMMIT`; idempotent updates and conflict guards provide informal safety.
- **Severity rationale**: P3 because scenario is rare and same-user; cross-user collisions are blocked.
- **Pass/Fail criterion**: FAIL until merge is transaction-wrapped.
- **Minimal remediation recommendation**: Wrap merge path in `withDbTransaction` or equivalent transaction helper.
- **Launch impact**: Low data-integrity edge case.

### RACE-004

- **ID**: RACE-004
- **Severity**: P3 (informational)
- **Domain**: AlfaClub counter-trade / multi-actor enforcement
- **Launch decision**: accepted risk
- **Exact file path(s)**: `frontend/server/alfaclub/counterTradeRunner.ts`; `frontend/server/alfaclub/counterTradeTicker.ts`
- **Function / component / route**: Functions `listActiveCounterTradeOptIns()`, `enforceSingleActiveCounterTradeActor()`; ticker `inFlight` guard
- **Trigger or precondition**: A new opt-in becomes active between list and enforce in a tick.
- **Expected invariant**: Only one active counter-trade actor should remain, and enforcement should self-heal missed changes.
- **Observed behavior**: Benign TOCTOU can miss a just-activated opt-in until next tick; ticker is single-flight and enforcement idempotent.
- **Severity rationale**: P3 informational because self-healing prevents persistent inconsistency.
- **Pass/Fail criterion**: PASS for launch; no action required.
- **Minimal remediation recommendation**: None required.
- **Launch impact**: No launch impact.

### BACKTEST-005

- **ID**: BACKTEST-005
- **Severity**: P3 (informational)
- **Domain**: Backtest — interval degradation labeling
- **Launch decision**: accepted risk
- **Exact file path(s)**: `frontend/src/pages/Arena.tsx`; `frontend/src/components/arena/ArenaBacktestAnalysis.tsx`
- **Function / component / route**: Function `describeLastRunBarSize()`; series analysis warning UI
- **Trigger or precondition**: Backtest falls back from requested/auto 1m bars to 5m or 15m bars.
- **Expected invariant**: Resolved data interval should be visible and degradation should be clear enough for interpretation.
- **Observed behavior**: Resolved interval is displayed; 1h degradation has amber warning, but 5m/15m cases lack explicit “degraded from 1m” copy.
- **Severity rationale**: P3 because data is honest and no calculation correctness bug was found.
- **Pass/Fail criterion**: PASS for data honesty; optional UX improvement for intermediate degradation.
- **Minimal remediation recommendation**: Add subtle degraded-from-1m suffix when `resolvedInterval !== 1m` and requested interval was auto/1m.
- **Launch impact**: No launch impact.

### UX-004

- **ID**: UX-004
- **Severity**: P3
- **Domain**: UX — no global sign-out in app shell
- **Launch decision**: accepted risk
- **Exact file path(s)**: `frontend/src/features/waitlist/WaitlistFlow.tsx`; `frontend/src/components/account/CanonicalIdentityCard.tsx`; `frontend/src/components/wallet/AddOwnerConnectionStatusPanel.tsx`; `frontend/src/components/wallet/BaseAppCanonicalWalletLinkPanel.tsx`; `frontend/src/components/layout/AdminLayout.tsx`
- **Function / component / route**: Scoped sign-out components; missing app-shell account menu
- **Trigger or precondition**: Authenticated user on `/swap` or `/arena` wants to switch/sign out without navigating to a scoped panel.
- **Expected invariant**: Authenticated app shell should expose account/session controls globally.
- **Observed behavior**: Sign-out exists only in contextual panels; no global header/dropdown/tray found.
- **Severity rationale**: P3 because it affects usability/trust and testing convenience, not safety.
- **Pass/Fail criterion**: FAIL until global sign-out is available on authenticated app-shell pages.
- **Minimal remediation recommendation**: Add account menu/avatar/dropdown with sign-out in app shell.
- **Launch impact**: Low UX backlog.

### UX-005

- **ID**: UX-005
- **Severity**: P3
- **Domain**: UX — deploy error boundary removes phase context
- **Launch decision**: accepted risk
- **Exact file path(s)**: `frontend/src/pages/deploy/DeployVault.tsx`; `frontend/src/components/deploy/PhaseTimeline.tsx`
- **Function / component / route**: Component `DeployVaultErrorBoundary`; component `PhaseTimeline`
- **Trigger or precondition**: React render error occurs during deploy UI rendering.
- **Expected invariant**: Deploy failure UI should preserve phase context when possible.
- **Observed behavior**: Error boundary fallback replaces deploy view with generic “Something went wrong” and unmounts timeline; normal transaction/dry-run failures do preserve phase badges.
- **Severity rationale**: P3 because render crashes are rare and normal operational failures retain context.
- **Pass/Fail criterion**: FAIL until fallback includes last-known phase or timeline is outside boundary.
- **Minimal remediation recommendation**: Preserve `PhaseTimeline` above boundary or include phase snapshot in fallback.
- **Launch impact**: Low UX backlog.

### VG-002

- **ID**: VG-002
- **Severity**: P3
- **Domain**: Validation gate — accounts/wallet rate-limit tests fail
- **Launch decision**: accepted risk
- **Exact file path(s)**: `frontend/api/__tests__/accountsWalletRateLimitHardening.test.ts`; related handlers `accounts/_link.ts`, `accounts/_unlink.ts`, `wallet/_sync.ts`
- **Function / component / route**: Validation command `pnpm -C frontend exec vitest run api/__tests__/accountsWalletRateLimitHardening.test.ts`
- **Trigger or precondition**: Run targeted accounts/wallet hardening vitest.
- **Expected invariant**: Rate-limit tests should assert expected 429 ordering or accurately reflect auth/DB prerequisite ordering.
- **Observed behavior**: All 3 tests fail: link/unlink return 503 instead of 429; wallet/sync returns 401 instead of 429.
- **Severity rationale**: P3 because it is a test/order mismatch plus evidence for limiter hardening, not an independent production exploit.
- **Pass/Fail criterion**: FAIL until suite passes or expectations are corrected with intended ordering.
- **Minimal remediation recommendation**: Fix handler ordering or adjust test mocks/expectations; then run suite clean.
- **Launch impact**: Low; cross-ref APIAUTH-004 and APIAUTH-010.

### VG-003

- **ID**: VG-003
- **Severity**: P3
- **Domain**: Validation gate — paymaster rate-limit error code test fails
- **Launch decision**: accepted risk
- **Exact file path(s)**: `frontend/api/__tests__/paymasterRateLimit.test.ts`; `frontend/api/_handlers/paymaster/_paymaster.ts`
- **Function / component / route**: Validation command `pnpm -C frontend exec vitest run api/__tests__/paymasterRateLimit.test.ts`
- **Trigger or precondition**: Run targeted paymaster rate-limit vitest.
- **Expected invariant**: Paymaster rate-limit rejection should map to JSON-RPC code `-32005`.
- **Observed behavior**: Test receives `-32000` generic error instead of `-32005`.
- **Severity rationale**: P3 because limiter rejection still happens; error code is wrong.
- **Pass/Fail criterion**: FAIL until test passes with `-32005`.
- **Minimal remediation recommendation**: Map paymaster rate-limit catch path to `-32005`.
- **Launch impact**: Low; cross-ref APIAUTH-008.

---

## Positive findings — verified safe, no risk finding issued

| ID | Domain | Verification |
|----|--------|-------------|
| LAUNCH-004 | Deploy dry-run 403 PASS gate | HTTP 403 `Creator token authority mismatch` correctly returned and treated as PASS; dry-run plumbing reached the intended guard. |
| LAUNCH-005 | Legacy dev-bypass header | `x-deploy-dry-run-dev` header rejected with 401; no production bypass found. |
| LAUNCH-006 | Deploy status/preflight read-only | `_status.ts` and `_solanaInfraStatus.ts` are read-only; mutating `_statusCore.ts` flow is only reached through resume/workflow paths. |
| LAUNCH-007 | Dry-run local-fork-only | `_dryRunCore.ts` rejects non-local-fork RPC; fork manipulation stays on Anvil/local fork. |
| LAUNCH-008 | Typecheck + lint | `pnpm -C frontend typecheck` and `pnpm -C frontend lint` passed in the launch audit pass. |

Additional safe patterns verified during race/UX/API passes: deploy lease acquisition is atomic; Telegram link-start token consumption is atomic and single-use; counter-trade event dedup uses `INSERT ... ON CONFLICT DO NOTHING`; `useSiweAuth` dedupes in-flight session fetches; KPR runner is single-workflow; Solana keeper orchestrator is stateless dispatch; swap receipt polling uses epoch/AbortController cancellation.

---

## Validation commands already run

| # | Command / gate | Exit | Result | Related finding |
|---|----------------|------|--------|-----------------|
| 1 | `git status --short --branch` (this consolidation, pre-edit) | 0 | On `audit/deep-risk-2026-06`, not `main`; no branch switch needed. | — |
| 2 | `pnpm -C frontend guard:api-readjsonbody-maxbytes` | 0 | PASS | — |
| 3 | `pnpm -C frontend guard:api-rate-limit-guards` | 0 | PASS | — |
| 4 | `pnpm -C frontend guard:api-429-retry-after` | 0 | PASS | — |
| 5 | `pnpm -C frontend guard:api-nonv1-hardening` | 1 | FAIL: `_backtest-run.ts:114` uses `readJsonBody`. | VG-001 / APIAUTH-014 |
| 6 | `pnpm -C frontend exec vitest run api/__tests__/accountsWalletRateLimitHardening.test.ts` | 1 | FAIL (3/3): expected 429, observed 503/401. | VG-002 / APIAUTH-004 / APIAUTH-010 |
| 7 | `pnpm -C frontend exec vitest run api/__tests__/authRateLimitHardening.test.ts` | 0 | PASS (7/7) | — |
| 8 | `pnpm -C frontend exec vitest run api/__tests__/deployRateLimitHardening.test.ts` | 0 | PASS (3/3) | — |
| 9 | `pnpm -C frontend exec vitest run api/__tests__/paymasterRateLimit.test.ts` | 1 | FAIL (1/1): expected `-32005`, observed `-32000`. | VG-003 / APIAUTH-008 |
| 10 | `pnpm -C frontend lint:a11y` | 0 | PASS | — |
| 11 | `A11Y_BASE_URL=https://4626.fun pnpm -C frontend smoke:a11y -- --serve` | 0 | PASS | — |
| 12 | `pnpm -C frontend typecheck` | 0 | PASS | — |
| 13 | `pnpm -C frontend lint` | 0 | PASS | — |
| 14 | `forge test` | 0 | PASS (72 tests) | — |
| 15 | `pnpm -C frontend test` | 0 | PASS (289 tests) | — |
| 16 | DRIFT-001 grep recheck | 1 | 0 matches = PASS/cleared. | DRIFT-001 |
| 17 | DRIFT-002 grep recheck | 1 | 0 matches = PASS/cleared. | DRIFT-002 |
| 18 | DRIFT-003 grep recheck | 1 | 0 matches = PASS/cleared at `docs/_internal/4626-connection-methods.md`. | DRIFT-003 |
| 19 | DRIFT-004 grep recheck | 1 | 0 matches = PASS/cleared at moved `docs/_internal/` files. | DRIFT-004 |

Three validation gates are currently failed and tracked as `VG-001` through `VG-003`. They were pre-existing; this consolidation did not modify implementation code.

---

## Final launch decision summary requested

### 1. P0 blockers

- `LAUNCH-001` — active P0 blocker. DNS for `orchestrator.4626.fun` and `provisioner.4626.fun` must point to the real Vultr services and production prelaunch verification must exit 0.
- `DRIFT-001` — original P0 docs drift is remediated and verified; no active block remains.

### 2. P1 high-risk fixes

- `DRIFT-002`, `DRIFT-003`, `DRIFT-004` — all remediated and verified clean. No active P1 fixes remain.

### 3. P2/P3 followups

- Launch path / fix before public launch: `APIAUTH-001`.
- Highest-leverage hardening: durable fail-closed rate-limit sweep covering `APIAUTH-003`, `004`, `006`, `008`, `009`, `010`, `011`, `013`, `014`, `015`, `017`, `018`, `019`.
- Targeted P2 hardening: `APIAUTH-007`, `WALLET-001`, `RACE-001`, `DRIFT-005`, `DRIFT-006`, `DRIFT-007`, `BACKTEST-002`, `BACKTEST-003`, `BACKTEST-004`, `UX-001`, `UX-002`, `UX-003`, `VG-001`.
- P3 backlog/accepted risk: `APIAUTH-002`, `005`, `011`, `012`, `013`, `015`, `017`, `018`, `019`, `WALLET-002`, `WALLET-004`, `RACE-002`, `RACE-003`, `RACE-004`, `BACKTEST-005`, `UX-004`, `UX-005`, `VG-002`, `VG-003`.

### 4. Findings rejected as duplicates or insufficient evidence

- Duplicate merged: `BACKTEST-001` → `APIAUTH-016`.
- Duplicate merged: `WALLET-003` → `APIAUTH-010`.
- Positive/no-risk: `LAUNCH-004` through `LAUNCH-008`.
- Insufficient evidence for a finding: route-map-only enumerations for keepr/uniswap/wallet.solana and remaining v1 routes. They remain coverage notes, not findings, because no handler-level defect was established.

### 5. Validation commands already run

See the validation table above and `docs/audits/deep-risk-audit-2026-06-validation-log.md` for full command output history. Failed gates are listed honestly as failed: `guard:api-nonv1-hardening`, `accountsWalletRateLimitHardening`, and `paymasterRateLimit`.

### 6. Final launch recommendation

**Unsafe to launch now** because `LAUNCH-001` is an active P0 production infrastructure blocker. Once `LAUNCH-001` is fixed and `pnpm -C frontend ops:verify-akita-prelaunch --production` exits 0, launch is **safe only after listed launch-path fixes are addressed or explicitly accepted**, especially `APIAUTH-001` for public launch readiness. P2/P3 items are not launch blockers but should be scheduled as pre-launch hardening/backlog according to `docs/audits/deep-risk-audit-2026-06-followups.md`.

---

## Audit finalization metadata

- Total findings: 48 risk findings plus 5 positive findings.
- Active blockers: 1.
- Remediated/verified: 4 DRIFT findings.
- Product/code fixes applied in this consolidation: none.
- Files intentionally updated by this consolidation: this report, endpoint matrix, validation log, and followups tracker only.
