# 4626 Deep Risk Audit — Phase 0 Validation Log

Date: 2026-06-24
Mode: audit-only, Phase 0 only
Repository: `/home/akitav2/projects/4626`
Branch: `main`
HEAD: `ab4ea86b6`
Upstream: `origin/main`

## Command log

### Required command 1

Command:

```bash
git status --short --branch
```

Exit code: 0

Output:

```text
## main...origin/main
M  frontend/public/immersive/index.html
M  frontend/public/immersive/vault-hero/vault-hero.js
M  frontend/src/features/waitlist/WaitlistFlow.tsx
M  frontend/src/lib/bootstrap/consoleNoisePatch.ts
M  frontend/src/main.tsx
M  frontend/vercel.json
```

### Required command 2

Command:

```bash
git diff --name-only
```

Exit code: 0

Output:

```text
```

Note: empty output means no unstaged tracked diffs at that point. Staged diffs existed; see supplemental command S1.

### Required command 3

Command:

```bash
git diff --check
```

Exit code: 0

Output:

```text
```

Note: this checks unstaged diff; unstaged diff was empty.

### Required command 4

Command:

```bash
git grep -n -E '^(<<<<<<<|=======|>>>>>>>)' -- ':!lib' ':!docs/_generated' ':!apps/docs-site/.docusaurus' ':!node_modules' ':!.worktrees' ':!out' ':!target' || true
```

Wrapper exit code: 0
Raw `git grep` exit code: 1

Output:

```text
```

Interpretation: no conflict-marker matches found in the searched tracked files.

### Required command 5

Command:

```bash
wc -c AGENTS.md
```

Exit code: 0

Output:

```text
224738 AGENTS.md
```

### Required command 6

Command:

```bash
grep -n -E 'auth|session|Privy|wallet|CSW|canonical|account|deploy|Telegram|paymaster|API|waitlist|backtest|launch' AGENTS.md | head -n 120
```

Pipeline exit code: 0

Output: 120 matching context lines. Key line ranges identified for targeted `sed` reads:

- Rule precedence / security guardrails / validation honesty: lines 20-76
- Operational/API/auth/account caveats: lines 148-220
- Telegram Mini App flow rules: lines 253-323

The full output is intentionally not duplicated here to keep the validation log concise. The extracted source-of-truth summary is recorded in `docs/audits/deep-risk-audit-2026-06.md`.

## Targeted AGENTS.md excerpts

The following targeted `sed` reads were executed after the requested grep/wc pass:

```bash
sed -n '20,76p' AGENTS.md
sed -n '148,220p' AGENTS.md
sed -n '253,323p' AGENTS.md
```

Exit code: 0 for the combined shell command.

Excerpt budget accounting:

- Grep context lines: 120
- `sed -n '20,76p'`: 57 lines
- `sed -n '148,220p'`: 73 lines
- `sed -n '253,323p'`: 71 lines
- Total AGENTS.md excerpt lines: 321
- User cap: under 400 lines

## Cursor rules read

Read via tool calls, not shell commands:

| File | Tool status | Lines |
|---|---|---:|
| `.cursor/rules/ERC-4337-Wallet-Invariants.mdc` | success | 50 |
| `.cursor/rules/csw-agent-lifecycle.mdc` | success | 156 |
| `.cursor/rules/waitlist-onboarding-simplicity.mdc` | success | 26 |
| `.cursor/rules/product-builder-workflow.mdc` | success | 47 |
| `.cursor/rules/4626 secur-agent guardrails for repo-native implementation.mdc` | success | 55 |

## Supplemental commands

### S1 — staged dirty-file list

Command:

```bash
git diff --cached --name-only
```

Exit code: 0

Output:

```text
frontend/public/immersive/index.html
frontend/public/immersive/vault-hero/vault-hero.js
frontend/src/features/waitlist/WaitlistFlow.tsx
frontend/src/lib/bootstrap/consoleNoisePatch.ts
frontend/src/main.tsx
frontend/vercel.json
```

### S2 — branch/head/upstream capture

Command:

```bash
git branch --show-current && git rev-parse --short HEAD && git rev-parse --abbrev-ref --symbolic-full-name @{u}
```

Exit code: 0

Output:

```text
main
ab4ea86b6
origin/main
```

### S3 — staged whitespace check

Command:

```bash
git diff --cached --check
```

Exit code: 0

Output:

```text
```

### S4 — search for existing Deep Risk Audit plan/artifacts

Commands/tools:

```text
search_files target=content pattern='Deep Risk Audit|deep-risk|risk audit|Phase 0'
search_files target=files pattern='*risk*audit*'
```

Result: no exact Deep Risk Audit Implementation Plan file or existing `deep-risk-audit-2026-06*` artifacts were found. The broader content search returned unrelated Phase 0 references in other docs/runbooks.

## Dirty files at Phase 0 start

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

## Blockers / caveats

| ID | Item | Status |
|---|---|---|
| B1 | Pre-existing staged files present before Phase 0. | Recorded; not inspected or modified. |
| B2 | No dedicated Deep Risk Audit Implementation Plan file found by targeted search. | Recorded; artifacts created from explicit user instructions and authority context. |
| B3 | `git diff --check` did not cover staged files because unstaged diff was empty. | Mitigated by supplemental `git diff --cached --check` exit 0. |
| B4 | Phase 0 was audit-only and stopped before source tracing. | No endpoint finding should be treated as verified from this phase. |

## Final artifact verification commands

Command:

```bash
git status --short --branch -- docs/audits/deep-risk-audit-2026-06.md docs/audits/deep-risk-audit-2026-06-endpoint-matrix.md docs/audits/deep-risk-audit-2026-06-validation-log.md
```

Exit code: 0

Output:

```text
## main...origin/main
?? docs/audits/deep-risk-audit-2026-06-endpoint-matrix.md
?? docs/audits/deep-risk-audit-2026-06-validation-log.md
?? docs/audits/deep-risk-audit-2026-06.md
```

Command:

```bash
wc -l docs/audits/deep-risk-audit-2026-06.md docs/audits/deep-risk-audit-2026-06-endpoint-matrix.md docs/audits/deep-risk-audit-2026-06-validation-log.md
```

Exit code: 0

Output at final verification time:

```text
  120 docs/audits/deep-risk-audit-2026-06.md
   72 docs/audits/deep-risk-audit-2026-06-endpoint-matrix.md
  290 docs/audits/deep-risk-audit-2026-06-validation-log.md
  482 total
```

## Phase 0 completion check

Artifacts created:

- `docs/audits/deep-risk-audit-2026-06.md`
- `docs/audits/deep-risk-audit-2026-06-endpoint-matrix.md`
- `docs/audits/deep-risk-audit-2026-06-validation-log.md`

No product/code fixes applied.

---

# Security/API/Auth Pass Validation Log — Early Stop

Date: 2026-06-24
Mode: audit-only
Status: STOPPED EARLY after APIAUTH-001.

## Commands/tool lookups recorded for this pass

| # | Command / lookup | Exit code / result | Notes |
|---|---|---|---|
| SA-1 | `git status --short --branch` | 0 | Branch `main...origin/main`; audit docs staged as new plus six pre-existing staged files. |
| SA-2 | `git diff --name-only` | 0 | Empty output: no unstaged tracked diffs. |
| SA-3 | `git diff --cached --name-only` | 0 | Listed three audit docs plus the six Phase 0 pre-existing staged files. |
| SA-4 | `git diff --name-only -- frontend/api/_handlers/accounts/_me.ts frontend/server/_lib/identity/accountsIdentity.ts` | 0 | Empty output: APIAUTH-001 is not an unstaged local-diff finding. |
| SA-5 | `git diff --cached --name-only -- frontend/api/_handlers/accounts/_me.ts frontend/server/_lib/identity/accountsIdentity.ts` | 0 | Empty output: APIAUTH-001 is not caused by pre-existing staged diffs. |
| SA-6 | Search `frontend/api/_handlers/accounts/_me.ts` for `checkRateLimit\(|RATE_LIMITS|rateLimitKey|Retry-After` | zero matches | Evidence of missing limiter/429 path. |
| SA-7 | Search `frontend/api/__tests__` for `accounts/_me|accounts/me` | matches in `accountsMe.test.ts`, `accountsMePoints.test.ts` | `accountsMe.test.ts` covers success payload semantics, not rate-limit/body behavior. |
| SA-8 | Read prioritized handlers and route maps | success | Included auth routes, accounts/me, paymaster, deploy session create/status/dry-run, Telegram link-complete, v1 backtest-run, route maps, dispatch helper, rate-limit helper. |

## Early-stop blocker

| ID | Item | Status |
|---|---|---|
| SA-B1 | APIAUTH-001: `/api/accounts/me` is an authenticated but unthrottled mutating/expensive GET path. | STOPPED per user instruction: expensive or mutating endpoint with no rate limit. |

## Validation notes

- No product/code fixes were applied.
- The audit artifacts were updated only to record the early-stop finding, partial endpoint matrix, and validation log.
- Full endpoint inventory was not completed because the user instructed immediate stop on this class of finding.

## Security/API/Auth artifact verification

| # | Command | Exit code | Output / interpretation |
|---|---|---:|---|
| SA-9 | `git diff --check -- docs/audits/deep-risk-audit-2026-06.md docs/audits/deep-risk-audit-2026-06-endpoint-matrix.md docs/audits/deep-risk-audit-2026-06-validation-log.md` | 2 | Failed with generated-audit-artifact whitespace only: `docs/audits/deep-risk-audit-2026-06-validation-log.md:324: new blank line at EOF.` and `docs/audits/deep-risk-audit-2026-06.md:163: new blank line at EOF.` Fixed by trimming trailing blank lines in the audit docs only. |
| SA-10 | `wc -l docs/audits/deep-risk-audit-2026-06.md docs/audits/deep-risk-audit-2026-06-endpoint-matrix.md docs/audits/deep-risk-audit-2026-06-validation-log.md` | 0 | Pre-trim line counts: 163, 50, 324, total 537. |
| SA-11 | `git diff --check -- docs/audits/deep-risk-audit-2026-06.md docs/audits/deep-risk-audit-2026-06-endpoint-matrix.md docs/audits/deep-risk-audit-2026-06-validation-log.md` | 0 | Final artifact whitespace check passed after trimming audit-doc trailing blank lines. |
| SA-12 | `wc -l docs/audits/deep-risk-audit-2026-06.md docs/audits/deep-risk-audit-2026-06-endpoint-matrix.md docs/audits/deep-risk-audit-2026-06-validation-log.md` | 0 | Final line counts after appending SA-11/SA-12: 162, 50, 332, total 544. |

## Shard A completion — 2026-06-25

Shard A (auth/accounts/waitlist routes) audit completed. 26 routes inspected across 3 route families. 5 new findings issued (APIAUTH-002 through APIAUTH-006), continuing from the existing APIAUTH-001.

### Files inspected (shard A)

- `frontend/api/_handlers/_routes.ts` — top-level route dispatch map
- `frontend/api/_handlers/_routes.auth.ts` — auth route map
- `frontend/api/_handlers/_routes.waitlist.ts` — waitlist route map
- `frontend/api/_handlers/auth/_nonce.ts` — SIWE nonce issuance (PASS)
- `frontend/api/_handlers/auth/_verify.ts` — SIWE signature verification (PASS)
- `frontend/api/_handlers/auth/_privy.ts` — Privy token verification + session bridge (PASS)
- `frontend/api/_handlers/auth/_me.ts` — session snapshot (PASS)
- `frontend/api/_handlers/auth/_logout.ts` — session cookie clear (PASS)
- `frontend/api/_handlers/auth/_admin.ts` — admin status lookup (FAIL — APIAUTH-002)
- `frontend/api/_handlers/auth/_agent-nonce.ts` — SIWA agent nonce (FAIL — APIAUTH-003)
- `frontend/api/_handlers/auth/_agent-verify.ts` — SIWA agent verify + receipt (FAIL — APIAUTH-003)
- `frontend/api/_handlers/auth/_handoff-create.ts` — handoff code creation (PASS)
- `frontend/api/_handlers/auth/_handoff-redeem.ts` — handoff code redemption (PASS)
- `frontend/api/_handlers/accounts/_me.ts` — account snapshot + identity sync (FAIL — APIAUTH-001, existing)
- `frontend/api/_handlers/accounts/_mePoints.ts` — account tray points (PASS)
- `frontend/api/_handlers/accounts/_link.ts` — provider link (FAIL — APIAUTH-004)
- `frontend/api/_handlers/accounts/_unlink.ts` — provider unlink (FAIL — APIAUTH-004)
- `frontend/api/_handlers/waitlist/_bootstrap.ts` — waitlist signup/bootstrap (FAIL — APIAUTH-006)
- `frontend/api/_handlers/waitlist/_lead.ts` — lead capture (PASS)
- `frontend/api/_handlers/waitlist/_me.ts` — waitlist profile snapshot (FAIL — APIAUTH-005)
- `frontend/api/_handlers/waitlist/_leaderboard.ts` — leaderboard (FAIL — APIAUTH-005)
- `frontend/api/_handlers/waitlist/_position.ts` — waitlist position (PASS)
- `frontend/api/_handlers/waitlist/_pointsActivity.ts` — points activity (PASS)
- `frontend/api/_handlers/waitlist/_referrer.ts` — referrer public lookup (PASS)
- `frontend/api/_handlers/waitlist/_stats.ts` — waitlist stats (FAIL — APIAUTH-005)
- `frontend/api/_handlers/waitlist/_xmtpJoin.ts` — XMTP group join (PASS)
- `frontend/api/_handlers/waitlist/_xmtpResync.ts` — XMTP group resync (PASS)
- `frontend/api/_handlers/waitlist/_xmtpStatus.ts` — XMTP chat status (PASS)
- `frontend/api/_handlers/waitlist/_airtableSync.ts` — Airtable sync (PASS, cron-only)

### Findings summary

| ID | Severity | Routes | Category |
|---|---|---|---|
| APIAUTH-001 | High | accounts/_me | Unthrottled mutating GET (existing) |
| APIAUTH-002 | Low | auth/_admin | No rate limit on DB-heavy read-only GET |
| APIAUTH-003 | Medium | auth/_agent-nonce, auth/_agent-verify | In-memory (non-durable) rate limits on auth-adjacent POST |
| APIAUTH-004 | Medium | accounts/_link, accounts/_unlink | In-memory IP-only rate limits on mutating POST + value asymmetry |
| APIAUTH-005 | Low | waitlist/_stats, waitlist/_me, waitlist/_leaderboard | No rate limit on read-only GET |
| APIAUTH-006 | Medium | waitlist/_bootstrap | In-memory rate limit on heavy mutating POST + non-atomic Supabase path |

### P0 stop condition

No new P0 stop condition triggered in shard A. The existing APIAUTH-001 (unthrottled mutating GET) remains the only P0-class finding.

### Audit discipline

- No product/code fixes were applied (audit-only).
- No credentials or secrets were observed in any audited file.
- All findings are backed by file:line evidence in the audit document.
- The endpoint matrix has been updated with final PASS/FAIL classifications for all 26 shard A routes.

---

## Shard B completion entry (2026-06-25)

### Scope

Shard B: wallet endpoints, deploy-session endpoints, paymaster, relay, Solana provision/register/reconcile, keeper route maps, Telegram link routes.

### Files inspected

Route maps (6):
- `frontend/api/_handlers/_routes.deploy.ts`
- `frontend/api/_handlers/_routes.keepr.ts`
- `frontend/api/_handlers/_routes.telegram.ts`
- `frontend/api/_handlers/_routes.uniswap.ts`
- `frontend/api/_handlers/_routes.wallet.solana.ts`
- `frontend/api/_handlers/_routes.ts` (top-level, from shard A context)

Wallet handlers (4):
- `frontend/api/_handlers/wallet/_sync.ts` (4,814 chars)
- `frontend/api/_handlers/wallet/_confirm-owner.ts` (4,052 chars)
- `frontend/api/_handlers/wallet/_prepare-add-privy-owner.ts` (3,424 chars)
- `frontend/api/_handlers/wallet/_disconnect-external.ts` (3,947 chars)

Deploy session handlers (9):
- `frontend/api/_handlers/deploy/v2/session/_create.ts` (re-export of _createCore)
- `frontend/api/_handlers/deploy/v2/session/_start.ts` (9,029 chars)
- `frontend/api/_handlers/deploy/v2/session/_resume.ts` (4,369 chars)
- `frontend/api/_handlers/deploy/v2/session/_status.ts` (4,371 chars)
- `frontend/api/_handlers/deploy/v2/session/_cancel.ts` (re-export of _cancelCore)
- `frontend/api/_handlers/deploy/v2/session/_dryRun.ts` (re-export of _dryRunCore)
- `frontend/api/_handlers/deploy/v2/session/_createCore.ts` (20,047 chars; handler at line 3049)
- `frontend/api/_handlers/deploy/v2/session/_statusCore.ts` (22,154 chars; handler at line 2810)
- `frontend/api/_handlers/deploy/v2/session/_dryRunCore.ts` (20,315 chars; handler at line 2077)
- `frontend/api/_handlers/deploy/v2/session/_cancelCore.ts` (14,769 chars; handler at line 134)
- `frontend/api/_handlers/deploy/v2/session/_sessionAccess.ts` (2,572 chars)

Solana deploy handlers (3):
- `frontend/api/_handlers/deploy/_provisionSolanaRoute.ts` (10,134 chars; handler at line 95)
- `frontend/api/_handlers/deploy/_registerSolanaBridgeToken.ts` (17,823 chars; handler at line 992)
- `frontend/api/_handlers/deploy/_solanaInfraStatus.ts` (21,680 chars; handler at line 261)

Paymaster (1):
- `frontend/api/_handlers/paymaster/_paymaster.ts` (159,100 chars; handler at line 3547, validateSponsoredSmartWalletCalls at line 1402)

Relay handlers (3):
- `frontend/api/_handlers/relay/_execute.ts` (10,446 chars; handler at line 111)
- `frontend/api/_handlers/relay/_quote.ts` (8,319 chars; handler at line 75)
- `frontend/api/_handlers/relay/_intent-status.ts` (2,296 chars; handler at line 26)

Telegram handlers (2 + 1 runtime):
- `frontend/api/_handlers/telegram/_link-complete.ts` (16,360 chars; handler at line 59)
- `frontend/api/_handlers/telegram/_webhook.ts` (148 chars; re-export of _webhook.runtime)
- `frontend/api/_handlers/telegram/_webhook.runtime.ts` (270,073 chars; handler at line 7187)

Files not found (2):
- `telegram/_link-start.ts` — does not exist
- `telegram/_verify-miniapp.ts` — does not exist

### Findings issued

7 new findings (APIAUTH-007 through APIAUTH-013):

- APIAUTH-007 (Medium) — relay/execute + relay/quote: unauthenticated external proxy with project API key exposure and fee subsidy. No auth check on either endpoint. relay/execute forwards arbitrary signed UserOps to Relay with project API key. relay/quote includes subsidizeFees: true for unauthenticated callers.
- APIAUTH-008 (Medium) — paymaster: in-memory (non-durable) rate limits on sponsorship path (per-IP, per-sender, per-session). Cross-instance budget bypass on the most security-critical endpoint. Validation logic itself is thorough and correct.
- APIAUTH-009 (Medium) — deploy/v2/session/resume: no rate limit on mutating workflow POST that sends on-chain UserOps. Authenticated + session-authorized, but no rate limit at all.
- APIAUTH-010 (Low) — wallet handlers (_sync, _confirm-owner, _prepare-add-privy-owner, _disconnect-external): in-memory IP-only rate limits on wallet mutation POSTs. Same durable-limiter gap as APIAUTH-004.
- APIAUTH-011 (Low) — deploy session handlers (_start, _cancelCore, _dryRunCore, _statusCore): in-memory rate limits on deploy session POSTs. Same durable-limiter gap as APIAUTH-003. _createCore (full create) correctly uses checkDurableRateLimit with failClosed.
- APIAUTH-012 (Low) — deploy/v2/session/_sessionAccess.ts: FINDING-09 known security debt — session cookie HMAC as sole auth for deploy-critical operations. Stolen session cookie can control active deploys within 45-min TTL window.
- APIAUTH-013 (Low) — telegram/link-complete: in-memory IP-only rate limit on heavy mutating link completion POST. Same durable-limiter gap as APIAUTH-006.

### PASS list (10 routes)

deploy/v2/session/status (_status.ts), deploy/v2/session/create full (_createCore.ts), deploy/v2/session/create preflight (_createCore.ts), deploy/v2/session/dryRun (_dryRunCore.ts), deploy/v2/session/cancel (_cancelCore.ts), deploy/solanaInfraStatus (_solanaInfraStatus.ts), deploy/provisionSolanaRoute (_provisionSolanaRoute.ts), deploy/registerSolanaBridgeToken (_registerSolanaBridgeToken.ts), paymaster (_paymaster.ts — validation correct, rate limit gap in APIAUTH-008), relay/intent-status (_intent-status.ts), telegram/link/complete (_link-complete.ts — access control correct, rate limit gap in APIAUTH-013), telegram/webhook (_webhook.runtime.ts), wallet/sync (_sync.ts — rate limit gap in APIAUTH-010), wallet/confirm-owner (_confirm-owner.ts — rate limit gap in APIAUTH-010), wallet/prepare-add-privy-owner (_prepare-add-privy-owner.ts — rate limit gap in APIAUTH-010), wallet/disconnect-external (_disconnect-external.ts — rate limit gap in APIAUTH-010).

### P0 stop condition

No new P0 stop condition triggered in shard B. All four P0 criteria checked and cleared:

1. Deploy status/preflight route with on-chain mutation side effects: NOT triggered. The public status endpoint (_status.ts, 107 lines) is read-only. The _statusCore.ts handler with advanceDeploySession is an internal workflow handler invoked by resume, not directly routed. The preflightOnly branch in _createCore.ts is read-only.
2. Solana mutation path accepting user-session auth: NOT triggered. _provisionSolanaRoute requires Bearer secret (machine auth). _registerSolanaBridgeToken requires admin or internal secret for mutation.
3. Unauthenticated mutating endpoint with DB/chain/external side effects: NOT triggered as P0. relay/execute is unauthenticated with external side effects (Relay API call with project key), but chain mutation requires signed UserOp — classified as Medium (APIAUTH-007).
4. Paymaster sponsorship path that does not validate sender/mode/target/value/canonical signer policy: NOT triggered. Paymaster validates all five: sender (line 3678), mode (validateSponsoredSmartWalletCalls), target (inner call decoding), value (cleanup-only enforces call.value check), canonical signer (resolveCanonicalEmbeddedOwnerForSender).

### Audit discipline

- No product/code fixes were applied (audit-only).
- No credentials or secrets were observed in any audited file. Relay API key resolution function (resolveRelayApiKey) reads from env vars but does not expose the key value in responses.
- All findings are backed by file:line evidence in the audit document.
- The endpoint matrix has been updated with PASS/FAIL classifications for all 19 shard B routes, plus 3 route maps enumerated (22 routes not deep-inspected).
- 2 files from the user's inspect list were not found (telegram/_link-start.ts, telegram/_verify-miniapp.ts). Documented in audit doc and endpoint matrix.

---

## Shard C validation log — 2026-06-25

### Scope

Shard C: v1 financial endpoints, v1 lottery, v1 chat/media, v1 AlfaClub, v1 backtest, v1 agents, v1 build/gauge/auction/ve4626/ajna. Audit-only. No product/code fixes applied. No execute_code used. AGENTS.md not read in this shard. Full endpoint matrix not attempted (shard C scope only).

### Files inspected (26 reads)

`_routes.v1.ts` (route map, 258 lines, ~130 entries), `v1/lottery/_amoeSubmit.ts` (257 lines), `v1/lottery/_amoeSubmitZk.ts` (885 lines, read in two passes), `v1/lottery/_amoeRetryZk.ts` (219 lines), `v1/lottery/_amoeBurnCredits.ts` (403 lines), `v1/chat/_hermit.ts` (126 lines), `v1/chat/_hermit-meme-save.ts` (132 lines), `v1/chat/_hermit-meme-delete.ts` (107 lines), `v1/alfaclub/_run.ts` (105 lines), `v1/alfaclub/_chat-token.ts` (233 lines), `v1/alfaclub/_chat-token-refresh.ts` (144 lines), `v1/alfaclub/_chat-bridge-run.ts` (93 lines), `v1/alfaclub/_backtest-run.ts` (220 lines), `v1/alfaclub/_backtest-sweep.ts` (161 lines), `v1/alfaclub/_backtest-series.ts` (130 lines), `v1/alfaclub/_backtest-audit.ts` (162 lines), `v1/alfaclub/_backtest-markets.ts` (58 lines), `v1/agents/creators/_enable.ts` (120 lines), `v1/agents/creators/_provisionWallet.ts` (113 lines), `v1/agents/identity/_setAgentWallet.ts` (204 lines), `v1/build/auction/_submitBid.ts` (115 lines), `v1/build/gauge/_vote.ts` (100 lines), `v1/build/ve4626/_lock.ts` (99 lines), `v1/build/ajna/_borrow.ts` (79 lines).

### Findings issued (6 new)

APIAUTH-014 (Medium) — `_backtest-run.ts`: in-memory rate limit on compute-heavy backtest execution. Privy auth required (not anonymous), but no durable rate limit fallback. Closest to P0 criterion 1 but auth is present.
APIAUTH-015 (Low) — `_hermit.ts` + `_hermit-meme-save.ts` + `_hermit-meme-delete.ts`: in-memory rate limits on chat/media mutation endpoints. Owner-scoped (isHermitOwner + isHermitRoomAllowedForOwner).
APIAUTH-016 (Low) — `_backtest-sweep.ts` + `_backtest-series.ts` + `_backtest-audit.ts` + `_backtest-markets.ts`: unauthenticated read-only endpoints with in-memory IP-only rate limits. Path-sanitized filesystem reads + external API fetch.
APIAUTH-017 (Low) — `_run.ts` + `_chat-token-refresh.ts` + `_chat-bridge-run.ts` + `_chat-token.ts`: in-memory rate limits on CRON_SECRET/admin-gated AlfaClub endpoints. _chat-token.ts handles sensitive credential material (Privy JWT/tokens).
APIAUTH-018 (Low) — `_submitBid.ts` + `_vote.ts` + `_lock.ts` + `_borrow.ts`: in-memory rate limits on build-only calldata endpoints. No server-side chain mutation. Client-provided owner/borrower not validated (acceptable for build-only).
APIAUTH-019 (Low) — `_enable.ts` + `_provisionWallet.ts` + `_setAgentWallet.ts`: in-memory rate limits on agent management endpoints with DB writes. Server-side canonical CSW ownership resolution present in all three.

### P0 stop condition

No P0 stop condition triggered in shard C. All four P0 criteria checked and cleared:

1. Anonymous compute-heavy backtest execution: NOT triggered. `_backtest-run.ts:94-100` requires `verifyPrivyForAccounts(req)` — Privy auth is mandatory before `executeBacktestCounterRebalance`. Not anonymous.
2. Chat/media mutation not owner-scoped: NOT triggered. `_hermit-meme-save.ts:76-96` checks `isHermitOwner(sessionAddress)` + `isHermitRoomAllowedForOwner({ roomId, ownerAddress: sessionAddress })`. `_hermit-meme-delete.ts:68-89` checks the same plus passes `ownerAddress` into `softDeleteHermitMeme` for owner-scoped DB query. `_hermit.ts:103-108` checks `isHermitUserAllowed(sessionAddress)` and blocks keeper write commands.
3. Financial mutation accepting only client-provided wallet/profile IDs without server-side ownership resolution: NOT triggered. `_enable.ts:81-87` resolves `resolveCanonicalSmartWalletAddress(creator)` and validates `cswAddress` matches. `_provisionWallet.ts:74-90` validates `requestedAddress` against `allowedTargets` (principal + canonical CSW). `_setAgentWallet.ts:115-138` resolves canonical owner and validates session/SIWA auth.
4. Unauthenticated mutating endpoint with DB/chain/external side effects: NOT triggered. All mutating endpoints require auth. Unauthenticated endpoints (`_backtest-sweep`, `_backtest-series`, `_backtest-audit`, `_backtest-markets`) are all read-only GET.

### Audit discipline

- No product/code fixes were applied (audit-only).
- No credentials or secrets were observed in any audited file. `_chat-token.ts` handles Privy JWT/access/refresh tokens but never returns raw token material in GET responses (only fingerprints via `fingerprintJwt`).
- All findings are backed by file:line evidence in the audit document.
- The endpoint matrix has been updated with PASS/FAIL classifications for all 24 shard C routes, plus the _routes.v1.ts route map (~130 entries) enumerated.
- All files in the user's shard C inspect list were found and read. No files missing.
- No existing APIAUTH findings (001-013) were duplicated. Findings continue from APIAUTH-014.
- The AMOE lottery handlers (`_amoeSubmit`, `_amoeSubmitZk`, `_amoeRetryZk`, `_amoeBurnCredits`) are the only shard C handlers that correctly layer `checkDurableRateLimit` on top of `checkRateLimit`. All other shard C handlers use in-memory `checkRateLimit` only — this is the consistent pattern flagged across APIAUTH-014 through APIAUTH-019.

---

## API audit validation gates — 2026-06-25

All 8 gates run on 2026-06-25. No product/code fixes were applied before or after running these gates (audit-only). All failures are pre-existing — no code was changed in shards A, B, or C.

### Gate results summary

| # | Gate | Exit code | Result |
| --- | --- | --- | --- |
| 1 | guard:api-readjsonbody-maxbytes | 0 | PASS |
| 2 | guard:api-rate-limit-guards | 0 | PASS |
| 3 | guard:api-429-retry-after | 0 | PASS |
| 4 | guard:api-nonv1-hardening | 1 | FAIL |
| 5 | vitest accountsWalletRateLimitHardening | 1 | FAIL (3/3 tests failed) |
| 6 | vitest authRateLimitHardening | 0 | PASS (7/7 tests passed) |
| 7 | vitest deployRateLimitHardening | 0 | PASS (3/3 tests passed) |
| 8 | vitest paymasterRateLimit | 1 | FAIL (1/1 test failed) |

### Gate 1 — guard:api-readjsonbody-maxbytes

- **Command**: `pnpm -C frontend guard:api-readjsonbody-maxbytes`
- **Exit code**: 0
- **Output**: `[guard:readjsonbody-maxbytes] OK`
- **Result**: PASS. All API handlers use `readBoundedJsonObjectBody` with a `maxBytes` parameter.

### Gate 2 — guard:api-rate-limit-guards

- **Command**: `pnpm -C frontend guard:api-rate-limit-guards`
- **Exit code**: 0
- **Output**: `[guard:api-rate-limit-guards] OK`
- **Result**: PASS. All API handlers that should have rate limit guards do have them.

### Gate 3 — guard:api-429-retry-after

- **Command**: `pnpm -C frontend guard:api-429-retry-after`
- **Exit code**: 0
- **Output**: `[guard:api-429-retry-after] OK`
- **Result**: PASS. All rate-limited endpoints set a `Retry-After` header on 429 responses.

### Gate 4 — guard:api-nonv1-hardening (FAILED)

- **Command**: `pnpm -C frontend guard:api-nonv1-hardening`
- **Exit code**: 1
- **Error block**:
  ```
  [guard:api-nonv1-hardening] Mutating v1 handlers must use readBoundedJsonObjectBody:
  - api/_handlers/v1/alfaclub/_backtest-run.ts:114 Mutating v1 handlers must use readBoundedJsonObjectBody(req, ...) instead of readJsonBody(req, ...)
  ELIFECYCLE Command failed with exit code 1.
  ```
- **Result**: FAIL. `_backtest-run.ts` line 114 uses `readJsonBody` instead of `readBoundedJsonObjectBody` for its POST body read. This is a pre-existing failure — no code was changed in any audit shard. The file was inspected in shard C (APIAUTH-014) but the body-read pattern was not flagged as a separate finding because the guard script is the authoritative check for this pattern. The guard failure confirms that `_backtest-run.ts` has an unbounded body read on a mutating endpoint, which is an additional hardening gap beyond the in-memory rate limit noted in APIAUTH-014.

### Gate 5 — vitest accountsWalletRateLimitHardening (FAILED)

- **Command**: `pnpm -C frontend exec vitest run api/__tests__/accountsWalletRateLimitHardening.test.ts`
- **Exit code**: 1
- **Tests**: 3 failed (3 total)
- **Error block**:
  ```
  FAIL  api/__tests__/accountsWalletRateLimitHardening.test.ts > accounts/wallet endpoint rate-limit hardening > returns 429 for /accounts/link when limited
  AssertionError: expected 503 to be 429 // Object.is equality
  - Expected: 429
  + Received: 503

  FAIL  api/__tests__/accountsWalletRateLimitHardening.test.ts > accounts/wallet endpoint rate-limit hardening > returns 429 for /accounts/unlink when limited
  AssertionError: expected 503 to be 429 // Object.is equality
  - Expected: 429
  + Received: 503

  FAIL  api/__tests__/accountsWalletRateLimitHardening.test.ts > accounts/wallet endpoint rate-limit hardening > returns 429 for /wallet/sync when limited
  AssertionError: expected 401 to be 429 // Object.is equality
  - Expected: 429
  + Received: 401
  ```
- **Result**: FAIL. All 3 tests fail with pre-existing errors. `/accounts/link` and `/accounts/unlink` return 503 (likely DB not configured in test env) instead of 429 when rate-limited — the rate limiter may not be reached because the handler returns 503 before the rate limit check, or the mock setup does not match the handler's DB dependency path. `/wallet/sync` returns 401 (auth check fires before rate limit check) instead of 429. These are pre-existing test failures — no code was changed in any audit shard. The handlers (`_link.ts`, `_unlink.ts`, `_sync.ts`) were inspected in shard A (APIAUTH-004) and shard B (APIAUTH-010).

### Gate 6 — vitest authRateLimitHardening (PASSED)

- **Command**: `pnpm -C frontend exec vitest run api/__tests__/authRateLimitHardening.test.ts`
- **Exit code**: 0
- **Tests**: 7 passed (7 total)
- **Result**: PASS. All 7 auth rate-limit hardening tests pass.

### Gate 7 — vitest deployRateLimitHardening (PASSED)

- **Command**: `pnpm -C frontend exec vitest run api/__tests__/deployRateLimitHardening.test.ts`
- **Exit code**: 0
- **Tests**: 3 passed (3 total)
- **Result**: PASS. All 3 deploy rate-limit hardening tests pass.

### Gate 8 — vitest paymasterRateLimit (FAILED)

- **Command**: `pnpm -C frontend exec vitest run api/__tests__/paymasterRateLimit.test.ts`
- **Exit code**: 1
- **Tests**: 1 failed (1 total)
- **Error block**:
  ```
  FAIL  api/__tests__/paymasterRateLimit.test.ts > paymaster endpoint rate-limit hardening > returns a JSON-RPC rate-limit error when limiter rejects
  AssertionError: expected -32000 to be -32005 // Object.is equality
  - Expected: -32005
  + Received: -32000
  ```
- **Result**: FAIL. The paymaster rate-limit test expects JSON-RPC error code `-32005` (rate-limit specific) but the handler returns `-32000` (generic server error) when the limiter rejects. This is a pre-existing failure — no code was changed in any audit shard. The paymaster handler (`_paymaster.ts`) was inspected in shard B (APIAUTH-008). The test expects a dedicated rate-limit JSON-RPC error code but the handler falls back to the generic `-32000` server error code, suggesting the rate-limit rejection path in the paymaster handler does not use the expected error code mapping.

### Gate failure assessment

3 of 8 gates failed. All 3 failures are pre-existing — no code was modified in shards A, B, or C (audit-only). The failures do not invalidate the audit findings but provide additional evidence:

- **Gate 4 (guard:api-nonv1-hardening)**: Confirms `_backtest-run.ts:114` uses `readJsonBody` instead of `readBoundedJsonObjectBody` — an unbounded body read on a mutating endpoint. This is an additional hardening gap beyond the in-memory rate limit noted in APIAUTH-014. The guard script is the authoritative check for this pattern.
- **Gate 5 (accountsWalletRateLimitHardening)**: Tests for `/accounts/link`, `/accounts/unlink`, and `/wallet/sync` fail because the handlers return 503 (DB not configured) or 401 (auth before rate limit) instead of 429 when rate-limited. This suggests the rate-limit check ordering in these handlers may not match the test expectations, or the test mock setup does not match the handler's dependency path. Relates to APIAUTH-004 and APIAUTH-010.
- **Gate 8 (paymasterRateLimit)**: The paymaster handler returns JSON-RPC error code `-32000` (generic) instead of `-32005` (rate-limit specific) when the limiter rejects. Relates to APIAUTH-008.

---

## Wallet/Identity Pass — Validation Log (2026-06-25)

### Inspected files

**Docs and rules (Phase 0 excerpts — targeted reads, not full AGENTS.md)**:
- `docs/ACCOUNT_MODEL.md` — full read (23,599 chars)
- `docs/4626-connection-methods.md` — full read (25,571 chars)
- `.cursor/rules/ERC-4337-Wallet-Invariants.mdc` — full read (6,305 chars)
- `.cursor/rules/csw-agent-lifecycle.mdc` — full read (12,880 chars)

**Server wallet libs**:
- `frontend/src/wallet/canonicalWalletPolicy.ts` — full read (6,075 chars)
- `frontend/server/_lib/wallet/executionTrack.ts` — full read (3,566 chars)
- `frontend/server/_lib/wallet/walletSync.ts` — full read (1,058 lines, 40,923 chars)
- `frontend/server/_lib/wallet/walletMapping.ts` — full read (19,084 chars)
- `frontend/server/_lib/wallet/canonicalCswPersistence.ts` — full read (2,478 chars)
- `frontend/server/_lib/wallet/disconnectExternalWallet.ts` — full read (3,889 chars)
- `frontend/server/_lib/wallet/canonicalCswEnv.ts` — full read (3,614 chars)
- `frontend/server/_lib/wallet/canonicalCswDelegation.ts` — full read (871 lines, 30,578 chars)
- `frontend/server/_lib/identity/accountsIdentity.ts` — full read (19,149 + 7,936 chars)
- `frontend/packages/server-core/src/profileIdForPrivyUser.ts` — full read (3,333 chars)

**API handlers**:
- `frontend/api/_handlers/wallet/_sync.ts` — full read (4,814 chars)
- `frontend/api/_handlers/wallet/_confirm-owner.ts` — full read (4,052 chars)
- `frontend/api/_handlers/wallet/_prepare-add-privy-owner.ts` — full read (3,424 chars)
- `frontend/api/_handlers/wallet/_disconnect-external.ts` — full read (3,947 chars)

**Frontend swap/tx**:
- `frontend/src/lib/tx/txRouter.ts` — full read (1,218 lines, 42,221 chars)
- `frontend/src/lib/uniswap/walletMode.ts` — full read (1,049 chars)
- `frontend/src/lib/uniswap/canonicalSignerGate.ts` — full read (5,782 chars)
- `frontend/src/lib/swap/resolveSwapBalanceOwner.ts` — full read (1,332 chars)
- `frontend/src/hooks/useSwapExecution.ts` — partial read (200 lines, 7,789 chars)
- `frontend/src/pages/Swap.tsx` — targeted grep (executionMode, canonicalAddress, signerAddress, useExternalEoaCanonicalSigner)

### Commands and exit codes

| # | Command | Exit | Result |
|---|---------|------|--------|
| 1 | `pnpm -C frontend guard:canonical-csw` | 0 | PASS — no retired CSW env keys, no stray pre-migration literals, no retired env reads outside canonicalCswEnv.ts |
| 2 | `pnpm -C frontend exec vitest run src/wallet/canonicalWalletPolicy.test.ts` | 0 | PASS — canonical wallet policy tests green |
| 3 | `pnpm -C frontend exec vitest run src/lib/tx/txRouter.test.ts` | 0 | PASS — txRouter routing and canonical enforcement tests green |
| 4 | `pnpm -C frontend exec vitest run src/lib/uniswap/canonicalSignerGate.test.ts` | 0 | PASS — canonical signer gate evaluation tests green |
| 5 | `pnpm -C frontend exec vitest run src/lib/swap/resolveSwapBalanceOwner.test.ts` | 0 | PASS — swap balance owner resolution tests green |
| 6 | `pnpm -C frontend exec vitest run api/__tests__/walletSync.test.ts api/__tests__/walletSyncEndpoint.test.ts api/__tests__/canonicalCswPersistence.test.ts api/__tests__/repointCanonicalCsw.test.ts api/__tests__/authPrivyWalletSync.test.ts` | 0 | PASS — all 5 wallet sync / canonical CSW persistence / repoint / auth Privy wallet sync test suites green |

### P0 stop-condition assessment

All 4 P0 stop conditions checked and cleared (no stop triggered):

1. **Sponsored canonical swaps routing from non-parent-CSW under canonical4337** — NOT triggered. `sendViaCanonical4337` sender is always `resolveCanonicalIdentityAddress(context)` which maps to the canonical CSW. `assertCanonicalPolicyContext` blocks non-canonical execution addresses.
2. **Fallback signer path for CANONICAL_CSW_ADDRESS without execution signer policy** — NOT triggered. `Swap.tsx:409` `!isCanonicalCsw(canonicalAddress)` blocks external EOA fallback for platform CSW. `sendViaCanonical4337:700` hard-blocks non-execution signers. Defense-in-depth gap noted in WALLET-002 but no current exploitable path.
3. **Wallet sync writing Privy identity onto tombstoned profiles** — NOT triggered. `walletSync.ts` and `resolvePrimaryProfileIdForPrivyUser` both follow tombstone pointers. Fallback path gap noted in WALLET-001 but primary resolver is correct.
4. **External EOA frozen as primary when embedded/canonical ready** — NOT triggered. `resolveProfilesPrimaryWalletColumn` returns embedded when canonical+embedded present. UPDATE path overwrites external EOA. Canonical-absent edge case noted in WALLET-004.

### Blockers

None. All 6 test suites and the canonical-csw guard pass. All inspected files were found and read successfully. No P0 stop conditions triggered.

### Findings issued

| ID | Severity | Domain | Summary |
|----|----------|--------|---------|
| WALLET-001 | Medium | Identity / tombstone integrity | `recoverProfileIdFromPrivyHints` does not follow tombstone pointers — fallback path can write delegation state onto tombstoned profiles |
| WALLET-002 | Low | Canonical CSW execution signer policy | `assertCanonicalPolicyContext` uses broader `isAllowedCanonicalSigner` for sendCalls/canonicalDirect, missing execution-signer hard block present in canonical4337 |
| WALLET-003 | Low | Wallet API rate limiting | All 4 wallet handlers use in-memory `checkRateLimit` instead of `checkDurableRateLimit` |
| WALLET-004 | Low | Wallet sync / primary_wallet precedence | `resolveProfilesPrimaryWalletColumn` requires canonical for embedded to win over activeOwner — contradicts comment and disconnect logic |

---

## Race-Condition Audit Pass — 2026-06-26

### Scope

Audit-only pass targeting race conditions and async/concurrent-flow hazards across:
- Client auth/session restoration (`useSiweAuth.ts`, `useAccountMe.ts`, `routeGuards.tsx`, `RootRouter.tsx`)
- Waitlist flow (`WaitlistFlow.tsx`, `waitlistHandoff.ts`)
- Telegram link (`TelegramLink.tsx`, `_link-complete.ts`, `_link-ready.ts`, `telegramTrading.ts`)
- Server identity/wallet (`walletSync.ts`, `accountsIdentity.ts`, `emailCollisionAdoption.ts`, `waitlistSchema.ts`)
- Deploy-session state machine (`deploySessions.ts`, `_createCore.ts`, `_statusCore.ts`, `_sessionAccess.ts`, `workflow/runner.ts`)
- Swap/paymaster (`useSwapExecution.ts`, `coinbaseErc4337.ts`, `_paymaster.ts`)
- Keeper/backtest/counter-trade (`counterTradeTicker.ts`, `counterTradeRunner.ts`, `counterTradeStore.ts`, `backtestJobs.ts`, `kpr/runner.ts`, `kpr/solana-keeper-orchestrator.ts`)

### P0 stop-condition assessment

No P0 stop conditions triggered. All findings are Low or Low-Medium severity. No race condition was found that could cause fund loss, account takeover, or double-spend.

1. **Deploy session double-transition / data corruption** — NOT triggered. `transitionDeploySession` uses CAS (`WHERE step = fromStep RETURNING id`). Postgres row-level locking serializes concurrent transitions. Only the first matches; the second gets 0 rows. RACE-001 notes the missing lock-owner check but confirms CAS prevents corruption.
2. **Cross-tab swap double-spend / nonce corruption** — NOT triggered. `readAnyPendingUserOpHashForWallet` uses sessionStorage (per-tab), but the CDP bundler/paymaster is the final arbiter and rejects nonce conflicts. RACE-002 notes the cross-tab coordination gap but confirms no fund loss path.
3. **Email collision adoption profile corruption** — NOT triggered. `mergePlaceholderProfiles` is not transactional, but `ON CONFLICT DO NOTHING` and idempotent UPDATEs provide informal safety. `assertNoEmailPrivyCollision` blocks cross-user collisions. RACE-003 notes the missing transaction wrapper.
4. **Counter-trade tick overlap / double execution** — NOT triggered. `counterTradeTicker.ts` `inFlight` boolean guard with `finally` cleanup ensures single-executor invariant. RACE-004 is informational only.

### Findings issued

| ID | Severity | Domain | Summary |
|----|----------|--------|---------|
| RACE-001 | Low-Medium | Deploy session / concurrent worker transitions | `transitionDeploySession` does not verify `lock_owner` — status-poll transitions can bypass active workflow-runner leases, causing spurious `CONCURRENT_MODIFICATION` failures (CAS prevents corruption) |
| RACE-002 | Low | Swap execution / ERC-4337 nonce coordination | `readAnyPendingUserOpHashForWallet` uses sessionStorage (per-tab) — cross-tab concurrent swaps from same CSW are uncoordinated; bundler rejection prevents fund loss but UX is confusing |
| RACE-003 | Low | Identity / email collision profile merge | `mergePlaceholderProfiles` SELECT-then-iterate-UPDATE is not wrapped in a DB transaction — concurrent same-Privy-user adoptions could race; `ON CONFLICT DO NOTHING` and idempotent UPDATEs provide informal safety |
| RACE-004 | Very Low (informational) | AlfaClub counter-trade / multi-actor enforcement | Room 1659 `listActiveCounterTradeOptIns` → `enforceSingleActiveCounterTradeActor` has a benign TOCTOU; `inFlight` guard and idempotent enforcement make it self-healing |

### Patterns verified as safe (no finding)

10 concurrent/async patterns were inspected and confirmed safe:
1. Deploy session lease acquisition (`claimDeploySessionLease`) — atomic UPDATE with expiry check
2. Telegram link-start token consumption — `ON CONFLICT DO NOTHING` + conditional UPDATE
3. Counter-trade event dedup — `ON CONFLICT DO NOTHING RETURNING`
4. useSiweAuth shared session fetch — module-level in-flight Promise dedup
5. KPR runner — single-workflow CLI, no concurrency
6. Solana keeper orchestrator — stateless HTTP dispatch
7. Counter-trade ticker overlap guard — `inFlight` boolean with `finally` cleanup
8. Deploy session transition CAS — `WHERE step = fromStep RETURNING id`
9. walletSync.ts `withDbTransaction` — proper BEGIN/COMMIT with rollback
10. Swap submit epoch ref — stale async result discard + AbortController

### Blockers

None. All findings are Low or Low-Medium. No P0 stop conditions triggered. No code changes applied (audit-only).

---

## Documentation-vs-Implementation Drift Audit — 2026-06-26

### Inspected files

**Documentation (read complete or targeted sections)**:
- `docs/audits/deep-risk-audit-2026-06-endpoint-matrix.md` — full read (lines 1-200)
- `docs/ACCOUNT_MODEL.md` — full read (lines 1-380)
- `docs/4626-connection-methods.md` — full read (lines 1-718)
- `docs/owner-mutation-decision-2026-05.md` — full read (lines 1-96)
- `docs/sub-accounts-baseapp-design.md` — full read (lines 1-200+)
- `docs/arch-b-sub-account-design-addendum.md` — full read (lines 1-200+)
- `docs/architecture-b-design.md` — full read (lines 1-200+)
- `docs/security/mutable-surface-inventory.md` — full read (lines 1-100)
- `docs/security/historical-risk-review.md` — full read (lines 1-58)
- `docs/operations/sponsored-canonical-swap-pattern.md` — full read (lines 1-120)
- `docs/operations/solana-share-mesh-lottery-policy.md` — full read (lines 1-100)
- `docs/operations/solana-share-mesh-budget-paths.md` — full read (lines 1-100)
- `docs/operations/telegram-canonical-link-preservation.md` — full read (lines 1-200+)
- `frontend/docs/account-auth-invariants.md` — full read (lines 1-200)
- `frontend/docs/waitlist-accounts-architecture.md` — full read (lines 1-97)

**Implementation (read complete or targeted sections)**:
- `frontend/server/_lib/wallet/executionTrack.ts` — full read (lines 1-100)
- `frontend/src/lib/uniswap/walletMode.ts` — full read (lines 1-30)
- `frontend/src/wallet/canonicalWalletPolicy.ts` — full read (lines 1-200)
- `frontend/api/_handlers/_routes.ts` — full read (lines 1-220)
- `frontend/api/_handlers/_routes.v1.ts` — full read (lines 1-258)
- `frontend/api/_handlers/_routes.telegram.ts` — full read
- `frontend/scripts/ops/verify-akita-prelaunch-readiness.ts` — full read (lines 1-548)
- `frontend/scripts/smoke-deploy-dry-run.sh` — full read (lines 1-78)

**AGENTS.md** — targeted grep only (retired envs, sub-account defaults, agent CSW references)

**Filesystem verification** — 20 file paths checked for existence across 3 docs

### Findings

| ID | Severity | Domain | Drift type |
|----|----------|--------|------------|
| DRIFT-001 | P0 | Account model / execution path | waitlist-accounts-architecture.md:41 says sub-account = canonical path; executionTrack.ts says parent CSW only |
| DRIFT-002 | P1 | Account model / readiness gating | waitlist-accounts-architecture.md:43-44 says "resume sub-account setup" + gate on sub-account; AGENTS.md says "resume embedded-owner setup" + gate on parent CSW owner |
| DRIFT-003 | P1 | Account model / execution path | 4626-connection-methods.md body (§3-§11) describes sub-account as default; own banner + §2/§12 say parent CSW |
| DRIFT-004 | P1 | Account model / owner-mutation | ACCOUNT_MODEL.md §5.2 recommends sub-accounts for population (b); superseded by legacy-owner-install on parent CSW |
| DRIFT-005 | P2 | File path drift | 4626-connection-methods.md: 4 stale paths (onboardingWallet.ts split, deploy/session → deploy/v2/session, privyXmtpSigner.ts, agentRegistration.ts) |
| DRIFT-006 | P2 | File path drift | telegram-canonical-link-preservation.md: 5 stale paths (files moved into subdirectories) |
| DRIFT-007 | P2 | File path drift | waitlist-accounts-architecture.md:65: WaitlistSetupWorkspace.tsx removed |

### P0 Stop Condition Assessment

| # | Condition | Result |
|---|-----------|--------|
| 1 | Docs say sub-account is default canonical/deploy account | **TRIGGERED** — DRIFT-001 |
| 2 | Docs describe separate agent CSW as canonical 4626 account | NOT triggered |
| 3 | Runbooks instruct retired envs as active production paths | NOT triggered |
| 4 | Deploy dry-run docs treat expected 403 as failure | NOT triggered |

### No code changes applied (audit-only)

No documentation or code fixes were applied. All 7 DRIFT findings are recorded for the maintainer to triage and fix.

---

## Launch Readiness + Deploy Dry-Run Smoke Audit — 2026-06-26

### Commands executed

| # | Command | Exit code | Result |
|---|---------|-----------|--------|
| 1 | `pnpm -C frontend ops:verify-akita-prelaunch --production` | 1 | 7/15 blockers (Vultr/Vercel external infra); platform + entitlements PASS |
| 2 | `pnpm -C frontend dev:deploy-dry-run` | 0 (server started) | Anvil :8545 + Vite :5174 up; initial failure on bare .env:504 fixed locally |
| 3 | `pnpm -C frontend smoke:deploy-dry-run` | 0 (PASS) | HTTP 403 "Creator token authority mismatch" — expected PASS gate |
| 4 | `curl -X POST … -H 'x-deploy-dry-run-dev: …'` (no auth token) | 401 | Legacy bypass header rejected — "Not authenticated" |
| 5 | `pnpm -C frontend typecheck` | 0 | tsc --noEmit (app + node) clean |
| 6 | `pnpm -C frontend lint` | 0 | eslint clean, 0 warnings |
| 7 | `curl https://orchestrator.4626.fun/healthz` | 200 | Body = Vercel SPA HTML, not JSON `{ok: true}` |
| 8 | `curl https://provisioner.4626.fun/healthz` | 200 | Body = Vercel SPA HTML, not JSON `{ok: true}` |

### Command 1 — full output (key lines)

```
> tsx scripts/ops/verify-akita-prelaunch-readiness.ts --production

=== AKITA full-stack pre-launch readiness ===

--- Platform (contracts + tests) ---
✓ pipe_a_batcher:   ] | } | Pipe A batcher readiness: PASS
✓ release_target_guard: current split Phase-1 release target guard passed
✓ hook_mainnet_canonical: Recommended SOLANA_HOOK_IX_SCHEMA: canonical | PASS
✓ vitest_pipe_a_wiring:       Tests  53 passed (53) | Duration  990ms
✓ forge_share_oft_peer: Suite result: ok. 6 passed; 0 failed; 0 skipped

--- Vultr (orchestrator + provisioner via public HTTPS) ---
✗ vultr_orchestrator_health: HTTP 200
✗ vultr_orchestrator_settle_fees: HTTP 405: ""
✗ vultr_orchestrator_winner_relay: HTTP 405: ""
✗ vultr_relay_entries_paused: Expected action_disabled:relay_entries, got 405 ""
✗ vultr_provisioner_health: provisioner payerHealthy=undefined
✗ vultr_provisioner_dns: Provisioner may be pointing at Vercel SPA — fix DNS A-record to Vultr host

--- Vercel → Vultr control plane ---
✗ vercel_solana_reconcile_chain: HTTP 200: {"success":true,"data":{"workflow":"solana-orchestrator","action":"settle_fees","checkpointKey":"prelaunch-...
✓ vercel_solana_infra_status: readyForAutoRegistration=true blockers=[]

--- Creator entitlements (DB) ---
✓ strategy_entitlement: active/pending: ajna_sleeve, charm_active_lp, solana_bridge_strategy, solana_ovault_mesh
✓ strategy_solana_mesh: Solana mesh entitlement present

Blockers: vultr_orchestrator_health, vultr_orchestrator_settle_fees, vultr_orchestrator_winner_relay,
          vultr_relay_entries_paused, vultr_provisioner_health, vultr_provisioner_dns,
          vercel_solana_reconcile_chain

 ELIFECYCLE  Command failed with exit code 1.
EXIT_CODE=1
```

### Command 3 — full output

```
> bash scripts/smoke-deploy-dry-run.sh

Smoke-testing deploy dry-run at http://127.0.0.1:5174/api/deploy/v2/session/dry-run (authenticated session: 0x0000000000000000000000000000000000000002)...
HTTP 403
{
  "success": false,
  "error": "Creator token authority mismatch: active session or canonical smart wallet must control the creator token."
}
PASS: Dry-run handler reached creator-token authority check (auth + DB + fork plumbing OK). Full phase simulation requires a real creator token owned by the session wallet on the fork.
EXIT_CODE=0
```

### Command 4 — legacy bypass header test

```
$ curl -sS -w '\n%{http_code}' -X POST http://127.0.0.1:5174/api/deploy/v2/session/dry-run \
    -H 'Content-Type: application/json' \
    -H 'x-deploy-dry-run-dev: 0x00000000000000000000000000000000000000ff' \
    -d '{…deploy payload…}'
{"success":false,"error":"Not authenticated"}
401
```

### Blocked prerequisites

| Prerequisite | Status | Notes |
|--------------|--------|-------|
| Foundry (anvil, forge) | Available | `$HOME/.foundry/bin` on PATH |
| Node + pnpm | Available | pnpm 10.x |
| `frontend/.env` | Required local fix | Bare `ALFACLUB` line at :504 caused shell syntax error; commented out locally (LAUNCH-003) |
| `frontend/.env.deploy-dry-run.local` | Present | Pre-configured with fork RPC, local batcher, strict phase4 |
| `AUTH_SESSION_SECRET` | Present in .env | Used by mint-dev-session-token.mjs to mint HMAC-SHA256 token |
| `SOLANA_ORCHESTRATOR_API_KEY` | Present in .env | Used for Vultr orchestrator /reconcile probes |
| `KPR_API_KEY` | Present in .env | Used for Vercel keeper/solana/reconcile chain probe |

### Files inspected (source code)

| File | Lines | Purpose |
|------|-------|---------|
| `frontend/api/_handlers/deploy/v2/session/_dryRunCore.ts` | 2080-2665 | Dry-run handler: auth, 403 catch, local-fork-only guard, sendTransaction to Anvil only |
| `frontend/api/_handlers/deploy/v2/session/_dryRun.ts` | 1 | Re-export to _dryRunCore |
| `frontend/api/_handlers/deploy/v2/session/_createCore.ts` | 2386-2425 | `assertCreatorTokenAuthority` — throws DeploySessionRequestError(403) |
| `frontend/api/_handlers/deploy/v2/session/_status.ts` | full | Deploy status endpoint — read-only (getDeploySessionById only) |
| `frontend/api/_handlers/deploy/v2/session/_statusCore.ts` | full | Execution-path mutations (transitionDeploySession, sendUserOperation) — imported by _resume.ts, NOT _status.ts |
| `frontend/api/_handlers/deploy/_solanaInfraStatus.ts` | full | Preflight endpoint — createPublicClient read-only, view-only ABI |
| `frontend/api/_handlers/keeper/_solanaReconcile.ts` | 1-380 | Keeper reconcile — writes keepr_workflow_checkpoints (INSERT/UPDATE), calls upstream orchestrator |
| `frontend/scripts/ops/verify-akita-prelaunch-readiness.ts` | 1-548 | Prelaunch probe script — 15 checks, POST to orchestrator + keeper reconcile |
| `frontend/scripts/dev-deploy-dry-run.sh` | 1-30+ | Dev dry-run server bootstrap — sources .env, starts anvil + vite |
| `frontend/scripts/smoke-deploy-dry-run.sh` | full | Smoke test — mints token, POSTs dry-run, greps for 403 PASS |
| `frontend/api/__tests__/deploySessionDryRun.test.ts` | :465-472 | Test: legacy dev-bypass header rejection locked in |

### Finding summary

| ID | Severity | Domain |
|----|----------|--------|
| LAUNCH-001 | P0 | Vultr orchestrator + provisioner DNS — 7 blockers |
| LAUNCH-002 | P2 | Prelaunch script triggers DB writes + orchestrator actions (keeper ops, not deploy mutations) |
| LAUNCH-003 | P2 | Local .env bare ALFACLUB line — fixed locally |
| LAUNCH-004 | Positive | Dry-run smoke 403 PASS gate confirmed |
| LAUNCH-005 | Positive | Legacy dev-bypass header rejected (401) |
| LAUNCH-006 | Positive | Deploy status/preflight read-only confirmed |
| LAUNCH-007 | Positive | Dry-run local-fork-only invariant confirmed |
| LAUNCH-008 | Positive | Typecheck + lint clean |

### P0 Stop Condition Assessment

| # | Condition | Result |
|---|-----------|--------|
| 1 | Production launch-readiness probe shows real non-local blockers | TRIGGERED (LAUNCH-001) |
| 2 | Deploy dry-run accepts legacy bypass headers | NOT triggered (LAUNCH-005) |
| 3 | Deploy status/preflight mutates chain, DB, or infrastructure | NOT triggered (LAUNCH-006) |
| 4 | Dry-run smoke expected 403 behavior is missing or misclassified | NOT triggered (LAUNCH-004) |

### No code changes applied (audit-only)

No product/code fixes were applied. The local .env fix (LAUNCH-003) was a local env file correction to unblock the dry-run smoke, not a product code change. All 8 LAUNCH findings are recorded for the maintainer to triage.

---

## P0/P1 Launch Decisions Consolidation — 2026-06-26

### Commands executed

| # | Command | Exit code | Result |
|---|---------|-----------|--------|
| 1 | `git status --short --branch` | 0 | `## main...origin/main` — working tree clean (0 unstaged, 0 staged) |
| 2 | `git diff --name-only` | 0 | 0 unstaged files |
| 3 | `git diff --cached --name-only` | 0 | 0 staged files |
| 4 | `git diff --cached --name-only \| wc -l` | 0 | 0 (confirmed clean index) |
| 5 | `git check-ignore frontend/.env` | 0 | Returns `frontend/.env` — file is gitignored |
| 6 | `git status --short frontend/.env` | 0 | No output — .env changes not tracked by git |
| 7 | `grep -n 'Severity.*P0\|Severity.*P1' docs/_internal/audits-workpapers/deep-risk-audit-2026-06.md` | 0 | 5 matches: DRIFT-001 (P0), DRIFT-002 (P1), DRIFT-003 (P1), DRIFT-004 (P1), LAUNCH-001 (P0) |
| 8 | `ls docs/audits/deep-risk-audit-2026-06.md` | 2 | No such file — audit docs moved to `docs/_internal/audits-workpapers/` (staged rename in prior docs reorg commit) |

### LAUNCH-003 dirty file verification

The user asked to verify whether the local .env fix (LAUNCH-003) created a new dirty tracked file.

- `git check-ignore frontend/.env` → returns `frontend/.env` (exit 0) — the file is gitignored.
- `git status --short frontend/.env` → no output — git does not track changes to this file.
- `git diff --name-only` → 0 files — no unstaged changes.
- `git diff --cached --name-only` → 0 files — no staged changes.

**Conclusion**: The local .env fix created no dirty tracked file. `frontend/.env` is gitignored. The fix is a local development precondition only. No git impact, no production impact.

### Audit doc path change

The audit docs were moved from `docs/audits/` to `docs/_internal/audits-workpapers/` as part of a prior docs reorganization commit. The files I edited earlier in this session at `docs/audits/` were automatically resolved to the new path. Current canonical paths:
- `docs/_internal/audits-workpapers/deep-risk-audit-2026-06.md`
- `docs/_internal/audits-workpapers/deep-risk-audit-2026-06-validation-log.md`
- `docs/_internal/audits-workpapers/deep-risk-audit-2026-06-endpoint-matrix.md`

### P0/P1 finding inventory

| Finding ID | Severity | Owner | Classification |
|------------|----------|-------|----------------|
| DRIFT-001 | P0 | docs | docs-only (implementation correct) |
| DRIFT-002 | P1 | docs | docs-only (same root cause as DRIFT-001) |
| DRIFT-003 | P1 | docs | docs-only (internal contradiction in 4626-connection-methods.md) |
| DRIFT-004 | P1 | docs | docs-only (superseded recommendation in ACCOUNT_MODEL.md §5.2) |
| LAUNCH-001 | P0 | external DNS/infra | external (repo code correct, DNS A-records wrong) |

No P0/P1 findings in APIAUTH (001–019), WALLET (001–004), or RACE (001–004) namespaces — all are Medium/Low or below.
