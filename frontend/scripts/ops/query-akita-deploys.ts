#!/usr/bin/env tsx
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
function loadEnvFile(path: string): void {
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (key && process.env[key] === undefined) process.env[key] = value
  }
}
loadEnvFile(resolve(__dirname, '../../.env.local'))
loadEnvFile(resolve(__dirname, '../../.env'))

import { getDb, isDbConfigured } from '../../server/_lib/db/postgres.js'

declare const process: { exit: (n?: number) => never; stdout: { write: (s: string) => void } }

async function main(): Promise<void> {
  if (!isDbConfigured()) {
    process.stdout.write('DATABASE_URL not configured\n')
    process.exit(1)
  }
  const db = await getDb()
  if (!db) {
    process.stdout.write('DB unavailable\n')
    process.exit(1)
  }
  const rows = await db.sql`
    SELECT id, step, state, smart_wallet, last_error, updated_at,
           payload->>'owner' as owner,
           payload->'expected'->>'wrapper' as expected_wrapper,
           payload->'expected'->>'vault' as expected_vault,
           payload->'expected'->>'shareOFT' as expected_share,
           payload->>'deploymentVersion' as version
    FROM deploys
    WHERE lower(coalesce(payload->>'creatorToken','')) = lower('0x5b674196812451b7cec024fe9d22d2c0b172fa75')
    ORDER BY updated_at DESC
    LIMIT 8
  `
  process.stdout.write(`${JSON.stringify(rows, null, 2)}\n`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
