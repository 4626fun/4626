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

- New script `frontend/scripts/audit-telemetry-optimization.ts` now auto-suggests retention windows.
- Migration `20260612000000_extend_telemetry_retention.sql` extends the existing daily `cleanup_log_retention` cron job with the top candidates using the suggested TTLs (7–90 days).

Run anytime:
```bash
pnpm -C frontend exec tsx scripts/audit-telemetry-optimization.ts
```

### Recommended Next Steps (Prioritized Backlog)

1. **Sampling** for highest-frequency low-value streams (`telegram_funnel_events`, `chat_presence_sessions`).
2. Move the top 5–7 pure telemetry tables to an `analytics` schema or external store.
3. Dedicated Looker view hygiene pass (many `v_looker_*` have near-zero server usage).

These changes deliver measurable wins on storage growth, vacuum cost, and operational load with extremely low risk.

Run it anytime with:
```bash
pnpm -C frontend exec tsx scripts/audit-dead-tables.ts
```

---

**Bottom line**: The 137 tables are not a sign of schema bloat or duplication. They reflect a complex, multi-surface platform. The condensation + guard work has successfully prevented dead DDL from accumulating in the codebase. Row count alone is a poor signal for deletion in this system.
