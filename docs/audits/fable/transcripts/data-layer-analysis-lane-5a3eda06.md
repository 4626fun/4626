---
title: Data layer analysis lane
sidebar_label: 5a3eda06…
sidebar_position: 99
hide_table_of_contents: true
last_updated: '2026-06-28'
audience:
  - developers
  - protocols
stage: use
owner: docs-team
last_reviewed: '2026-06-28'
status: current
---
<div class="audit-transcript-meta">
[← Source sessions](/audits/fable/key-sessions) · [Transcript archive](/audits/fable/transcripts) · [Executive summary](/audits/fable/findings-summary)
</div>
# Data layer analysis lane
| Field | Value |
| --- | --- |
| Session ID | `5a3eda06-c544-4d15-b56a-16f6c832cc10` |
| Lead session | `0a513245-3ae2-4076-a9b0-bc1de524c38f` |
| Record type | Parallel workstream export |
:::note Appendix record
Readable export of a supplementary review session. Tool outputs and system context are omitted; download the [JSONL archive](/audits/fable-chats-4626-2026-06.zip) for the complete log.
:::
## Engagement brief

<timestamp>Tuesday, Jun 9, 2026, 11:45 AM (UTC-7)</timestamp>
You are doing the data-layer/concurrency pass of a full-codebase review of the 4626 monorepo at /home/akitav2/projects/4626. READ-ONLY: do not modify files. Stack: Supabase Postgres (single project), migrations in supabase/migrations/, server data access via pg in frontend/server/_lib/ (getDb / getDbForCron in frontend/server/_lib/db/), serverless on Vercel with POSTGRES_POOL_MAX=1 and a transaction pooler.

Report CONCRETE findings with file:line and severity (Critical/High/Medium/Low). Trace runtime paths; don't speculate.

Checklist:
1. Transaction boundaries: find multi-step writes that should be transactional but aren't. Key suspects: profile merge (frontend/server/_lib/identity/profileMerge.ts), waitlist points + referral passthrough (frontend/server/_lib/onboarding/waitlistPoints.ts), creator strategy activation handlers (frontend/api/_handlers/creator/strategy/), AMOE entry submission/spend (frontend/server/_lib/lottery/lotteryAmoe.ts), keeper job claim/complete (frontend/server/_lib/keeperJobs/). Note: a recent commit says "Harden transactional write paths" — check what pattern was adopted (search for BEGIN/COMMIT or a withTransaction helper) and find call sites that did NOT adopt it.
2. Race conditions: keeper job claim (two workers claiming same job — is claim an atomic UPDATE ... WHERE status='pending' RETURNING?), points dedup via ON CONFLICT, daily check-in claim races (can a user double-claim with concurrent requests?), x402 nonce uniqueness enforcement timing.
3. getDbForCron vs getDb: verify cron/keeper routes use getDbForCron (grep cron handler files); list violations.
4. Migration safety: scan the 15 most recent files in supabase/migrations/ for destructive ops (DROP, ALTER TYPE, NOT NULL without default on existing tables), missing RLS on new public tables (every new public table must have ENABLE ROW LEVEL SECURITY + restrictive deny policy), FORCE ROW LEVEL SECURITY (forbidden).
5. Tombstone/alias pattern: profile lookups by privy_user_id or wallet must chase merged_into_profile_id and consult privy_user_aliases. Grep for direct `profiles.privy_user_id =` or `FROM profiles WHERE` queries added recently that skip the pattern.
6. Unbounded queries: SELECTs without LIMIT on large tables (zora_csw_owners ~1.5M rows, zora_csw_owner_class, creator_coins) reachable from request handlers.
7. Numeric handling: money/points stored as what types; JS Number truncation risks on bigint columns; wei/decimal precision in payment verification.
8. Missing unique constraints where code assumes uniqueness (search INSERT ... ON CONFLICT targets vs migrations defining those constraints).

Return findings sorted by severity, plus verified-sound items. Be rigorous.

## Engagement brief

<timestamp>Tuesday, Jun 9, 2026, 11:45 AM (UTC-7)</timestamp>
You are doing the data-layer/concurrency pass of a full-codebase review of the 4626 monorepo at /home/akitav2/projects/4626. READ-ONLY: do not modify files. Stack: Supabase Postgres (single project), migrations in supabase/migrations/, server data access via pg in frontend/server/_lib/ (getDb / getDbForCron in frontend/server/_lib/db/), serverless on Vercel with POSTGRES_POOL_MAX=1 and a transaction pooler.

Report CONCRETE findings with file:line and severity (Critical/High/Medium/Low). Trace runtime paths; don't speculate.

Checklist:
1. Transaction boundaries: find multi-step writes that should be transactional but aren't. Key suspects: profile merge (frontend/server/_lib/identity/profileMerge.ts), waitlist points + referral passthrough (frontend/server/_lib/onboarding/waitlistPoints.ts), creator strategy activation handlers (frontend/api/_handlers/creator/strategy/), AMOE entry submission/spend (frontend/server/_lib/lottery/lotteryAmoe.ts), keeper job claim/complete (frontend/server/_lib/keeperJobs/). Note: a recent commit says "Harden transactional write paths" — check what pattern was adopted (search for BEGIN/COMMIT or a withTransaction helper) and find call sites that did NOT adopt it.
2. Race conditions: keeper job claim (two workers claiming same job — is claim an atomic UPDATE ... WHERE status='pending' RETURNING?), points dedup via ON CONFLICT, daily check-in claim races (can a user double-claim with concurrent requests?), x402 nonce uniqueness enforcement timing.
3. getDbForCron vs getDb: verify cron/keeper routes use getDbForCron (grep cron handler files); list violations.
4. Migration safety: scan the 15 most recent files in supabase/migrations/ for destructive ops (DROP, ALTER TYPE, NOT NULL without default on existing tables), missing RLS on new public tables (every new public table must have ENABLE ROW LEVEL SECURITY + restrictive deny policy), FORCE ROW LEVEL SECURITY (forbidden).
5. Tombstone/alias pattern: profile lookups by privy_user_id or wallet must chase merged_into_profile_id and consult privy_user_aliases. Grep for direct `profiles.privy_user_id =` or `FROM profiles WHERE` queries added recently that skip the pattern.
6. Unbounded queries: SELECTs without LIMIT on large tables (zora_csw_owners ~1.5M rows, zora_csw_owner_class, creator_coins) reachable from request handlers.
7. Numeric handling: money/points stored as what types; JS Number truncation risks on bigint columns; wei/decimal precision in payment verification.
8. Missing unique constraints where code assumes uniqueness (search INSERT ... ON CONFLICT targets vs migrations defining those constraints).

Return findings sorted by severity, plus verified-sound items. Be rigorous.

## Analysis

The loop is stopping prematurely when ripgrep returns a non-zero exit code, which is causing the iteration to halt after finding files with no matches. I need to add `|| true` to prevent the exit code from terminating the loop.

*Tools invoked:* Shell

## Analysis

Looking at the migration files, most of them have proper RLS setup with ENABLE RLS and RESTRICTIVE deny policies, and there's one documented safe DROP TABLE. I need to verify that the alfaclub_command_reply_ledger migration has a restrictive policy since the preview cut off mid-way, and also confirm the counter_trade_engine and the three tables in the 20260709 migration all have proper RLS in place.

*Tools invoked:* Shell

## Analysis

Moving on to check the tombstone and alias patterns, unbounded queries, numeric handling, and unique constraint assumptions. I also need to verify the `_activate.ts` handler and revisit the daily check-in race condition, particularly around the `x402_authorization_nonce` unique constraint in the `insertPendingActivation` function and its migration. Starting with a search for any direct `profiles.privy_user_id` references that might indicate tombstone issues.

*Tools invoked:* UpdateCurrentStep, Grep, Grep

## Analysis

I'm checking whether the `insertPendingActivation` function properly extracts the x402 nonce from the metadata object and maps it to the database column, since the nonce is being passed nested inside metadata rather than as a direct parameter.

Now I need to trace through several suspect locations to understand how tombstone records are being handled — checking the Privy user ID lookups, the MCP account resolver, Telegram trading and webhook handlers, and the profile sync logic to see if they're properly accounting for merged or deleted identities.

*Tools invoked:* Shell

## Analysis

Looking at the account resolver in `accountResolver.ts`, I'm seeing that it filters out tombstones but doesn't actually follow the alias chain when a Privy user has been merged—it just returns null instead of resolving to the canonical profile. This violates the requirement that all profile lookups by Privy user ID need to traverse the alias cascade, so merged users end up losing their Base MCP account resolution.

The session address resolver in `auth/_privy.ts` has a similar problem: it does a direct lookup on `privy_user_id` without checking for aliases or tombstones, so freshly aliased users won't be found and session resolution fails. The merge operation itself is transactional and properly nulls the `privy_user_id`, but the main issue is that alias resolution is missing entirely.

Now I need to scan for unbounded queries on large tables like `zora_csw_owners`, `zora_csw_owner_class`, and `creator_coins` in request handlers that lack LIMIT clauses, plus check numeric type handling in places like `command_issuer_daily_spend.spent_wei` and payment verification comparisons.

I should also verify the activation logic in `activations.ts` — specifically how the nonce column and unique constraints work, whether the `live_activation_exists` check is semantically correct, and confirm that `_activate.ts` follows the right order (verify payment first, then insert) with proper transaction wrapping as documented.

*Tools invoked:* Grep, Read

## Analysis

Looking at the activation code, I'm noticing a critical gap between the documented replay protection and what's actually implemented. The migration set up a unique constraint on the `x402_authorization_nonce` column, but the insert function never actually populates that column—it only stores the nonce in the metadata JSON, leaving the column null and rendering the database-level constraint ineffective.

However, the actual replay protection does exist on-chain through EIP-3009's nonce mechanism and the `payment_tx_hash` unique constraint, so the vulnerability is mitigated in practice. Still, this is a Medium issue because the documented safeguard is dead code, and if the settlement path changes in the future, there's no database guard to fall back on.

I'm also spotting a logic bug in the `isUniqueViolation` check: the regex `/creator_strategy_features_/i` is too broad and will match both the `one_live_per_feature` constraint and the `unique_payment_tx` constraint. This means a duplicate payment transaction error gets misclassified as "activation already exists," which is problematic in the x402 flow where the user has already paid—the wrong error message could trigger incorrect refund logic.

Let me verify that the `hasLiveActivationForFeature` function is looping correctly per key, and confirm the `one_live_per_feature` constraint is actually partial on pending/active statuses as expected. Then I need to check whether the nonce column is being written anywhere else in the x402 activation flow.

*Tools invoked:* Shell

## Analysis

The `x402_authorization_nonce` column is never actually written to, making the unique index on it dead code—the nonce only exists in the metadata JSON, so the documented protection in the docs isn't enforced at the database level. I'm now checking the remaining issues, starting with those unbounded queries in the creatorEthosProjection function around lines 301-407, which look like they might be part of a cron job with limits already in place.

I also need to verify the creator_co selects in the request handlers, the numeric handling for points, NULL source_id verification, and how the alfaclub getDb function works—since `/api/v1/alfaclub/chat-bridge-run` appears to be cron-triggered, I should check how the handler gets its database connection. Let me also definitively confirm whether the `points_unique_source_full` index exists and if it's set to NULLS NOT DISTINCT.

*Tools invoked:* Shell, Read

## Analysis

I've clarified the unique index behavior for `points_unique_source_full`: it's defined as `ON points (signup_id, source, source_id)` without `NULLS NOT DISTINCT`, which means PostgreSQL treats NULL values as distinct by default, allowing multiple rows with `source_id IS NULL` for the same signup and source combination—except for `csw_link` entries, which are protected by the `points_csw_link_single_shot` constraint. This affects how `awardWaitlistPoints` callers need to handle their inputs.

Now I need to search through the codebase to find which sources are calling `awardWaitlistPoints` with a null `sourceId` and whether the function itself coerces null values to something else. The ethos projection query runs in a cron job and is bounded by LIMITs, so that's acceptable. I still need to investigate numeric handling, unbounded queries in request handlers like the creator_coins logic, how alfaclub uses the database in cron jobs, and how `waitlistPoints.ts` handles null `sourceId` values.

*Tools invoked:* Shell

## Analysis

*Tools invoked:* Shell

## Analysis

All the `awardWaitlistPoints` call sites are passing non-null `sourceId` values, and while `csw_link` gets force-nulled, it's covered by a dedicated partial index, so the NULL `source_id` double-award risk is really just a theoretical concern at the current call sites—though I should note this as a low-priority design hazard since the helper function allows null sourceId for non-csw_link sources without constraint protection. Other points writers like `recordReferralPassthrough` build composite keys that are non-null, and `amoe` points use ON CONFLICT handling...

For the remaining checks: I need to verify numeric handling around `Math.trunc(normalizedAmount)` since amounts are JavaScript numbers capped at 10k, while `priceUsdcPaid` uses BigInt with string params which looks solid—I should grep for `Number(` conversions on wei values in payment verification. I also need to look for unbounded queries on `creator_coins` reachable from request handlers, check the alfaclub getDb call in the cron handler, and most importantly trace through `runInTransaction` to see if any nested callbacks are calling `getDb()` internally, which could deadlock when POOL_MAX=1 since the transaction holds the only client.

*Tools invoked:* Shell

## Analysis

*Tools invoked:* Shell

## Analysis

*Tools invoked:* Shell, Grep

## Analysis

Looking at the Number conversion in x402.ts around line 296, and I notice usdcPayment.ts doesn't seem to have any BigInt or Number operations — need to check what value comparisons are actually happening there. The zora metrics are using SUM aggregates which makes sense for hero metrics (probably cached despite the full table scans), and I see the _explore.ts query at line 528 does have a LIMIT clause.

*Tools invoked:* Shell

## Analysis

The numeric handling looks solid across payments and points — bigint comparisons are consistent, small values like signature bytes are fine as numbers, and ID conversions work. Now I need to check how the alfaclub chat-bridge-run handler uses the cron database, along with the query limits in the explore module and metrics calculations.

*Tools invoked:* Shell

## Analysis

*Tools invoked:* Shell

## Analysis

*Tools invoked:* Shell

## Analysis

The `rg` command with word boundaries might be causing issues — the first search returned no matches and exited with code 1, which seems to have suppressed the echo output entirely. Let me try running simpler commands separately to isolate the problem.

*Tools invoked:* Shell

## Analysis

*Tools invoked:* Shell

## Analysis

I've confirmed that `_chat-bridge-run.ts` is another CRON_SECRET-protected handler with the same violation—its backing stores use plain `getDb()` instead of adhering to the getDbForCron policy, matching the pattern I found in the AMOE cron libraries. I have enough for the report now, but let me quickly verify `_x402-activate.ts` to be thorough.

*Tools invoked:* Shell

## Analysis

I need to verify whether the x402 handler checks for live activation before settling the payment. Looking through the _x402-activate.ts file, I don't see that check being called, so I'm examining the code around lines 150-225 to see if there's a pre-check before the settlement happens.

*Tools invoked:* Read

## Analysis

I've confirmed the High severity issue: there's no `hasLiveActivationForFeature` check before the on-chain USDC transfer at line 206, so funds are already sent before the database insert happens—if `live_activation_exists` is true, the money's already gone. The nonce is only stored in metadata at line 240, making that unique index ineffective. I'm now compiling the full set of findings and need to check how the system handles failures when `insertResult.ok` is false.

*Tools invoked:* Read

## Analysis

I have enough verified material now. Let me pin exact line numbers in `postgres.ts` for the transaction helper findings.

 I've confirmed the severity of the High finding: when `live_activation_exists` or `db_error` occurs after a successful on-chain settlement, the handler returns 409/500 without any refund mechanism or reconciliation record. The worst part is that on `live_activation_exists`, the insert fails entirely, so the payment events never get recorded and the transaction rolls back—leaving the settled on-chain payment with zero database record.

The `db_error` catch has the same issue: the payment settles on-chain but persistence fails completely, with only a console log and no durable record. Now I'm ready to compile the final report organized by severity, starting with the High findings and moving through the Medium ones, including the `runInTransaction` deadlock hazard when `POSTGRES_POOL_MAX=1` and the silent atomicity loss when `cachedRawPool` is missing.

For Medium severity, I'm documenting the widespread `getDbForCron` violations across multiple files like `orMetricsSync.ts`, `amoeBurnRefund.ts`, and the alfaclub stores under the cron handler, where the fallback `?? getDb()` pattern bypasses the cron safety check. There's also the dead x402 nonce unique index that's never actually written to—the nonce only exists in metadata JSON while the index sits unused. The `isUniqueViolation` misclassification is problematic too: the fallback regex is too broad and causes a `unique_payment_tx` violation to be reported as `live_activation_exists`, which breaks error semantics and ops triage. I'm also noting the tombstone and alias miss cases in account resolution and auth flows.

For Low severity, there's the points NULL source_id hazard where the helper permits null sourceId for non-csw_link sources, and the unique constraint doesn't deduplicate NULL rows—though all current call sites pass non-null values, so it's latent. The daily check-in points award logic also needs examination.

On the metrics endpoint, the full-table SUM aggregates on creator_coins per request are seq-scan-heavy, though I didn't fully verify the caching strategy—I'll note this as informational since it's bounded and the hero metrics are Supabase-indexed.

For verified sound patterns: profile merge is transactional, keeper job claims are atomic with FOR UPDATE SKIP LOCKED and matching enqueue deduplication, the USDC activation path wraps operations in transactions, numeric handling stays consistent with bigint throughout, and the recent migrations are safe with proper RLS policies on new tables.

Now I need to double-check the postgres.ts line numbers for the runInTransaction fallback and connection pool size.

*Tools invoked:* Shell

## Analysis

Everything checks out, so I'm ready to put together the final report.

*Tools invoked:* UpdateCurrentStep

## Analysis

# Data-layer / Concurrency Review — 4626 monorepo

All paths relative to repo root unless noted. Frontend paths are under `frontend/`.

---

## HIGH

### H-1. x402 activation settles USDC on-chain **before** any entitlement pre-check, and a failed insert leaves the settled payment with **no DB record**

`frontend/api/_handlers/creator/strategy/_x402-activate.ts`

- Line 206: `settleX402Payment(parsed.payment)` broadcasts the EIP-3009 `transferWithAuthorization` — the creator's USDC moves to the treasury on-chain.
- Lines 225–247: only **after** settlement does `insertPendingActivation` run (inside `runInTransaction`). There is **no `hasLiveActivationForFeature` pre-check anywhere in this handler** (the 402-challenge path at lines 172–180 also doesn't check).
- Lines 294–307: if the insert fails with `live_activation_exists` (creator already has a pending/active row) the handler returns 409 — but the USDC is already gone.
- Worse: because `upsertPaymentOrder` (line 249) and `recordPaymentEvent` (line 262) are in the **same transaction** as the failed insert, the rollback erases them too. A settled on-chain payment ends with **zero rows in any payment table** — no `payment_order`, no `payment_event`, no activation row. The only artifacts are the on-chain tx and a 409 JSON response. The `catch` at lines 279–285 (`db_error`) has the same property.
- Contrast: the plain-USDC path (`_activate.ts`) is structurally safer because the *user* broadcasts the transfer themselves before calling the API; here the **server** initiates the irreversible transfer.

**Fix shape:** call `hasLiveActivationForFeature` (it exists in `activations.ts:114` and is already hardened per the M-02 fix) before `settleX402Payment`; and on post-settlement insert failure, durably record the orphaned settlement (outside the rolled-back tx) for refund ops.

---

## MEDIUM

### M-1. Cron/keeper code paths use plain `getDb()` (or a fallback that defeats `getDbForCron`)

The repo policy (AGENTS.md, `docs/operations/vercel-cron-production-fixes.md`) requires cron routes to use `getDbForCron()` (connect deadline + pool-generation rebind). Violations reachable from cron handlers:

| File | Lines | Notes |
|---|---|---|
| `server/_lib/zora/creatorMetricsSync.ts` | 542, 589, 848, 1223 | `(await getDbForCron()) ?? (await getDb())` — the fallback fires exactly when the deadline-protected connect failed, then blocks without a deadline. Negates the protection. |
| `server/_lib/lottery/amoeReplayStore.ts` | 273 | plain `getDb()`; called from `_amoeRetryCron.ts` |
| `server/_lib/lottery/amoeBurnRefund.ts` | 171 | plain `getDb()`; called from `_amoeBurnRefundCron.ts` |
| `server/_lib/lottery/amoeLedgerPublisher.ts` | 968 | plain `getDb()`; called from `_amoePublishCron.ts` |
| `server/_lib/alfaclub/chatTokenStore.ts` | 127, 154, 192, 284, 314, 398 | plain `getDb()`; called from CRON_SECRET-gated `_chat-bridge-run.ts` / `_chat-token-refresh.ts` |
| `server/_lib/alfaclub/chatIngestStore.ts` | 82 | plain `getDb()`; called from `_chat-bridge-run.ts` |
| `server/_lib/alfaclub/` (also: `hermitCommandCooldown.ts`, `creatorRoomLinks.ts`, `roomLabelCache.ts`, `commandReplyLedger.ts`, `roomPolicySync.ts`, `userPreferenceStore.ts`) | various | same pattern under the chat-bridge cron tick |

Severity is Medium not High because `getDb()` itself has pool hygiene, but the documented `:00` cron pile-up failure mode is exactly what `getDbForCron` exists to prevent.

### M-2. The x402 nonce unique index is **dead** — the column is never written

- Migration `supabase/migrations/20260419180000_creator_strategy_payment_paths.sql:39-43` adds `x402_authorization_nonce` and `UNIQUE (payment_from, x402_authorization_nonce) WHERE x402_authorization_nonce IS NOT NULL`.
- Docs (`docs/operations/creator-strategy-features.md:453`, AGENTS.md) state this constraint "prevents replay."
- But the only write path puts the nonce in the **`metadata` JSON** (`_x402-activate.ts:240`, key `x402Nonce`); no code in `frontend/` ever writes the dedicated column (verified by repo-wide grep). The index predicate `IS NOT NULL` therefore never matches; the documented DB-level replay guard is not enforced.
- Actual replay protection currently rests on (a) on-chain EIP-3009 nonce consumption and (b) `creator_strategy_features_unique_payment_tx`. Those are real, so this is a docs/defense-in-depth gap, not an active exploit — but if the settle path ever changes (e.g. accepting pre-settled authorizations), the assumed DB backstop is absent.

### M-3. `isUniqueViolation` misclassifies constraint violations

`server/_lib/creatorStrategy/activations.ts:193-200`:

```193:200:frontend/server/_lib/creatorStrategy/activations.ts
function isUniqueViolation(error: unknown, constraint: string): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '')
  return (
    /duplicate key value/i.test(message) &&
    (message.includes(constraint) ||
      /creator_strategy_features_/i.test(message))
  )
}
```

The `|| /creator_strategy_features_/i` fallback makes the function return true for **any** constraint on the table. In `insertPendingActivation` (lines 344–358), the `one_live_per_feature` check runs first — so a `creator_strategy_features_unique_payment_tx` violation (duplicate payment hash) is reported as `live_activation_exists`. In the x402 flow this mislabels an already-paid replay scenario, sending ops/refund triage down the wrong path. (Same misclassification risk in `insertStripeCheckoutActivation:246`.)

### M-4. Profile lookups that skip the alias cascade

Per AGENTS.md, "any new profile-lookup-by-privy-user-id code path must go through the alias cascade." Two paths don't:

- `server/_lib/agents/base-mcp/accountResolver.ts:73-76` — direct `WHERE privy_user_id = ${userId} AND merged_into_profile_id IS NULL`. The tombstone filter is correct, but there is no `privy_user_aliases` consult and no merge chase. A Privy user whose id was aliased onto a canonical profile during a merge resolves to **null** → Base MCP treats a real merged account as having no execution context.
- `api/_handlers/auth/_privy.ts:168` (`resolvePersistedSessionAddress`) — direct `WHERE p.privy_user_id = ${privyUserId} LIMIT 1`, no alias consult and no `merged_into_profile_id IS NULL` filter. Tombstone resurrection is unlikely (the merge nulls `privy_user_id` in the same transaction), but alias-only users miss session-address resolution and silently fall back.

(`walletSync.ts`, `accountsIdentity.ts`, `profileIdForPrivyUser.ts`, `emailCollisionAdoption.ts` were checked and correctly chase aliases/tombstones.)

### M-5. `runInTransaction` hazards under `POSTGRES_POOL_MAX=1`

`server/_lib/db/postgres.ts:179-184`:

1. **Silent atomicity drop:** when `cachedRawPool` is missing/lacks `connect` (line 182-184), the helper runs `fn(db)` with **no transaction at all** and no warning. Callers like `executeProfileMergeInTransaction` and the creator-strategy handlers believe they have atomicity; in this fallback they don't. The condition is rare (pool exists when `getDb()` succeeded) but a logged warning or hard failure would be safer for the merge path specifically.
2. **Single-client starvation:** with pool max = 1 (line 499 default in conservative serverless mode), `runInTransaction` checks out the pool's only client for the duration of `fn`. Any concurrent `getDb()`-based query in the same lambda invocation (e.g. fire-and-forget telemetry, `Promise.all` side reads) queues behind the transaction; a `pool.connect()` issued *inside* the callback would deadlock until `connectionTimeoutMillis`. I found no current callback that does this (all audited callbacks thread `txDb` correctly — `_bootstrap.ts:684`, `_x402-activate.ts:226`, `profileMerge.ts`), so this is a guard-rail finding: nothing prevents a future callback from calling a helper that internally does `getDb()`.

---

## LOW

### L-1. `points` NULL `source_id` is unprotected for non-`csw_link` sources (latent)

- `supabase/migrations/20260402100000_migrate_waitlist_keepr_runtime_schema.sql:195-199`: `points_unique_source_full ON points (signup_id, source, source_id)` is a standard unique index — **without `NULLS NOT DISTINCT`**, so multiple rows with `source_id IS NULL` for the same `(signup_id, source)` are all allowed. Only `csw_link` gets a NULL-safe guard (`points_csw_link_single_shot`, lines 197-199).
- `server/_lib/onboarding/waitlistPoints.ts:206,225` accepts `sourceId?: string | null` and inserts `ON CONFLICT DO NOTHING` — which is a no-op for NULL `source_id` since no arbiter exists.
- **Mitigating fact (verified):** every current call site passes a non-null sourceId (`_bootstrap.ts:688` `'signup'`, `_register-sub-account.ts:122` `csw:<addr>` for the csw_link source which is force-nulled but covered by its own index, `pointsBackfill.ts:396` `'signup'`, passthrough composite keys). So no live double-award today; the hazard is the helper signature permitting it. Tightening: reject `null` sourceId for sources other than `csw_link`, or recreate the full index with `NULLS NOT DISTINCT` (PG 15+).

### L-2. Daily check-in points award is non-atomic with the check-in record

`server/_lib/lottery/lotteryAmoe.ts` (`claimDailyTwitterCheckin`): the check-in row insert (`ON CONFLICT (wallet_address, checkin_date) DO NOTHING`) and the subsequent `points` insert are separate statements outside a transaction. Double-claim is prevented (both inserts are conflict-guarded, and multi-wallet users share `signup_id` so the day-keyed points row dedupes). The residual issue: if the points insert fails after the check-in row landed, the user permanently loses that day's points (the check-in conflict blocks retry). Low impact (6 points/day) but a known dead-end state.

### L-3. Per-request full-table aggregates on `creator_coins`

`api/_handlers/zora/_metrics.ts:267-269` runs three `SUM(...) FROM creator_coins WHERE chain_id = 8453` subqueries per request. These return one row (not unbounded result sets), but they're seq-scan-shaped on a growing table behind a public endpoint. The heavy `zora_csw_owners` joins (`creatorEthosProjection.ts:301-414`) are cron-only and bounded by `LIMIT ${volumeLimit}` / `${ethosPriorityLimit}` — fine. No request handler returning unbounded rows from the ~1.5M-row tables was found.

---

## VERIFIED SOUND

1. **Profile merge is transactional.** `executeProfileMergeInTransaction` (`identity/profileMerge.ts`) wraps the full multi-table move (aliases, `profile_wallets` with role-flag zeroing, points, referral repointing, `command_issuer_*`, tombstone) in `runInTransaction`; both production callers (`scripts/merge-profiles.ts`, `api/_handlers/admin/profiles/_merge.ts`) use it.
2. **Keeper job claiming is race-safe.** `keeperJobs/keeperJobs.ts` claims via `UPDATE ... WHERE id IN (SELECT ... FOR UPDATE SKIP LOCKED) RETURNING`, and `completeKeeperJob` fences on `claimed_by = worker`. The `enqueueKeeperJob` `ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL AND status IN ('pending','claimed','retry')` predicate exactly matches `keeper_jobs_active_dedupe_idx` (`20260506221000_keeper_job_coordination_queue.sql`).
3. **"Harden transactional write paths" was adopted broadly.** `docs/security/transactional-integrity-audit.md` matches code: `keepr/actions/_updateStatus.ts`, `walletSync.ts`, `wallet/solana/_setCanonical.ts`, `waitlist/_bootstrap.ts`, `controlPlane/executors/provisionVaultEconomy.ts`, and all three creator-strategy payment handlers use `runInTransaction` with `txDb` threaded correctly.
4. **Payment numeric handling is correct.** USDC verification decodes `Transfer` logs via viem and compares `bigint >= bigint` (`usdcPayment.ts:146-151`); x402 uses `BigInt` for value/validity windows (`x402.ts:176-178,242`); the lone `Number(v)` (`x402.ts:296`) is the 1-byte signature recovery id; prices flow as `bigint → .toString()` into SQL params and back via `BigInt(row.price_usdc_paid)`; DTOs serialize bigints as strings. Points amounts are small ints capped at `MAX_AWARD_AMOUNT = 10_000` with `Math.trunc`.
5. **Migration safety (last 15 files).** Only one destructive op: `20260705000000_drop_orphan_query_temp_io_snapshots.sql` — `DROP TABLE IF EXISTS` of a verified-orphan table, documented and reversible from backup. Every new table (`alfaclub.command_reply_ledger`, `position_alert`, `arena_identity_mapping`, all four `counter_trade_*` tables, `room_label_cache`, `public.solana_share_mesh_mappings`) has `ENABLE ROW LEVEL SECURITY` plus a `RESTRICTIVE` deny policy. No `FORCE ROW LEVEL SECURITY` anywhere. No `ALTER TYPE` or `NOT NULL`-without-default on existing tables.
6. **Telegram link-start tokens are atomically single-use.** `messaging/telegramTrading.ts` consumes via `UPDATE ... SET consumed_at = NOW() WHERE ... consumed_at IS NULL AND expires_at > NOW() RETURNING` — claim-bound and race-safe.
7. **AMOE replay/idempotency.** ZK nonce commits have a partial unique index (`20260429000000_amoe_zk_submissions.sql:95-97`, with an explicit PG-14-portability comment); burn refunds are idempotent via `points_unique_source_full` with non-null `source_id` (`20260430190000`). The "spend doesn't deplete the public balance" behavior in `consumeAmoeCreditsForEntry` is intentional — `waitlistScoring.ts` weights all four AMOE ledger sources at 0, matching the documented one-weighted-total model.
8. **Stripe entitlement gate hardened.** `hasLiveActivationForFeature` (`activations.ts:114-134`) requires `payment_verified_at IS NOT NULL`, closing the pre-payment `pending`-row free-access window (documented as fix M-02/4626-408).

### Suggested priority

1. **H-1** — add the pre-settlement entitlement check and durable orphan-payment record in `_x402-activate.ts` (real money path).
2. **M-1** — remove the `?? getDb()` fallback in `creatorMetricsSync.ts` and migrate AMOE/alfaclub cron-reachable stores to `getDbForCron`.
3. **M-2 + M-3** — write `x402_authorization_nonce` into its column and fix `isUniqueViolation` to match the specific constraint name (small, same module).
4. **M-4** — route the two direct `privy_user_id` lookups through `listProfileIdsForPrivyUser` / the alias cascade.

