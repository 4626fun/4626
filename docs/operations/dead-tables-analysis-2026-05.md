# Dead / Low-Usage Tables Analysis (May 2026)

**Date**: 2026-05 (post schema condensation)
**Tool**: `frontend/scripts/audit-dead-tables.ts` (expanded candidate list)
**Goal**: Identify tables with 0 (or very low) rows that might be safe to drop or are true dead code.

## Executive Summary

- **truly-dead tables**: **0**
- **schema-only tables** (only in migrations, no app code): **0**
- **feature-scaffold tables** (code exists but currently quiet): **95** (after deep expanded audit across the full ~137 table list from live Supabase)

**Conclusion (deeper pass)**: Even after a very broad audit including dozens more 0-row tables from your live DB snapshot, the result remains the same: **zero truly-dead tables**. Every table still has live (or intentionally scaffolded) code references. The schema is extremely clean post-condensation.

The 0-row tables are healthy categories:
1. Ephemeral/high-churn (nonces, caches, rate limits, short-lived sessions like `deploys`).
2. Rarely exercised / on-ice features.
3. Scaffolding for active development paths.

The 0-row (or low-row) tables fall into these healthy categories:

1. **Ephemeral / high-churn** (nonces, rate limits, short-lived sessions) — expected to be near-empty most of the time.
2. **Rarely exercised features** (on ice, seasonal, or low-volume production paths).
3. **New or recently promoted** scaffolding (code landed with migrations but traffic hasn't arrived yet).

## Key Findings by Category

### Strongest "On Ice" / Low-Reference Candidates
These have the fewest non-test, non-audit code references:

- `base_address_activity_30d` — almost no live references outside the audit script itself.
- `telegram_private_dm_welcome_sent` — very low references.
- `farcaster_rollout_events` — mostly historical migration + docs references.
- `payment_rail_attempts` — references are mostly in old migration files and the audit script.
- `ajna_vaults` — active in `ajnaVaultManager`, but 0 rows in snapshot (possible data model shift?).

### Actively Maintained (Despite 0 Rows in Snapshot)
These have substantial code even with current 0-row estimates (rows are transient or the table is used for coordination):

- `deploys` — **730 references**. Critical for the entire deploy flow (sessions are short-lived).
- `csw_owner_link_status`, `keepr_*`, `workspace_*`, `vault_chat_*`, `waitlist_leads`, `payment_*` — all have dedicated handlers/repositories.

### Ephemeral by Design (Ignore for Deletion)
- All `*_nonces`, `auth_*`, `telegram_miniapp_replay_nonces`, `lottery_amoe_nonces`, etc.
- Rate limit buckets, workflow checkpoints, etc.

## Recommendations

1. **Strong recommendation**: Do not drop any tables based on current row counts. After exhaustive search, **zero tables** qualify as truly-dead.

2. **Lowest-signal tables worth manual review** (very few live code refs outside audit/migrations/docs):
   - `base_address_activity_30d`
   - `farcaster_rollout_events`
   - `telegram_private_dm_welcome_sent`
   - `message_threads` / `thread_*` family (very low refs)
   - `payment_rail_attempts` (mostly legacy migration refs)

3. **Next steps** (if you still want to prune):
   - Add actual last activity timestamps (query `max(created_at/updated_at)` per table).
   - Review the large views/projections for consolidation opportunities instead of raw tables.
   - For any table you suspect, temporarily comment out its usage and run tests + the guard.

4. **Ongoing process**:
   - Keep running the audit script before big refactors.
   - The guard + this script together give excellent visibility into schema health.

## Script Notes

The audit script (`frontend/scripts/audit-dead-tables.ts`) was expanded during this analysis with additional 0-row candidates from the live DB snapshot (May 2026). It excludes migrations and test files when counting "live" code references.

## Telemetry / High-Maintenance Low-Value Optimization (New Pass)

Created `frontend/scripts/audit-telemetry-optimization.ts` specifically for the many audit/event/snapshot tables.

**Top optimization candidates** (low code surface area relative to maintenance cost):

- `query_temp_io_snapshots` (95% potential)
- `memory_snapshots`
- `telegram_funnel_events`
- `workspace_monitoring_snapshots`
- `episodic_summaries`
- `workspace_audit_logs`
- `workspace_activity_events`
- `alfaclub_metrics_snapshot`
- `chat_presence_sessions`
- `keepr_logs`
- `agent_api_logs`
- `agent_control_audit_events`
- `telegram_action_audit`

**Concrete recommendations**:
1. Add time-based retention (pg_cron job or in-app cleanup) for the top 10 — e.g. keep 30-90 days max for most telemetry.
2. Sample high-frequency events (especially chat and telegram funnel events) instead of storing every single one.
3. Consider moving pure telemetry/audit tables to a dedicated `analytics` schema (or even out of Supabase into S3 + Athena/ClickHouse) to reduce production DB load and cost.
4. Review all `v_looker_*` and similar BI views — several may be candidates for deprecation or less frequent materialization if Looker usage is limited.

These tables are the biggest remaining source of "room for optimization" after the dead-code cleanup. They accumulate data with relatively low business leverage per row.

### Implemented in this pass

- New script `frontend/scripts/audit-telemetry-optimization.ts` now auto-suggests retention windows + recommended sampling rates.
- Migration `20260612000000_extend_telemetry_retention.sql` extends the existing daily `cleanup_log_retention` cron job.
- Created `frontend/server/_lib/infra/telemetrySampling.ts` (deterministic hash-based sampler controlled by `TELEMETRY_SAMPLE_RATE`).
- Wired sampling into the two highest-volume paths:
  - `telegram_funnel_events` (in `telegramTrading.ts`)
  - `chat_command_center_events` (in `chatCommandCenterTelemetry.ts`)

**Extended wiring + actual cleanup (this slice)**:
- Dropped `query_temp_io_snapshots` (highest analyzer potential, confirmed complete orphan: no writers, no CREATE, no types anywhere in the tree). New migration `20260705000000_drop_orphan_query_temp_io_snapshots.sql`.
- Removed from analyzer candidate list.
- Enhanced sampler with table-aware `shouldSampleEvent(tableName, key)` + per-table env override support (`TELEMETRY_SAMPLE_RATE_<table>`).
- Wired deterministic sampling (early returns before INSERT) into:
  - `chat_presence_sessions` (presence.ts — heartbeats)
  - `telegram_link_telemetry_events` (telegramLinkTelemetry.ts)
  - All 4 workspace tables: `workspace_monitoring_snapshots`, `workspace_alert_events`, `workspace_activity_events`, `workspace_audit_logs` (repository.ts, keyed by vault)
  - `agent_api_logs` (agentAudit.ts)
  - `agent_control_audit_events` (agentControl/audit.ts)
  - `keepr_logs` (keeprRegistry.ts — two write sites)
  - `telegram_action_audit` (telegramTrading.ts)
  - `episodic_summaries` + `memory_snapshots` (runtimeBridge.ts, keyed by conversation_id)
  - `control_plane_events` + `control_plane_stages` (controlPlane/operations.ts — safeInsertEvent + create stage path)
  - `keepr_workflow_checkpoints` (controlPlane/executors/executeOperatorAction.ts)
  - `alfaclub_metrics_snapshot` (alfaclub/publicationLedger.ts — per-creator in the batch writer)

Run the improved script anytime:
```bash
pnpm -C frontend exec tsx scripts/audit-telemetry-optimization.ts
```

### Recommended Next Steps (Prioritized Backlog)

1. ~~Roll out sampling more broadly~~ (chat_presence_sessions, telegram_* telemetry, keepr_* (logs + checkpoints), agent_*_audit/logs, workspace_*, episodic/memory, control_plane_* (events + stages), alfaclub_metrics_snapshot — **done**).
2. **query_temp_io_snapshots** — **dropped**.
   - Exhaustive search (code, kpr/, all migrations, legacy, types, scripts): zero writers, zero CREATE TABLE, zero TypeScript definition.
   - Only footprint was a DELETE inside the 2026-06-12 retention job + the analyzer itself.
   - Created migration `20260705000000_drop_orphan_query_temp_io_snapshots.sql`.
   - This was the single highest "optimization potential" item from the analyzer. Removing it directly reduces the table count and maintenance surface.
3. Add per-table rate envs + tune the noisiest (presence, funnels, control plane, keepr workflows) in production via `TELEMETRY_SAMPLE_RATE_*`.
4. Move the top remaining pure telemetry tables (`query_temp_io_snapshots` if still written, `memory_snapshots`, `episodic_summaries`, workspace snapshots, etc.) to an `analytics` schema or external store (S3 + query engine).
5. Dedicated Looker view hygiene pass (many `v_looker_*` have near-zero server usage).
6. Re-run retention migration + analyzer after new high-volume tables appear.

These changes (retention + sampling) together are the highest-ROI optimization available after the schema condensation work. Expected impact: significant reduction in storage growth, vacuum cost, and index bloat on the hottest tables.

Run it anytime with:
```bash
pnpm -C frontend exec tsx scripts/audit-dead-tables.ts
```

---

**Bottom line**: The 137 tables are not a sign of schema bloat or duplication. They reflect a complex, multi-surface platform. The condensation + guard work has successfully prevented dead DDL from accumulating in the codebase. Row count alone is a poor signal for deletion in this system.
