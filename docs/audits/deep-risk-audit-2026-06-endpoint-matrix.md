# 4626 Deep Risk Audit — Canonical Endpoint Matrix

Date: 2026-06-27
Mode: audit-only consolidation — endpoint findings merged from prior Security/API/Auth shards; no new broad audit run
Repository: `/home/akitav2/projects/4626`
Branch confirmed before finalization: `audit/deep-risk-2026-06`
Status: CONSOLIDATED — shard A, shard B, and shard C endpoint findings are merged here and cross-referenced to the canonical final report.

## Scope note

This file is the canonical endpoint matrix companion to `deep-risk-audit-2026-06.md`. It consolidates the endpoint evidence already gathered in the audit workpapers. It does **not** claim full handler coverage for route-map-only areas: keepr, uniswap, wallet.solana, and the remaining v1 route-map entries were enumerated but not deep-inspected, so they remain coverage notes rather than findings.

## Consolidated endpoint risk summary

| Shard | Scope | Fully inspected routes | Findings | Highest normalized severity | Notes |
|-------|-------|------------------------|----------|-----------------------------|-------|
| A | Auth / accounts / waitlist | 26 | APIAUTH-001 through APIAUTH-006 | P2 | `APIAUTH-001` is the highest-risk endpoint issue and is fix-before-launch, but not P0/P1 because it requires Privy auth. |
| B | Wallet / deploy / paymaster / relay / Solana / keeper / Telegram | 19 | APIAUTH-007 through APIAUTH-013 | P2 | Route maps for keepr, uniswap, and wallet.solana were enumerated but not deep-inspected. |
| C | v1 financial / lottery / chat-media / AlfaClub / backtest / agents / build | 24 | APIAUTH-014 through APIAUTH-019 | P2 | `_routes.v1.ts` was enumerated; only the 24 scoped handlers were deep-inspected. |
| Total | Endpoint audit scope | 69 | 19 endpoint findings | P2 | No endpoint finding met the P0/P1 bar after severity normalization. |

Deduplication reflected in the final report: `BACKTEST-001` is merged into `APIAUTH-016`; `WALLET-003` is merged into `APIAUTH-010`.

## Matrix columns

| Column | Meaning |
|---|---|
| Route key | Static route-map key or public API route. |
| Handler file | Concrete handler file inspected. |
| HTTP methods | Methods accepted by the handler. |
| Public/authenticated/admin/machine-auth classification | Observed access control. |
| Mutating or read-only | Observed side-effect class. |
| External side effects | External systems touched or potentially touched. |
| Rate-limit key and limit | Observed limiter key/limit or missing. |
| Body parser and maxBytes value | Observed request body handling. |
| Timeout behavior | Observed explicit timeout behavior; Vercel/global timeout if none. |
| Tests covering auth/rate/body behavior | Tests found during this pass. |
| Audit status | PASS/FAIL/NEEDS MANUAL REVIEW. |

## Endpoint matrix — shard A (auth/accounts/waitlist routes)

### Shard A — fully inspected routes

| Route key | Handler file | HTTP methods | Access class | Mutating/read-only | External side effects | Rate-limit key and limit | Body parser / maxBytes | Timeout | Tests | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| `accounts/me` | `accounts/_me.ts` | GET | Authenticated (Privy) | Mutating read: syncEmailIdentity + upsertAccount | Privy verify/getUser; DB writes | MISSING | N/A (GET) | Vercel catch-all | `accountsMe.test.ts` (payload only) | FAIL — APIAUTH-001 |
| `accounts/me-points` | `accounts/_mePoints.ts` | GET | Authenticated (Privy) | Read-only | Privy verify | `accounts-me-points:<ip>` 60/min in-memory | N/A (GET) | None | Not found | PASS |
| `accounts/link` | `accounts/_link.ts` | POST | Authenticated (Privy) | Mutating: syncEmailIdentity + recordProviderLink | Privy verify; DB writes | `accounts-link:<ip>` in-memory `RATE_LIMITS.cswLink` | `readBoundedJsonObjectBody` 16KB | None | Not found | FAIL — APIAUTH-004 |
| `accounts/unlink` | `accounts/_unlink.ts` | POST | Authenticated (Privy) | Mutating: syncEmailIdentity + recordProviderUnlink | Privy verify; DB writes | `accounts-unlink:<ip>` in-memory `RATE_LIMITS.cswLink` | `readBoundedJsonObjectBody` 16KB | None | Not found | FAIL — APIAUTH-004 |
| `auth/nonce` | `auth/_nonce.ts` | GET | Public | Session-adjacent: nonce cookie | Cookie issuance | `authNonce` in-memory with Retry-After | N/A (GET) | None | Not fully traced | PASS |
| `auth/verify` | `auth/_verify.ts` | POST | Public + SIWE signature | Mutating: SIWE verify, session cookie | Cookie; DB wallet sync | `checkDurableRateLimit` failClosed=true (Postgres) | JSON body bounded | None | Not fully traced | PASS |
| `auth/privy` | `auth/_privy.ts` | POST | Authenticated (Privy token) | Mutating: Privy/session bridge, session cookie | Privy verify/getUser; DB sync; cookie | `checkDurableRateLimit` failClosed=true (Postgres) | JSON body bounded | None | Not fully traced | PASS |
| `auth/me` | `auth/_me.ts` | GET | Cookie/session | Read-only session snapshot | None | `authRead` in-memory with Retry-After | N/A (GET) | None | Not fully traced | PASS |
| `auth/logout` | `auth/_logout.ts` | POST | Session/cookie | Mutating: clears session cookie | Cookie | `authWrite` in-memory with Retry-After | N/A | None | Not fully traced | PASS |
| `auth/admin` | `auth/_admin.ts` | GET | Session-cookie (getSessionAddress) | Read-only: admin status lookup | DB reads (up to 4 queries) | MISSING — no rate limit | N/A (GET) | None | Not found | FAIL — APIAUTH-002 |
| `auth/agent-nonce` | `auth/_agent-nonce.ts` | POST | Public (agent identity) | Mutating: SIWA nonce creation | DB nonce store; on-chain isOwnerAddress (12s RPC timeout) | `auth-agent-nonce:<ip>` in-memory `authAgentWrite` | `readBoundedJsonObjectBody` 16KB | 12s RPC timeout | Not found | FAIL — APIAUTH-003 |
| `auth/agent-verify` | `auth/_agent-verify.ts` | POST | Public + SIWA signature | Mutating: SIWA verify, receipt token | DB nonce consume; on-chain ownerOf (12s RPC timeout) | `auth-agent-verify:<ip>` in-memory `authAgentWrite` | `readJsonBody` 16KB | 12s RPC timeout | Not found | FAIL — APIAUTH-003 |
| `auth/handoff/create` | `auth/_handoff-create.ts` | POST | Authenticated (principal) | Mutating: handoff code creation | DB handoff store | `auth-handoff-create:<principal>:<ip>` 20/min in-memory | `readBoundedJsonObjectBody` 8KB | None | Not fully traced | PASS |
| `auth/handoff/redeem` | `auth/_handoff-redeem.ts` | POST | Public (code-based) | Mutating: handoff code consumption, session cookie | DB handoff consume; cookie | Global 100 failed/min + per-IP 30/min in-memory | `readJsonBody` 8KB | None | Not fully traced | PASS |
| `waitlist/bootstrap` | `waitlist/_bootstrap.ts` | POST | Public (Privy token optional) | Mutating: account/profile/referral/points upsert | Privy verify+retry; Zora SDK; Basename RPC; DB writes | `waitlist:bootstrap:<ip>` in-memory `RATE_LIMITS.general` | `readBoundedJsonObjectBody` 16KB | 1.5s per external lookup; 12s RPC | Not found | FAIL — APIAUTH-006 |
| `waitlist/lead` | `waitlist/_lead.ts` | POST | Public (lead capture) | Mutating: DB insert/upsert | DB writes | `waitlist:lead:<ip>` in-memory `RATE_LIMITS.general` | `readBoundedJsonObjectBody` 16KB | None | Not found | PASS |
| `waitlist/me` | `waitlist/_me.ts` | GET | Auth-optional (principal) | Read-only | DB reads (3 queries) | MISSING — no rate limit | N/A (GET) | None | Not found | FAIL — APIAUTH-005 |
| `waitlist/leaderboard` | `waitlist/_leaderboard.ts` | GET | Auth-optional (principal) | Read-only | DB reads | MISSING — no rate limit | N/A (GET) | None | Not found | FAIL — APIAUTH-005 |
| `waitlist/position` | `waitlist/_position.ts` | GET | Auth-optional + owner-auth | Read-only | DB reads | `waitlist-position:<ip>` 60/min in-memory | N/A (GET) | None | Not found | PASS |
| `waitlist/points-activity` | `waitlist/_pointsActivity.ts` | GET | Authenticated (Privy) | Read-only | Privy verify; DB reads | `waitlist-points-activity:<ip>` 60/min in-memory | N/A (GET) | None | Not found | PASS |
| `waitlist/referrer` | `waitlist/_referrer.ts` | GET | Public | Read-only | DB reads (2 queries) | `waitlist-referrer:<ip>` 60/min in-memory | N/A (GET) | None | Not found | PASS |
| `waitlist/stats` | `waitlist/_stats.ts` | GET | Public | Read-only | DB COUNT query | MISSING — no rate limit | N/A (GET) | None | Not found | FAIL — APIAUTH-005 |
| `waitlist/xmtp-join` | `waitlist/_xmtpJoin.ts` | POST | Authenticated (principal) | Mutating: enqueue keepr action | DB reads/writes; keepr action | `waitlist-xmtp-join:<profileId>:<ip>` in-memory `workspaceActions` | N/A (no body) | None | Not found | PASS |
| `waitlist/xmtp-resync` | `waitlist/_xmtpResync.ts` | POST | Authenticated (principal) | Mutating: enqueue keepr action | DB reads/writes; keepr action | `waitlist-xmtp-resync:<profileId>:<ip>` in-memory `workspaceActions` | N/A (no body) | None | Not found | PASS |
| `waitlist/xmtp-status` | `waitlist/_xmtpStatus.ts` | GET | Authenticated (principal) | Read-only | DB reads | `waitlist-xmtp-status:<profileId>:<ip>` in-memory `workspaceActions` | N/A (GET) | None | Not found | PASS |
| `waitlist/airtable-sync` | `waitlist/_airtableSync.ts` | POST/GET | Machine auth (`isAuthorizedCron`) | Mutating: sync to Airtable | Airtable API; DB reads | None (cron auth gate) | N/A | None | Not found | PASS |

### Shard A — PASS/FAIL tally

- FAIL: 6 findings (APIAUTH-001 through APIAUTH-006) across 10 routes
- PASS: 16 routes with adequate controls
- P0 stop condition: triggered once (APIAUTH-001, existing — unthrottled mutating GET)

### Non-shard-A routes (inspected before shard A, retained for context)

| Route key | Handler file | Status |
|---|---|---|
| `v1/alfaclub/backtest-run` | `v1/alfaclub/_backtest-run.ts` | NEEDS MANUAL REVIEW (not shard A or B) |

## Endpoint matrix — shard B (wallet/deploy/paymaster/relay/Solana/keeper/Telegram routes)

### Shard B — fully inspected routes

| Route key | Handler file | HTTP methods | Access class | Mutating/read-only | External side effects | Rate-limit key and limit | Body parser / maxBytes | Timeout | Tests | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| `wallet/sync` | `wallet/_sync.ts` | POST | Authenticated (Privy) | Mutating: sync Privy wallets to DB | Privy getUser; DB writes | `cswLink:<ip>` in-memory `RATE_LIMITS.cswLink` | `readBoundedJsonObjectBody` 16KB | None | Not found | FAIL — APIAUTH-010 |
| `wallet/confirm-owner` | `wallet/_confirm-owner.ts` | POST | Authenticated (auth inside `confirmOwnerState`) | Mutating: DB + on-chain owner check | DB reads; on-chain `isOwnerAddress` | `cswLink:<ip>` in-memory `RATE_LIMITS.cswLink` | `readBoundedJsonObjectBody` 8KB | None | Not found | FAIL — APIAUTH-010 |
| `wallet/prepare-add-privy-owner` | `wallet/_prepare-add-privy-owner.ts` | POST | Authenticated (Privy verify) | Mutating: returns add-owner tx request | Privy verify; DB reads | `cswLink:<ip>` in-memory `RATE_LIMITS.cswLink` | N/A (no body) | None | Not found | FAIL — APIAUTH-010 |
| `wallet/disconnect-external` | `wallet/_disconnect-external.ts` | POST | Authenticated (`readRequestPrincipalAddress`) | Mutating: disconnect external wallet | DB writes | `cswLink:<ip>` in-memory `RATE_LIMITS.cswLink` | `readBoundedJsonObjectBody` (implicit) | None | Not found | FAIL — APIAUTH-010 |
| `deploy/v2/session/create` | `deploy/v2/session/_createCore.ts` | POST | Authenticated (`readDeployAuthFromRequest`) | Mutating: DB + deploy session creation (full); read-only (preflight) | DB writes; on-chain (full create only) | Full: `checkDurableRateLimit` failClosed=true; Preflight: in-memory 20/min | `readJsonBody` bounded | None | Not found | PASS |
| `deploy/v2/session/start` | `deploy/v2/session/_start.ts` | POST | Authenticated (`readDeployAuthFromRequest`) | Mutating: proxies to create + resume | DB writes; on-chain (via resume) | `deploy-start:<auth.address>` in-memory | `readJsonBody` bounded | None | Not found | FAIL — APIAUTH-011 |
| `deploy/v2/session/resume` | `deploy/v2/session/_resume.ts` | POST | Authenticated (`loadAuthorizedDeploySession`) | Mutating: runs deploy workflow, sends UserOps | DB writes; on-chain UserOps | MISSING — no rate limit | `readJsonBody` bounded | None | Not found | FAIL — APIAUTH-009 |
| `deploy/v2/session/status` | `deploy/v2/session/_status.ts` | POST | Authenticated (`loadAuthorizedDeploySession`) | Read-only: loads session, returns state | DB reads | MISSING — no rate limit (read-only) | N/A | None | Not found | PASS |
| `deploy/v2/session/cancel` | `deploy/v2/session/_cancelCore.ts` | POST | Authenticated (`loadAuthorizedDeploySession`) | Mutating: cleanup UserOp via paymaster | DB writes; on-chain UserOp | `deploy-cancel:<auth.address>` in-memory | `readJsonBody` bounded | None | Not found | FAIL — APIAUTH-011 |
| `deploy/v2/session/dryRun` | `deploy/v2/session/_dryRunCore.ts` | POST | Authenticated (`loadAuthorizedDeploySession`) | Mutating (local fork only): simulate deploy | Local fork RPC only | `deploy-dryrun:<auth.address>` in-memory | `readJsonBody` bounded | Local fork | Not found | FAIL — APIAUTH-011 |
| `deploy/solanaInfraStatus` | `deploy/_solanaInfraStatus.ts` | GET | Admin or machine auth | Read-only: Solana infra status | Solana RPC reads; DB reads | None (admin/machine auth gate) | N/A (GET) | None | Not found | PASS |
| `deploy/provisionSolanaRoute` | `deploy/_provisionSolanaRoute.ts` | POST | Machine auth (Bearer secret) | Mutating: runs `wrap-token` CLI | Solana CLI; Solana RPC | `solana-provision:<ip>` in-memory | `readBoundedJsonObjectBody` bounded | None | Not found | PASS |
| `deploy/registerSolanaBridgeToken` | `deploy/_registerSolanaBridgeToken.ts` | POST | Admin or internal secret | Mutating: on-chain token registration (internal secret); read-only build (admin) | DB writes; on-chain registration | In-memory rate limit | `readJsonBody` bounded | None | Not found | PASS |
| `paymaster` | `paymaster/_paymaster.ts` | POST (JSON-RPC) | Authenticated (session or deploy-session token) | Mutating: sponsors UserOps via CDP | CDP paymaster RPC; on-chain UserOps | Per-IP `paymasterRpc` in-memory; per-sender `checkSponsorshipLimit` in-memory; per-session `enforceRateLimit` in-memory | `readJsonBody` 256KB | None | Not found | FAIL — APIAUTH-008 |
| `relay/execute` | `relay/_execute.ts` | POST | Public (no auth) | Mutating: proxies signed UserOps to Relay | Relay `/execute/call` with project API key | `relay:execute:<ip>` in-memory `creatorQuickstart` | `readJsonBody` 256KB | None | Not found | FAIL — APIAUTH-007 |
| `relay/quote` | `relay/_quote.ts` | POST | Public (no auth) | Read-only (quote only) | Relay `/quote/v2` with project API key + `subsidizeFees: true` | `relay:quote:<ip>` in-memory `creatorQuickstart` | `readJsonBody` 256KB | None | Not found | FAIL — APIAUTH-007 |
| `relay/intent-status` | `relay/_intent-status.ts` | GET | Public | Read-only: fetch Relay intent status | Relay API read | `relay:intent-status:<ip>` in-memory `relayIntentStatus` | N/A (GET) | None | Not found | PASS |
| `telegram/link/complete` | `telegram/_link-complete.ts` | POST | Authenticated (Privy) + Telegram session proof | Mutating: link token consume + DB upserts | Privy verify; DB writes (6+ tables) | `telegram-link-complete:<ip>` in-memory `telegramLinkWrite` | `readBoundedJsonObjectBody` 16KB | None | Not found | FAIL — APIAUTH-013 |
| `telegram/webhook` | `telegram/_webhook.runtime.ts` | POST (GET health check) | Machine auth (Telegram secret token) | Mutating: processes Telegram bot updates | Telegram Bot API; DB writes | `telegram:webhook:<ip>` in-memory `telegramWebhookIngest` | N/A (Telegram payload) | None | Not found | PASS |

### Shard B — PASS/FAIL tally

- FAIL: 7 findings (APIAUTH-007 through APIAUTH-013) across 13 routes
- PASS: 10 routes with adequate controls (including 4 wallet routes with rate-limit gaps noted but access control adequate)
- P0 stop condition: NOT triggered. All four P0 criteria checked and cleared:
  1. Deploy status/preflight route: `_status.ts` is read-only (loads session, returns state, no mutation). `_statusCore.ts` with `advanceDeploySession` is an internal workflow handler, not directly routed. `preflightOnly` in `_createCore.ts` is read-only. No P0.
  2. Solana mutation path: `_provisionSolanaRoute.ts` requires Bearer secret (machine auth). `_registerSolanaBridgeToken.ts` requires admin or internal secret for mutation. No user-session auth accepted for Solana mutation. No P0.
  3. Unauthenticated mutating endpoint: `relay/execute` is unauthenticated with external side effects (Relay API call), but chain mutation requires signed UserOp. Medium, not P0.
  4. Paymaster sponsorship path: validates sender (line 3678), mode (via `validateSponsoredSmartWalletCalls`), target (inner call decoding), value (cleanup-only enforces `call.value !== 0n`), canonical signer (`resolveCanonicalEmbeddedOwnerForSender`). No P0.

### Shard B — route maps inspected (not deep-inspected)

| Route map | Routes | Status |
|---|---|---|
| `_routes.keepr.ts` | 8 routes: join, joinStatus, nonce, vault/automation, vault/upsert, actions/enqueue, actions/pending, actions/updateStatus | NEEDS MANUAL REVIEW (route map read, handlers not deep-inspected) |
| `_routes.uniswap.ts` | 11 routes: query, poolHistory, quote, swap, order, checkApproval, checkDelegation, swap5792, swap7702, plan, liquidity | NEEDS MANUAL REVIEW (route map read, handlers not deep-inspected) |
| `_routes.wallet.solana.ts` | 3 routes: setCanonical, sweep/enqueue, sweep/process | NEEDS MANUAL REVIEW (route map read, handlers not deep-inspected) |

### Shard B — files not found

- `telegram/_link-start.ts` — does not exist. No `link/start` route in `_routes.telegram.ts`.
- `telegram/_verify-miniapp.ts` — does not exist. Mini App session verification is inline in `_link-complete.ts` via `readTelegramMiniAppSession`.

## Shard A + B completion note

Shard A (auth/accounts/waitlist routes) is complete. All 26 routes inspected, 6 findings issued (APIAUTH-001 through APIAUTH-006).

Shard B (wallet/deploy/paymaster/relay/Solana/keeper/Telegram routes) is complete. 19 routes fully inspected, 7 findings issued (APIAUTH-007 through APIAUTH-013). 3 route maps read (keepr, uniswap, wallet.solana) with 22 routes enumerated but not deep-inspected. 2 files not found (telegram/_link-start.ts, telegram/_verify-miniapp.ts).

Combined: 13 findings (APIAUTH-001 through APIAUTH-013), 45 routes fully inspected, 22 routes enumerated via route maps. Remaining NEEDS MANUAL REVIEW: keepr handlers (8), uniswap handlers (11), wallet.solana handlers (3).

## Shard C — v1 financial / lottery / chat-media / AlfaClub / backtest / agents / build routes

Inspected 2026-06-25. 24 handler files deep-inspected + `_routes.v1.ts` route map (258 lines, ~130 route entries). All files in scope found and read.

### Shard C — fully inspected routes

| Route | Handler | Method | Auth | Rate Limit | Side Effects | Finding | Classification |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `lottery/amoe/submit` | `_amoeSubmit.ts` | POST | `guardAgentApiRequest` (read) | in-memory + **durable** (6/min) | chain (server relay), DB (credit debit) | — | PASS |
| `lottery/amoe/submit-zk` | `_amoeSubmitZk.ts` | POST | `guardAgentApiRequest` (read) | in-memory + **durable** (6/min) | chain (server relay), DB (replay store, credit debit) | — | PASS |
| `lottery/amoe/retry-zk` | `_amoeRetryZk.ts` | POST | `guardAgentApiRequest` (read) | in-memory + **durable** (10/min) | chain (server relay), DB (replay store) | — | PASS |
| `lottery/amoe/burn-credits` | `_amoeBurnCredits.ts` | POST | `guardAgentApiRequest` (read) | in-memory + **durable** (6/min) | DB (atomic credit debit) | — | PASS |
| `chat/hermit` | `_hermit.ts` | POST | session + `isHermitUserAllowed` | in-memory (`chatCommandPreflight`) | execute Hermit command (read-only lane) | APIAUTH-015 | PASS (rate limit gap) |
| `chat/hermit/memes/save` | `_hermit-meme-save.ts` | POST | session + `isHermitOwner` + room-scoped | in-memory (`adminAction`) | DB (createHermitMeme) | APIAUTH-015 | PASS (rate limit gap) |
| `chat/hermit/memes/delete` | `_hermit-meme-delete.ts` | POST | session + `isHermitOwner` + room-scoped | in-memory (`adminAction`) | DB (softDeleteHermitMeme, owner-scoped) | APIAUTH-015 | PASS (rate limit gap) |
| `alfaclub/run` | `_run.ts` | GET/POST | CRON_SECRET | in-memory (`adminAction`) | runVigilante (reads data, optional onchain if flag) | APIAUTH-017 | PASS (rate limit gap) |
| `alfaclub/chat-token` | `_chat-token.ts` | GET/POST/DELETE | admin session or CRON_SECRET | in-memory (`adminAction`) | DB (JWT/token upsert/clear) | APIAUTH-017 | PASS (rate limit gap) |
| `alfaclub/chat-token-refresh` | `_chat-token-refresh.ts` | GET/POST | CRON_SECRET | in-memory (`adminAction`) | Privy token refresh | APIAUTH-017 | PASS (rate limit gap) |
| `alfaclub/chat-bridge-run` | `_chat-bridge-run.ts` | GET/POST | CRON_SECRET | in-memory (`adminAction`) | chat bridge tick | APIAUTH-017 | PASS (rate limit gap) |
| `alfaclub/backtest-run` | `_backtest-run.ts` | POST | Privy (`verifyPrivyForAccounts`) | in-memory (`alfaclubBacktestRun`, 5/min) | compute-heavy (candle fetch + simulation), filesystem write | APIAUTH-014 | PASS (rate limit gap) |
| `alfaclub/backtest-sweep` | `_backtest-sweep.ts` | GET | none | in-memory IP-only (`smartWalletOwnerRead`) | filesystem read (path-sanitized) | APIAUTH-016 | PASS (rate limit gap) |
| `alfaclub/backtest-series` | `_backtest-series.ts` | GET | none | in-memory IP-only (`smartWalletOwnerRead`) | filesystem read (path-sanitized) | APIAUTH-016 | PASS (rate limit gap) |
| `alfaclub/backtest-audit` | `_backtest-audit.ts` | GET | none | in-memory IP-only (`smartWalletOwnerRead`) | filesystem read (path-sanitized) | APIAUTH-016 | PASS (rate limit gap) |
| `alfaclub/backtest-markets` | `_backtest-markets.ts` | GET | none | in-memory IP-only (`creatorQuickstart`) | external API fetch (Hyperliquid, with fallback) | APIAUTH-016 | PASS (rate limit gap) |
| `agents/creators/enable` | `_enable.ts` | POST | `guardAgentApiRequest` (build) | in-memory (`agentsWrite`) | DB (enableCswAgent / getOrCreateCreatorXmtpAgent) | APIAUTH-019 | PASS (rate limit gap) |
| `agents/creators/provision-wallet` | `_provisionWallet.ts` | POST | `guardAgentApiRequest` (build) | in-memory (`agentsWrite`) | DB (getOrCreateCreatorAgentWallet) | APIAUTH-019 | PASS (rate limit gap) |
| `agents/identity/set-agent-wallet` | `_setAgentWallet.ts` | POST | `guardAgentApiRequest` (write) | in-memory (`agentIdentitySetWallet`) | build-only (returns EIP-712 / calldata) | APIAUTH-019 | PASS (rate limit gap) |
| `build/auction/submitBid` | `_submitBid.ts` | POST | `guardAgentApiRequest` (build) | in-memory (`buildAuctionSubmitBid`) | build-only (encodes calldata) | APIAUTH-018 | PASS (rate limit gap) |
| `build/gauge/vote` | `_vote.ts` | POST | `guardAgentApiRequest` (build) | in-memory (`buildGaugeVote`) | build-only (encodes calldata) | APIAUTH-018 | PASS (rate limit gap) |
| `build/ve4626/lock` | `_lock.ts` | POST | `guardAgentApiRequest` (build) | in-memory (`buildVe4626Calldata`) | build-only (encodes calldata) | APIAUTH-018 | PASS (rate limit gap) |
| `build/ajna/borrow` | `_borrow.ts` | POST | `guardAgentApiRequest` (build) | in-memory (`buildAjnaCalldata`) | build-only (encodes calldata) | APIAUTH-018 | PASS (rate limit gap) |

### Shard C — route map inspected

- `_routes.v1.ts` — 258 lines, ~130 route entries across lottery, chat, alfaclub, agents, build, vault, workspace, gauge, ve4626, charm, explore, auction, zora-csw, zora-profiles. Dynamic pattern routes for token/{addr}/{action}, vault/{addr}/{action}, workspace/{addr}/{action}, auction/{addr}/{action}, lottery/creator/{addr}, gauge/user/{addr}, ve4626/user/{addr}, charm/strategy/{addr}. Only the 24 handler files in the user's shard C scope were deep-inspected; remaining v1 routes retain NEEDS MANUAL REVIEW status.

### Shard C — P0 assessment

No P0 stop conditions triggered. All four P0 criteria cleared:
1. Anonymous compute-heavy backtest: NOT triggered — `_backtest-run.ts` requires Privy auth.
2. Chat/media mutation not owner-scoped: NOT triggered — meme save/delete check `isHermitOwner` + `isHermitRoomAllowedForOwner`.
3. Financial mutation without server-side ownership: NOT triggered — all agent handlers resolve canonical CSW and validate.
4. Unauthenticated mutating endpoint with side effects: NOT triggered — all mutating endpoints require auth; unauthenticated endpoints are read-only GET.

## Shard A + B + C completion note

Shard A (auth/accounts/waitlist routes) is complete. All 26 routes inspected, 6 findings issued (APIAUTH-001 through APIAUTH-006).

Shard B (wallet/deploy/paymaster/relay/Solana/keeper/Telegram routes) is complete. 19 routes fully inspected, 7 findings issued (APIAUTH-007 through APIAUTH-013). 3 route maps read (keepr, uniswap, wallet.solana) with 22 routes enumerated but not deep-inspected. 2 files not found (telegram/_link-start.ts, telegram/_verify-miniapp.ts).

Shard C (v1 financial/lottery/chat-media/AlfaClub/backtest/agents/build routes) is complete. 24 handler files deep-inspected, 6 findings issued (APIAUTH-014 through APIAUTH-019). 1 route map read (_routes.v1.ts, ~130 entries) with remaining v1 routes not deep-inspected.

Combined: 19 findings (APIAUTH-001 through APIAUTH-019), 69 routes fully inspected, 22 routes enumerated via route maps (shard B), ~130 v1 route entries enumerated via route map (shard C). Remaining NEEDS MANUAL REVIEW: keepr handlers (8), uniswap handlers (11), wallet.solana handlers (3), remaining v1 routes (~100+).
