#!/usr/bin/env tsx
/**
 * Operator: run creator metrics backfill + duplicate integrity audit.
 *
 * Usage:
 *   pnpm -C frontend exec tsx scripts/run-creator-metrics-backfill.ts
 *   pnpm -C frontend exec tsx scripts/run-creator-metrics-backfill.ts --release-lock
 *   pnpm -C frontend exec tsx scripts/run-creator-metrics-backfill.ts --fast
 *   pnpm -C frontend exec tsx scripts/run-creator-metrics-backfill.ts --explore-backfill
 *   pnpm -C frontend exec tsx scripts/run-creator-metrics-backfill.ts --refresh-ethos
 *   pnpm -C frontend exec tsx scripts/run-creator-metrics-backfill.ts --both --fast
 *   pnpm -C frontend exec tsx scripts/run-creator-metrics-backfill.ts --force-full --max-pages 240
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { getDb } from '../server/_lib/db/postgres.js'
import {
  recomputeCreatorCounts,
  runCreatorEthosProjectionRefresh,
  runCreatorMetricsExploreBackfill,
  runCreatorMetricsSync,
} from '../server/_lib/zora/creatorMetricsSync.js'

function loadEnvFile(path: string): void {
  let raw = ''
  try {
    raw = readFileSync(path, 'utf8')
  } catch {
    return
  }
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (key && !process.env[key]) process.env[key] = value
  }
}

function parseArgs(argv: string[]) {
  const flags = new Set<string>()
  const map = new Map<string, string>()
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (!token?.startsWith('--')) continue
    const key = token.slice(2)
    const next = argv[i + 1]
    if (next === undefined || next.startsWith('--')) {
      flags.add(key)
    } else {
      map.set(key, next)
      i += 1
    }
  }
  return {
    auditOnly: flags.has('audit-only'),
    repairOnly: flags.has('repair-only'),
    releaseLock: flags.has('release-lock'),
    forceFull: flags.has('force-full'),
    fast: flags.has('fast'),
    exploreBackfill: flags.has('explore-backfill'),
    both: flags.has('both'),
    refreshEthos: flags.has('refresh-ethos'),
    skipEthosRefresh: flags.has('skip-ethos-refresh'),
    maxPages: Number(map.get('max-pages') ?? ''),
    exploreMaxPages: Number(map.get('explore-max-pages') ?? ''),
    ethosLimit: Number(map.get('ethos-limit') ?? ''),
  }
}

function applyFastBackfillProfile(): void {
  const defaults: Record<string, string> = {
    CREATOR_METRICS_MAX_CHAIN_SCAN_CHUNKS: '64',
    CREATOR_METRICS_CHAIN_SCAN_BLOCK_SPAN: '90000',
    CREATOR_METRICS_ENRICH_DURING_BACKFILL: '0',
    CREATOR_METRICS_COIN_UPSERT_BATCH_SIZE: '500',
    CREATOR_METRICS_BLOCK_FETCH_CONCURRENCY: '32',
  }
  for (const [key, value] of Object.entries(defaults)) {
    if (!process.env[key]) process.env[key] = value
  }
  console.log('[sync] fast profile env', defaults)
}

function applyExploreBackfillProfile(): void {
  const defaults: Record<string, string> = {
    CREATOR_METRICS_EXPLORE_BACKFILL_MAX_PAGES_PER_LIST: '2000',
    CREATOR_METRICS_EXPLORE_REQUEST_INTERVAL_MS: '50',
    CREATOR_METRICS_COIN_UPSERT_BATCH_SIZE: '500',
    CREATOR_METRICS_EXPLORE_ETHOS_PROJECTION_LIMIT: '50000',
  }
  for (const [key, value] of Object.entries(defaults)) {
    if (!process.env[key]) process.env[key] = value
  }
  console.log('[sync] explore-backfill profile env', defaults)
}

async function auditDuplicates(db: NonNullable<Awaited<ReturnType<typeof getDb>>>) {
  const creatorsTotal = await db.sql`SELECT COUNT(*)::bigint AS n FROM creators`
  console.log('\n[audit] creators_total', creatorsTotal.rows?.[0])

  const checks = [
    {
      label: 'duplicate_coin_addresses (expect 0 rows)',
      sql: db.sql`
        SELECT coin_address, COUNT(*)::bigint AS n
        FROM creator_coins
        GROUP BY coin_address
        HAVING COUNT(*) > 1
        LIMIT 10
      `,
    },
    {
      label: 'duplicate_creator_addresses (expect 0 rows)',
      sql: db.sql`
        SELECT creator_address, COUNT(*)::bigint AS n
        FROM creators
        GROUP BY creator_address
        HAVING COUNT(*) > 1
        LIMIT 10
      `,
    },
    {
      label: 'case_variant_creator_rows (expect 0 rows)',
      sql: db.sql`
        SELECT LOWER(creator_address) AS addr, COUNT(DISTINCT creator_address)::bigint AS variants
        FROM creators
        GROUP BY LOWER(creator_address)
        HAVING COUNT(DISTINCT creator_address) > 1
        LIMIT 10
      `,
    },
    {
      label: 'case_variant_coin_rows (expect 0 rows)',
      sql: db.sql`
        SELECT LOWER(coin_address) AS addr, COUNT(DISTINCT coin_address)::bigint AS variants
        FROM creator_coins
        GROUP BY LOWER(coin_address)
        HAVING COUNT(DISTINCT coin_address) > 1
        LIMIT 10
      `,
    },
    {
      label: 'creators_without_coins (expect 0 after sync cleanup)',
      sql: db.sql`
        SELECT COUNT(*)::bigint AS n
        FROM creators c
        WHERE NOT EXISTS (
          SELECT 1 FROM creator_coins cc WHERE cc.creator_address = c.creator_address
        )
      `,
    },
    {
      label: 'orphan_coin_creators (expect 0 after recomputeCreatorCounts)',
      sql: db.sql`
        SELECT COUNT(DISTINCT cc.creator_address)::bigint AS n
        FROM creator_coins cc
        WHERE cc.chain_id = 8453
          AND NOT EXISTS (
            SELECT 1 FROM creators c WHERE c.creator_address = cc.creator_address
          )
      `,
    },
    {
      label: 'distinct_creators_in_coins vs creators table',
      sql: db.sql`
        SELECT
          (SELECT COUNT(*)::bigint FROM creators) AS creators_table,
          (SELECT COUNT(DISTINCT creator_address)::bigint FROM creator_coins WHERE chain_id = 8453) AS distinct_in_coins
      `,
    },
    {
      label: 'invalid_creator_addresses (expect 0)',
      sql: db.sql`
        SELECT creator_address
        FROM creators
        WHERE creator_address !~ '^0x[a-f0-9]{40}$'
        LIMIT 10
      `,
    },
    {
      label: 'sync_state',
      sql: db.sql`
        SELECT
          backfill_complete,
          explore_backfill_complete,
          explore_last_sync_at::text AS explore_last_sync_at,
          explore_checkpoints_json,
          sync_status,
          sync_error,
          checkpoint_block,
          cached_creators_total,
          cached_totals_at::text AS cached_totals_at
        FROM creator_metrics_state
        WHERE id = 1
      `,
    },
  ] as const

  for (const check of checks) {
    const r = await check.sql
    console.log(`\n[audit] ${check.label}`)
    console.log(JSON.stringify(r.rows, null, 2))
  }
}

async function main() {
  loadEnvFile(resolve(process.cwd(), '.env'))
  loadEnvFile(resolve(process.cwd(), '../.env'))

  const args = parseArgs(process.argv.slice(2))
  const db = await getDb()
  if (!db) {
    console.error('database_not_configured — set DATABASE_URL in frontend/.env')
    process.exit(1)
  }

  console.log('[audit] before')
  await auditDuplicates(db)

  if (args.auditOnly) {
    console.log('\n[done] audit-only')
    return
  }

  if (args.repairOnly) {
    console.log('\n[repair] recomputeCreatorCounts')
    await recomputeCreatorCounts(db)
    console.log('\n[audit] after repair')
    await auditDuplicates(db)
    return
  }

  if (args.releaseLock) {
    await db.sql`
      UPDATE creator_metrics_state
      SET sync_status = 'idle', sync_error = 'operator_released_stale_running_lock'
      WHERE id = 1 AND sync_status = 'running'
    `
    console.log('\n[release-lock] cleared running sync lock if present')
    await auditDuplicates(db)
    return
  }

  const maxPages = Number.isFinite(args.maxPages) && args.maxPages > 0 ? Math.floor(args.maxPages) : undefined
  const exploreMaxPages =
    Number.isFinite(args.exploreMaxPages) && args.exploreMaxPages > 0 ? Math.floor(args.exploreMaxPages) : undefined
  const ethosLimit =
    Number.isFinite(args.ethosLimit) && args.ethosLimit > 0 ? Math.floor(args.ethosLimit) : undefined
  const refreshEthosOpt = args.skipEthosRefresh ? false : args.refreshEthos ? true : undefined

  const runExplore = args.exploreBackfill || args.both
  const runChain = args.both || (!args.exploreBackfill && !args.both && !args.refreshEthos)
  const runEthosOnly = args.refreshEthos && !runExplore && !runChain

  if (runEthosOnly) {
    console.log('\n[sync] refreshing creator Ethos projection', { ethosLimit: ethosLimit ?? 'default' })
    const ethosResult = await runCreatorEthosProjectionRefresh({ limit: ethosLimit })
    console.log('\n[sync] ethos result')
    console.log(JSON.stringify(ethosResult, null, 2))
    console.log('\n[audit] after ethos refresh')
    await auditDuplicates(db)
    if (!ethosResult.ok) process.exit(1)
    return
  }

  if (runExplore) {
    applyExploreBackfillProfile()
    console.log('\n[sync] starting explore API backfill', {
      forceFull: args.forceFull,
      exploreMaxPages: exploreMaxPages ?? 'default',
    })
    const exploreResult = await runCreatorMetricsExploreBackfill({
      forceFull: args.forceFull,
      maxPagesPerList: exploreMaxPages,
      refreshEthos: refreshEthosOpt,
    })
    console.log('\n[sync] explore result')
    console.log(JSON.stringify(exploreResult, null, 2))
    console.log('\n[audit] after explore')
    await auditDuplicates(db)
    if (!exploreResult.ok) process.exit(1)
    if (!runChain) {
      console.log('\n[done] explore-backfill only')
      return
    }
  }

  if (!runChain) return

  if (args.fast) applyFastBackfillProfile()
  console.log('\n[sync] starting on-chain backfill', {
    forceFull: args.forceFull,
    fast: args.fast,
    maxPages: maxPages ?? 'default',
  })

  const result = await runCreatorMetricsSync({
    forceFull: args.forceFull,
    maxPages,
    includeHotRefresh: false,
  })

  console.log('\n[sync] result')
  console.log(JSON.stringify(result, null, 2))

  console.log('\n[audit] after')
  await auditDuplicates(db)

  if (!result.ok) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
