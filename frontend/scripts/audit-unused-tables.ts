#!/usr/bin/env tsx
/**
 * Inventory `public.*` tables and for each, count references in the
 * codebase (via ripgrep). Flags tables that appear nowhere. Non-destructive.
 */

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

function loadEnvFile(path: string): void {
  let raw = ''
  try { raw = readFileSync(path, 'utf8') } catch { return }
  for (const line of raw.split('\n')) {
    const t = line.trim(); if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('='); if (eq < 0) continue
    const k = t.slice(0, eq).trim(); let v = t.slice(eq + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (k && !process.env[k]) process.env[k] = v
  }
}
const d = fileURLToPath(new URL('.', import.meta.url))
loadEnvFile(resolve(d, '../.env.local'))
loadEnvFile(resolve(d, '../../.env.local'))
loadEnvFile(resolve(d, '../.env'))

const REPO = resolve(d, '../..')

function countReferences(table: string): number {
  try {
    // Count hits outside supabase/migrations (those are the declarations) and
    // outside docs/_generated (auto-regenerated). Only TS/SQL code.
    const out = execFileSync(
      'rg',
      [
        '-c',
        '--glob',
        `!supabase/migrations/**`,
        '--glob',
        `!docs/_generated/**`,
        '--glob',
        `!frontend/scripts/audit-unused-tables.ts`,
        '--glob',
        `!frontend/scripts/diagnose-*.ts`,
        '--glob',
        `!frontend/scripts/apply-*.ts`,
        `\\b${table}\\b`,
        REPO,
      ],
      { encoding: 'utf8' },
    )
    return out
      .split('\n')
      .filter(Boolean)
      .map((line) => Number(line.split(':').pop()) || 0)
      .reduce((a, b) => a + b, 0)
  } catch {
    return 0
  }
}

async function main() {
  const { getDb } = await import('../server/_lib/db/postgres.js')
  const db = await getDb()
  if (!db) { console.error('db connect failed'); process.exit(1) }

  const tables = await db.sql`
    SELECT tablename AS name,
           (SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public' AND pg_indexes.tablename = t.tablename)::int AS index_count
    FROM pg_tables t
    WHERE schemaname = 'public'
    ORDER BY tablename;
  `

  const rows: Array<{
    table: string
    references: number
    verdict: 'USED' | 'UNREFERENCED'
  }> = []
  for (const row of tables.rows) {
    const name = String(row.name)
    const refs = countReferences(name)
    rows.push({
      table: name,
      references: refs,
      verdict: refs > 0 ? 'USED' : 'UNREFERENCED',
    })
  }

  console.log('\n── UNREFERENCED TABLES (in public schema, no code references) ──')
  const unref = rows.filter((r) => r.verdict === 'UNREFERENCED')
  if (unref.length === 0) console.log('  (none)')
  else for (const r of unref) console.log(`  ${r.table}`)

  console.log('\n── USED TABLES (reference count) ──')
  for (const r of rows.filter((r) => r.verdict === 'USED').sort((a, b) => a.references - b.references)) {
    console.log(`  ${r.references.toString().padStart(4)}  ${r.table}`)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
