import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/** Strip SQL line comments for Dune execute-sql API payloads. */
export function stripSqlComments(sql: string): string {
  return sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
    .trim()
}

const METRIC_SQL_FILES: Record<string, string> = {
  'batcher-tx': '01-batcher-tx-volume.sql',
  'legacy-batcher-tx': '02-legacy-batcher-tx-volume.sql',
  'zora-coin-created': '03-zora-factory-coin-created.sql',
}

export type DuneMetricKey = keyof typeof METRIC_SQL_FILES

export function listDuneMetricKeys(): DuneMetricKey[] {
  return Object.keys(METRIC_SQL_FILES) as DuneMetricKey[]
}

export function isDuneMetricKey(value: string): value is DuneMetricKey {
  return value in METRIC_SQL_FILES
}

export function loadDuneMetricSql(metric: DuneMetricKey): string {
  const file = METRIC_SQL_FILES[metric]
  // Bundled next to this module for Vercel (project root is frontend/, not monorepo root).
  const path = resolve(import.meta.dirname, 'queries', file)
  const raw = readFileSync(path, 'utf8')
  const sql = stripSqlComments(raw)
  if (!sql) {
    throw Object.assign(new Error(`dune_metric_sql_empty:${metric}`), { status: 500 })
  }
  return sql
}
