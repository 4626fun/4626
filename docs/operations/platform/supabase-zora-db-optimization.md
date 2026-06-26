# Supabase optimization — Zora indexer tables

Audit date: 2026-05-18. Project: `qajpnuvqlcfseghnldkl`.

## Access

Agents/operators with Supabase MCP or `DATABASE_URL` can run the verification queries below. Do not commit credentials.

## Size snapshot (top tables)

| Table | ~Rows | Total size | Notes |
| ----- | ----- | ---------- | ----- |
| `zora_csw_owners` | 1.53M | **1.5 GB** | Dominates DB; seq-scan heavy |
| `zora_csw_owner_class` | 203k | 99 MB | Outreach / Ethos enrichment |
| `ethos_userkey_scores` | 137k | 52 MB | Index use healthy |
| `telegram_link_telemetry_events` | 164k | 50 MB | Log retention cron exists |

## Root cause: sequential scans on `zora_csw_owners`

`pg_stat_user_tables` showed **~5.4B** `seq_tup_read` vs **2** `idx_scan` on `zora_csw_owners` (stats may reset after deploy; pattern still valid).

### Query inventory

| Caller | Pattern | Index-friendly? | Action |
| ------ | ------- | ----------------- | ------ |
| `indexer/src/runEnrich.ts` | Keyset on `creation_block` + `last_owner_sync_at IS NULL` | Yes — use partial index `idx_zora_csw_owners_pending` | Keep keyset; avoid OFFSET |
| `indexer/src/classifyOwners.ts` | Keyset pages on enriched CSWs | Full pass scans ~1.5M rows | Default cap `CLASSIFY_MAX_ENRICHED_ROWS=25000`; optional `CLASSIFY_MIN_CREATION_BLOCK`; `CLASSIFY_UNLIMITED=1` only for intentional full runs |
| `frontend/scripts/ethos-zora-backfill.ts` | Keyset on `csw_address` | Pages are OK | Progress uses `pg_class.reltuples` estimate (no `COUNT(*)`) |
| `frontend/api/_handlers/zora/_explore.ts` | `JOIN zora_csw_owners zco ON lower(zco.csw_address) = …` | Needs functional index on `lower(csw_address)` | Migration `20260518220000_zora_table_maintenance.sql` |
| `indexer/src/exportOutreach.ts` | `.contains('current_owners', [checksummed])` per row | GIN on `current_owners` when address is checksummed | Batch CSW lookup in SQL where possible |
| `frontend/api/.../zora-csw/_enrichCron.ts` | `current_owners IS NULL` + stale `last_owner_sync_at` | Partial / btree indexes | Already bounded by cron budget |

## Log retention (already scheduled)

`public.cleanup_log_retention()` deletes rows older than:

- `telegram_link_telemetry_events` — **60 days** (default)
- `agent_api_logs` — 60 days
- `farcaster_rollout_events` — 60 days
- `telegram_funnel_events` — 90 days
- `chat_command_center_events` — 90 days

**Cron:** `daily-cleanup-log-retention` at `45 3 * * *` UTC (`cron.job` active).

To trim sooner once: `SELECT public.cleanup_log_retention(30, 30, 30, 60, 60);`

## Maintenance migration

`supabase/migrations/20260518220000_zora_table_maintenance.sql` adds:

1. `idx_zora_csw_owners_csw_address_lower` — speeds `lower(csw_address)` joins (explore / ethos projection).
2. `idx_zora_csw_owner_class_outreach_pool` — speeds triple-signal export filters.
3. Weekly `pg_cron` jobs `weekly-zora-vacuum-owners` / `weekly-zora-vacuum-owner-class` — `VACUUM ANALYZE` on Zora tables (~103k dead tuples observed on `zora_csw_owners`). Applied to production 2026-05-18.

## Index prune policy

Supabase advisor reports **219 unused_index** hints (mostly INFO). Re-run after ~7 days of normal traffic:

```bash
# Paste or run scripts/zora-index-usage-report.sql in Supabase SQL editor
```

Drop only when **both** advisor and `idx_scan = 0` over a full week **and** no planned query uses the column set. **Never drop `*_pkey`.**

### Snapshot 2026-05-18 (stats may reset after deploy — treat as directional)

| Index | Size | idx_scan | Verdict |
| ----- | ---- | -------- | ------- |
| `idx_zora_csw_owners_current_owners` (GIN) | ~231 MB | 0* | **Keep** — `exportOutreach` `.contains('current_owners', …)` |
| `idx_zora_csw_owners_csw_address_lower` | ~99 MB | 500+ | **Keep** — explore/ethos joins |
| `idx_zco_owner1_lower` | ~99 MB | 0 | **Review** — possible duplicate of owner[1] heuristic; drop only after 7d idle |
| `idx_zora_csw_owners_pending` | ~28 MB | 0 | **Keep** — enrich backlog when `last_owner_sync_at IS NULL` |
| `idx_zora_csw_owner_class_outreach_pool` | ~16 kB | 0* | **Keep** — new; powers `exportOutreach` filter |
| `zora_csw_owner_class_pkey` | ~18 MB | 0* | **Keep** — PK (stats artifact) |

\*Zero after stats reset does not mean unused forever.

**Do not drop** the GIN on `current_owners` to save space unless outreach export moves to SQL batching without GIN lookups.

## Do-not-do list

- Full `SELECT * FROM zora_csw_owners` in app hot paths.
- OFFSET pagination on filtered Zora tables (use keyset on `creation_block` or `csw_address`).
- Running `classifyOwners` with `CLASSIFY_UNLIMITED=1` unless you intend a full ~1.5M-row pass.
- Dropping GIN on `current_owners` until outreach export moves to SQL batching.

## Verification

```sql
-- Dead tuple pressure
SELECT relname, n_dead_tup, last_autovacuum, last_analyze
FROM pg_stat_user_tables
WHERE relname IN ('zora_csw_owners', 'zora_csw_owner_class');

-- Seq vs index since stats reset
SELECT relname, seq_scan, seq_tup_read, idx_scan, n_live_tup
FROM pg_stat_user_tables
WHERE relname LIKE 'zora_csw%'
ORDER BY seq_tup_read DESC;
```
