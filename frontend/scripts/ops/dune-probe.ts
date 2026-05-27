#!/usr/bin/env tsx
/**
 * Verify DUNE_API_KEY against Dune's SQL execute API (server-side key only).
 *
 *   pnpm -C frontend exec tsx scripts/ops/dune-probe.ts
 *   pnpm -C frontend exec tsx scripts/ops/dune-probe.ts --metric=batcher-tx
 */
import { isDuneConfigured, runDuneSqlRows } from '../../server/_lib/dune/duneApi.js'
import { isDuneMetricKey, loadDuneMetricSql } from '../../server/_lib/dune/duneMetricSql.js'

async function main(): Promise<void> {
  if (!isDuneConfigured()) {
    console.error('DUNE_API_KEY is not set (use server env, not VITE_)')
    process.exit(1)
  }

  const metricArg = process.argv.find((a) => a.startsWith('--metric='))?.split('=')[1]?.trim()
  const sql = metricArg && isDuneMetricKey(metricArg) ? loadDuneMetricSql(metricArg) : 'SELECT 1 AS ok'

  console.log(`Running Dune SQL (${metricArg ?? 'probe'})…`)
  const rows = await runDuneSqlRows(sql, { performance: 'small', maxWaitMs: 60_000 })
  console.log(`OK — ${rows.length} row(s)`)
  console.log(JSON.stringify(rows.slice(0, 5), null, 2))
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
