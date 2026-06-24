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
