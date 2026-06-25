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
