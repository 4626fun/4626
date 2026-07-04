# Supabase database optimization audit (July 2026)

Project: `4626fun` (`qajpnuvqlcfseghnldkl`)  
Snapshot date: 2026-07-04

This document consolidates the live DB size review, retention work, identity backfill tooling, and empty-table classification from the July 2026 pass.

## Storage snapshot (public schema ~3.3 GB)

| Table / area | Approx. size | Notes |
|---|---|---|
| `zora_csw_owners` | ~1.1 GB | Indexer hot path; autovacuum tuned in `20260713130000` |
| `creator_coins` | ~568 MB | Metric upserts; autovacuum tuned |
| `ethos_userkey_scores` | ~251 MB | Shared Ethos cache; prune unmapped keys via new retention fn |
| `creator_ethos_daily_snapshots` | ~106 MB | 90-day prune already scheduled |
| `backtest_market_bars_1m` | ~102 MB | Research/backtest lane |

High-frequency Ethos snapshot tables (`creator_ethos_hourly_snapshots`, `creator_ethos_15min_snapshots`) were dropped in `20260713010000`.

## Identity gap (live)

| Metric | Count |
|---|---|
| Live `profiles` | 97 |
| Profiles with `csw_address` | 3 |
| `accounts` rows | 41 |
| `account_zora_signals` | 17 (2 with CSW) |
| Profiles with `privy_user_id` but no `accounts` row | 8 |

**Mitigation shipped in this pass**

1. **Runtime refinement** — `refineAccountIdentityFromPrivy` runs on waitlist bootstrap after Privy auth (`frontend/api/_handlers/waitlist/_bootstrap.ts`).
2. **One-shot backfill** — `frontend/scripts/refine-account-identity-backfill.ts`  
   - Dry-run (2026-07-04): **49** Privy users, **8** orphan profiles without `accounts` rows.  
   - Apply: `pnpm -C frontend exec tsx scripts/refine-account-identity-backfill.ts --apply`  
   - Optional Zora force-refresh: `--force-zora`  
   - Rate limit Privy: `--delay-ms=250` (default)

## Operational retention (new migration)

**File:** `supabase/migrations/20260714010000_operational_retention_cleanup.sql`

Adds `cleanup_operational_retention()` and pg_cron job `daily-cleanup-operational-retention` (04:15 UTC):

| Target | Default TTL | Action |
|---|---|---|
| `agent_rate_limits` | 14 days | Delete by `created_at` |
| `keeper_jobs` (succeeded) | 30 days | Delete terminal rows by `updated_at` |
| `keeper_jobs` (failed) | 90 days | Delete terminal rows by `updated_at` |
| `control_plane_operations` (terminal) | 90 days | Delete `succeeded`/`failed`/`cancelled`/`expired`; cascades stages + events |
| `index_usage_snapshots` | 90 days | Delete by `snapshot_at` |
| `ethos_userkey_scores` (unmapped) | n/a | Delete rows with no `user_ethos_identity_keys` match |

Manual one-off (after migration applied):

```sql
SELECT public.cleanup_operational_retention();
```

Existing retention (unchanged): `cleanup_expired_rows()` (03:15 UTC), `cleanup_log_retention()` (03:45 UTC).

## Empty-table classification

**Script:** `pnpm -C frontend exec tsx scripts/audit-dead-tables.ts`

**Result (2026-07-04):** 0 `truly-dead`, 0 `schema-only`, **95 feature-scaffold**.

Every zero-row candidate still has production or scaffold code references (handlers, Eliza runtime, workspace repo, keepr, AMOE, deploy, waitlist leads, etc.). **No additional DROP migration is recommended** beyond what already shipped.

### Already dropped (do not recreate)

`supabase/migrations/20260713020000_drop_dead_scaffold_tables.sql`:

- `message_threads`, `thread_messages`, `thread_participants`, `thread_summaries`
- `payment_rail_attempts`
- `base_address_activity_30d`
- `farcaster_rollout_events`
- `public.alfaclub_chat_ingest` (legacy; canonical copy lives in `alfaclub.chat_ingest`)

### KEEP — active or staged features (sample)

| Area | Tables | Why keep |
|---|---|---|
| Waitlist / onboarding | `waitlist_leads`, `referral_*`, `deploys` | Live handlers + attribution |
| Keepr / keeper | `keepr_*`, `keeper_jobs`, `ajna_vaults` | Automation + coordination queue |
| Workspace | `workspace_*` | `workspace/repository.ts` |
| Telegram | `telegram_*` | Trading + Mini App flows |
| AMOE / lottery | `lottery_amoe_*`, `amoe_*` | Lottery + burn ledger |
| Agent memory | `memory_snapshots`, `grove_chat_manifests`, `task_loops` | Eliza runtime bridge |
| Payments / control plane | `payment_orders`, `payment_events`, `control_plane_*` | Settlement + provisioning |
| Auth TTL tables | `auth_*`, `telegram_miniapp_*`, `wallet_intelligence_cache` | Already in `cleanup_expired_rows` |

### Ops-only telemetry (retain, prune)

| Table | Retention |
|---|---|
| `index_usage_snapshots` | 90 days via `cleanup_operational_retention` |
| `agent_api_logs`, `keepr_logs`, workspace snapshots | `cleanup_log_retention` |

## Recommended apply order

1. Apply Supabase migrations through `20260714010000` on staging, then production.
2. Run one-off retention smoke: `SELECT cleanup_operational_retention();` and inspect JSON result.
3. Dry-run backfill, then `--apply` during low traffic.
4. Re-check identity: `profiles.csw_address` and `account_zora_signals.canonical_csw_address` counts.

## Production apply log (2026-07-04)

### Retention migration (applied)

First `cleanup_operational_retention()` run deleted:

| Target | Rows |
|---|---|
| `keeper_jobs` (succeeded) | 4,481 |
| `index_usage_snapshots` | 676 |
| `ethos_userkey_scores` (unmapped) | 631,811 |

### Identity backfill pass 1 (`--apply`, all users)

| Metric | Before | After |
|---|---|---|
| `accounts` rows | 41 | 49 |
| Orphan profiles | 8 | 0 |
| Profiles with `csw_address` | 3 | 8 |
| `account_zora_signals` with CSW | 2 | 8 |

41/49 Privy users refined; 8 Privy `User not found` (stale IDs).

### Identity backfill pass 2 (`--only-missing-csw --force-zora --clear-ghost-privy --apply`)

| Metric | Before | After |
|---|---|---|
| Profiles with Privy | 48 | 41 |
| `accounts` rows | 49 | 42 |
| Profiles with CSW | 8 | 8 (unchanged) |

- 33 live users re-refined with forced Zora refresh; no additional CSW discovered (expected — remaining users are email/embedded-only without Base CSW).
- 7 ghost Privy IDs cleared (`profiles.privy_user_id` nulled + orphan `accounts` rows deleted).

### Code refinements (same session)

- `refineAccountIdentityFromPrivy` skips `external_eoa` provider linking when no external wallet is linked (removes log noise for email-only users).
- `resolveAndPersistZoraSignals` backfills `profiles.csw_address` when canonical CSW is resolved into signals but profile column is still empty.
- Backfill script flags: `--only-missing-csw`, `--clear-ghost-privy`, before/after identity stats.

## Related scripts

| Script | Purpose |
|---|---|
| `frontend/scripts/refine-account-identity-backfill.ts` | Privy → wallet sync + Zora signals backfill |
| `frontend/scripts/audit-repair-canonical-csw.ts` | On-chain CSW mixup repair |
| `frontend/scripts/audit-dead-tables.ts` | Code-ref classification for empty tables |
| `frontend/scripts/audit-unused-tables.ts` | Broader unused-table sweep |
| `frontend/scripts/audit-telemetry-optimization.ts` | Index/IO telemetry ops |

## Security advisors

Supabase security lints were clean at audit time. Performance INFO lints (~177 unused indexes) were partially addressed in `20260713100000_drop_unused_heavy_indexes.sql`; re-run advisors after retention migrations land.
