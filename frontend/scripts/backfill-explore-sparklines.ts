#!/usr/bin/env tsx
/**
 * Operator: backfill explore table 30D sparklines into creator_coins.
 *
 * Uses subgraph-first resolution (Uniswap PoolDayData, then Zora swaps).
 * Runs locally to avoid Vercel hot-sync timeouts.
 *
 * Usage:
 *   pnpm -C frontend exec tsx scripts/backfill-explore-sparklines.ts
 *   pnpm -C frontend exec tsx scripts/backfill-explore-sparklines.ts --budget 96 --batches 20
 *   pnpm -C frontend exec tsx scripts/backfill-explore-sparklines.ts --dry-run
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { getDb } from '../server/_lib/db/postgres.js'
import { precomputeExploreSparklinesForCoins } from '../server/_lib/zora/exploreSparklinePrecompute.js'

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
  const budget = Number(map.get('budget') ?? '')
  const batches = Number(map.get('batches') ?? '')
  const concurrency = Number(map.get('concurrency') ?? '')
  return {
    dryRun: flags.has('dry-run'),
    budget: Number.isFinite(budget) && budget > 0 ? Math.floor(budget) : 96,
    batches: Number.isFinite(batches) && batches > 0 ? Math.floor(batches) : 10,
    concurrency: Number.isFinite(concurrency) && concurrency > 0 ? Math.floor(concurrency) : 6,
  }
}

async function readSparklineStats(db: NonNullable<Awaited<ReturnType<typeof getDb>>>) {
  const result = await db.sql`
    SELECT
      COUNT(*) FILTER (
        WHERE sparkline_30d_values IS NOT NULL
          AND jsonb_array_length(sparkline_30d_values) >= 2
      )::bigint AS with_sparkline,
      COUNT(*)::bigint AS total
    FROM creator_coins
    WHERE chain_id = 8453;
  `
  const row = result.rows?.[0] ?? {}
  return {
    withSparkline: Number(row.with_sparkline ?? 0),
    total: Number(row.total ?? 0),
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

  const hasGraph = Boolean(process.env.THEGRAPH_API_KEY || process.env.GRAPH_API_KEY)
  const zoraKey =
    process.env.ZORA_SERVER_API_KEY?.trim() || process.env.VITE_ZORA_PUBLIC_API_KEY?.trim() || ''
  if (!hasGraph && !zoraKey) {
    console.error('Need THEGRAPH_API_KEY and/or ZORA_SERVER_API_KEY for sparkline resolution')
    process.exit(1)
  }

  const before = await readSparklineStats(db)
  console.log('[sparkline-backfill] before', before, { hasGraph, hasZoraKey: Boolean(zoraKey) })

  if (args.dryRun) {
    console.log('[sparkline-backfill] dry-run — would run', args)
    return
  }

  let sdk: unknown = null
  if (zoraKey) {
    const mod = await import('@zoralabs/coins-sdk')
    mod.setApiKey(zoraKey)
    sdk = mod
  }

  let totalAttempted = 0
  let totalRefreshed = 0
  let totalFailed = 0

  for (let batch = 1; batch <= args.batches; batch += 1) {
    const result = await precomputeExploreSparklinesForCoins(sdk, db, {
      coinAddresses: [],
      budget: args.budget,
      concurrency: args.concurrency,
      fillFromTopVolume: true,
    })

    totalAttempted += result.attempted
    totalRefreshed += result.refreshed
    totalFailed += result.failed

    console.log(`[sparkline-backfill] batch ${batch}/${args.batches}`, result)

    if (result.disabled) {
      console.warn('[sparkline-backfill] precompute disabled via CREATOR_METRICS_SPARKLINE_PRECOMPUTE_ENABLED=0')
      break
    }
    if (result.attempted === 0 || result.refreshed === 0) {
      console.log('[sparkline-backfill] no more stale top-volume coins in this batch — stopping')
      break
    }
  }

  const after = await readSparklineStats(db)
  console.log('[sparkline-backfill] summary', {
    batchesRun: args.batches,
    totalAttempted,
    totalRefreshed,
    totalFailed,
    before,
    after,
    delta: after.withSparkline - before.withSparkline,
  })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
