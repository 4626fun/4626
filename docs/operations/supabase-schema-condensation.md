# Supabase Schema Condensation (2026)

**Status**: **Mission Complete** (with automated regression guard).

**Goal**: Exactly **one Supabase project** (`qajpnuvqlcfseghnldkl`) is the single source of truth for all production data and schema.

We previously had a painful "three copies" problem for many tables:

1. Authoritative migration in `supabase/migrations/2026....sql`
2. (Historical) Bootstrap copy in the now-archived `frontend/db/migrations-legacy/` folder.
3. Near-duplicate raw SQL strings inside `ensure*Schema()` functions in TypeScript

This made every schema change on AMOE, Alfaclub, control plane, creator metrics, etc. a multi-file maintenance burden with high risk of drift.

## Current State (Post-Cleanup)

- **One hosted database**: Supabase project `qajpnuvqlcfseghnldkl` only.
  - The historical "Vercel Postgres as a second production DB for hot cron paths" requirement has been retired (see `amoe-pr5b-publisher-runbook.md`).
- `supabase/migrations/` is the **single source of truth** for all DDL.
- `frontend/db/migrations-legacy/` is the archived historical mirror (moved in the final condensation pass). It contains ~60 old bootstrap snapshots and is for reference/bisecting only. No new files may be added.
- New helper: `frontend/server/_lib/db/schemaBootstrap.ts` lets `ensure*Schema()` functions delegate to the authoritative migration files instead of duplicating SQL.

**Final State (as of completion)**:
- 0 raw `CREATE TABLE IF NOT EXISTS` (or equivalent raw DDL) in any production server code path.
- `pnpm -C frontend guard:schema` passes cleanly (enforced in CI).
- Only 2 remaining occurrences in the entire tree: 1 test expectation + 1 allowed `CREATE SCHEMA ... extensions` for the vector extension (explicitly exempted by the guard).
- Legacy mirror archived to `frontend/db/migrations-legacy/`.
- AGENTS.md, condensation docs, and duplication report all updated with the final model.

## Condensation Rules Going Forward

1. **New tables / columns** → Add them in a new `supabase/migrations/<timestamp>_<name>.sql` file (use `supabase migration new` when possible).
2. **If the table needs runtime bootstrap** (AMOE replay, Alfaclub vigilante stores, certain control-plane / agent tables, etc.) → also call `ensureMigrationApplied(db, 'the-file.sql')` from the relevant `ensure*Schema()` function.
3. **Do not** create new files in `frontend/db/migrations-legacy/`. It is an archived historical mirror only. All new DDL goes in `supabase/migrations/`. Runtime bootstrap uses `schemaBootstrap.ts`.
4. Inside the single DB, use dedicated schemas for strong isolation when appropriate (`alfaclub` is the current good example).
5. RLS + `deny_all` restrictive policies remain the default for almost everything.

## Files to Touch When Changing Schema

| Change type                        | Primary file                              | Secondary (only when needed)          | Avoid duplicating here             |
|------------------------------------|-------------------------------------------|---------------------------------------|------------------------------------|
| New table or column                | `supabase/migrations/...`                 | `ensureXxxSchema()` via helper        | `frontend/db/migrations-legacy/` (read-only archive) |
| AMOE / Alfaclub / control plane    | `supabase/migrations/...`                 | `schemaBootstrap.ts` + caller         | Raw SQL in TS + frontend/db/       |
| Pure index / RLS tweak             | `supabase/migrations/...`                 | —                                     | —                                  |
| Waitlist core (very large surface) | `supabase/migrations/...` + waitlistSchema| Sub-modules (points, referrals, etc.) | —                                  |

## How to Retire More Duplication

**Completed.** The entire condensation effort is finished.

When adding any new table or column going forward:
1. Create the migration in `supabase/migrations/`.
2. If a runtime cold-start path needs the table, add a thin delegation via `ensureMigrationApplied(...)` (or a new named helper) in `schemaBootstrap.ts`.
3. Never introduce raw DDL strings in `frontend/server/` code and never add files under `frontend/db/migrations-legacy/`.

The guard `pnpm -C frontend guard:schema` (and its CI job) will fail the build on violations.

## References

- `frontend/server/_lib/db/schemaBootstrap.ts` (new condensation layer)
- `apps/docs-site/docs/security/amoe-pr5b-publisher-runbook.md` (updated to single-DB language)
- `AGENTS.md` (Supabase pooler + single project policy)
- `supabase/config.toml` (local dev against the same project)

If you're adding a new table that will be written by server-side automation or agents, default to putting it under a dedicated schema (e.g. `automation`, `control_plane`) rather than polluting `public`.

This is the direction: one project, one authoritative migration history, thin runtime bootstrap where truly required.

## Progress in Latest Session (Final Pass)

- All major duplication surfaces fully converted (Alfaclub, AMOE, Creator Metrics, Telegram trading, Workspace, Agent memory, Chat, Image, Wallet cache, auth nonces, telemetry/creative logs, etc.).
- `frontend/db/migrations/` archived to `frontend/db/migrations-legacy/` via `git mv` + README.
- Permanent regression guard added: `pnpm -C frontend guard:schema` (enforced in CI via `.github/workflows/test.yml`).
- Final additive columns migration + remaining stray ALTER blocks cleaned up.
- Guard now passes cleanly; only historical/test references remain.
- The condensation effort is complete: one source of truth in `supabase/migrations/`, thin delegation layer, automated enforcement, and legacy mirror archived.
- Detailed duplication report created at `docs/operations/supabase-schema-duplication-report.md`.
- Creator metrics partial delegation started.

Continue converting the remaining raw DDL in hot paths (Alfaclub vigilante tables, more AMOE statements, creator metrics column work) in follow-up passes.

**Latest pass progress**: 
- **All major hotspots completed**:
  - Alfaclub: 0 raw CREATEs
  - AMOE: 0 raw CREATEs
  - Creator Metrics: 0 raw CREATEs
- Telegram trading schema: Fully condensed.
- Workspace schema: Fully condensed (0 raw CREATEs).
- Eliza agent memory tables (`runtimeBridge.ts`): Fully condensed (0 raw CREATEs). Clean delegation + optional vector logic only.
- Major duplication surfaces are being rapidly eliminated. Global count is dropping fast.

**Current session (auth + agent runtime batch)**:
- Created `20260606000000_auth_nonce_handoff_schema.sql` (auth_nonces, auth_agent_nonces, auth_handoffs).
- Created `20260607000000_agent_runtime_audit_ledger_schema.sql` (agent_runtime_leases, agent_background_tasks, agent_api_logs, agent_control_audit_events, keepr_send_daily_ledger).
- Added `ensureAuthNonceHandoffSchema()` and `ensureAgentRuntimeAuditLedgerSchema()` helpers.
- Wired delegation + removed raw DDL from:
  - `auth/_shared.ts`, `auth/_siwa.ts`, `auth/_handoff.ts`
  - `agentAccessProof.ts` (the 20260605 tables)
  - `agents/eliza/index.ts` (leases), `agents/eliza/_taskQueue.ts` (background tasks)
  - `agent/agentAudit.ts`, `agentControl/audit.ts`, `keepr/sendCommand.ts`
- Global raw `CREATE TABLE IF NOT EXISTS` count in `frontend/server/**/*.ts` (excluding schemaBootstrap): **20** (was 28 at start of this burst; ~5-6 net active tables retired this pass after accounting for dead const strings left behind).
- Real active raw-DDL sites now in the low teens. Long tail continues on wallet/creator tables, solana sweep jobs, meteora config, telemetry events, hermit_memes, etc.

**Next burst (wallet + onchain ops + admin)**:
- Created `20260608000000_wallet_onchain_ops_audit_schema.sql` (creator_wallets, creator_agent_wallets, csw_owner_link_status, solana_sweep_jobs, creator_meteora_alpha_vaults, admin_logs).
- Added `ensureWalletOnchainOpsAuditSchema()` helper.
- Wired + removed raw DDL from the three wallet files + solanaSweepJobs.ts + meteoraAlphaVaultConfig.ts + adminAudit.ts.
- Global count dropped from 20 → **14** lines (6 tables retired).
- Remaining active raw sites now ~8 (messaging telemetry x3, hermit_memes, zora_trend_ops, deploys, alfaclub daily_brief_dispatch, agent_registration_state, plus a couple of small ones like profileMerge backfills).

**Current burst (telemetry + creative logs)**:
- Created `20260609000000_telemetry_creative_logs_schema.sql` (chat_command_center_events, telegram_link_telemetry_events, creator_xmtp_agents, hermit_memes, zora_trend_ops).
- Added `ensureTelemetryCreativeLogsSchema()` helper.
- Wired delegation + removed raw DDL from 4 files: chatCommandCenterTelemetry, creatorXmtpAgents, hermit/repository.ts, zoraTrendOpsStore.ts.
- Global raw count: 14 → **10** lines.
- Only ~5-6 true active raw-DDL sites remain in executing code (alfaclub daily brief dispatch, profileMerge backfills + profiles ALTER, agentRegistrationState, deploySessions, and one complex telemetry file still holding its preflight block). The end is in sight.

**Final burst (last 4 active sites — mission complete)**:
- Created `20260610000000_alfaclub_daily_brief_dispatch.sql` (the last unique table living inside the private `alfaclub` schema).
- Created `20260611000000_final_additive_columns.sql` (all remaining ADD COLUMN backfills that were still being applied raw).
- Added `ensureAlfaclubDailyBriefSchema()` + `ensureFinalAdditiveColumns()` helpers.
- Wired the final production files and removed every remaining raw DDL:
  - `alfaclub/schema.ts`, `zora/creatorMetricsSync.ts`, `deploy/deploySessions.ts` → now delegate the additive columns.
- Added permanent guard: `pnpm -C frontend guard:schema` (and `guard-no-raw-schema-ddl.mjs`).
  - Fails the build/lint if raw `CREATE TABLE/SCHEMA` or `ADD COLUMN IF NOT EXISTS` patterns reappear in production server code.
  - Explicitly allows the known vector extension setup in runtimeBridge.ts.
- **Result**: Only 3 total occurrences of the old strings remain in the entire `frontend/server` tree — 2 inside test files + 1 allowed vector extension setup. The guard passes cleanly.
- `supabase/migrations/` on the single Supabase project is now the unambiguous single source of truth. The three-copy duplication problem is fully retired, with an automated guard (`pnpm -C frontend guard:schema`) against regression.
- The old bootstrap mirror has been archived to `frontend/db/migrations-legacy/` (with explanatory README). CI now runs the schema guard on every push/PR.