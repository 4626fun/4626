#!/usr/bin/env node
/**
 * Remove stale failed keeper_jobs so /api/keeper/jobs/health is not noisy.
 * Default: dry-run. Use --execute to DELETE rows matching filters.
 *
 *   pnpm -C frontend exec tsx scripts/ops/archive-failed-keeper-jobs.ts
 *   pnpm -C frontend exec tsx scripts/ops/archive-failed-keeper-jobs.ts --execute
 *   pnpm -C frontend exec tsx scripts/ops/archive-failed-keeper-jobs.ts --kind internal_api --min-age-days 7 --execute
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

declare const process: {
  argv: string[]
  env: Record<string, string | undefined>
  exit: (code?: number) => never
  stdout: { write: (chunk: string) => void }
  stderr: { write: (chunk: string) => void }
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const FRONTEND_ROOT = resolve(__dirname, '../..')

function loadEnvFile(path: string): void {
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (key && process.env[key] === undefined) process.env[key] = value
  }
}

loadEnvFile(resolve(FRONTEND_ROOT, '.env.local'))
loadEnvFile(resolve(FRONTEND_ROOT, '.env'))

function parseArgs(): { execute: boolean; kind: string | null; minAgeDays: number } {
  let execute = false
  let kind: string | null = null
  let minAgeDays = 1
  const argv = process.argv.slice(2)
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--execute') execute = true
    else if (arg === '--kind') kind = argv[++i] ?? null
    else if (arg === '--min-age-days') minAgeDays = Math.max(0, Number(argv[++i]) || 1)
    else if (arg === '--help' || arg === '-h') {
      process.stdout.write(`See script header for usage.\n`)
      process.exit(0)
    }
  }
  return { execute, kind, minAgeDays }
}

async function main(): Promise<void> {
  const { execute, kind, minAgeDays } = parseArgs()
  const { getDb, getDbInitError } = await import('../../server/_lib/db/postgres.js')
  const db = await getDb()
  if (!db) {
    process.stderr.write(`DATABASE_URL unavailable: ${getDbInitError() ?? 'unknown'}\n`)
    process.exit(1)
  }

  const preview = await db.sql`
    SELECT id, kind, status, attempt_count, last_error, updated_at::text AS updated_at
    FROM keeper_jobs
    WHERE status = 'failed'
      AND updated_at < NOW() - (${minAgeDays}::text || ' days')::interval
      AND (${kind}::text IS NULL OR kind = ${kind})
    ORDER BY updated_at DESC;
  `

  const rows = preview.rows ?? []
  process.stdout.write(
    `${execute ? 'EXECUTE' : 'DRY-RUN'}: would delete ${rows.length} failed keeper_job(s) ` +
      `(min-age-days=${minAgeDays}${kind ? ` kind=${kind}` : ''})\n`,
  )
  for (const r of rows) {
    const err = String(r.last_error ?? '').slice(0, 100)
    process.stdout.write(`  #${r.id} ${r.kind} @${r.updated_at} — ${err}\n`)
  }

  if (!execute) {
    process.stdout.write('\nPass --execute to delete these rows.\n')
    return
  }
  if (rows.length === 0) {
    process.stdout.write('\nNothing to delete.\n')
    return
  }

  const deleted = await db.sql`
    DELETE FROM keeper_jobs
    WHERE status = 'failed'
      AND updated_at < NOW() - (${minAgeDays}::text || ' days')::interval
      AND (${kind}::text IS NULL OR kind = ${kind})
    RETURNING id;
  `
  const ids = (deleted.rows ?? []).map((r) => r.id)
  process.stdout.write(`\nDeleted ${ids.length} row(s): ${ids.join(', ')}\n`)

  const health = await db.sql`
    SELECT COUNT(*)::int AS failed FROM keeper_jobs WHERE status = 'failed';
  `
  process.stdout.write(`failed count now: ${health.rows?.[0]?.failed ?? '?'}\n`)
}

main().catch((err: unknown) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`)
  process.exit(1)
})
