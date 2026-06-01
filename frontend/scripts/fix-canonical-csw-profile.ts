#!/usr/bin/env tsx
/**
 * Repair a profile whose `profiles.csw_address` was pinned to the wrong wallet.
 *
 * Usage:
 *   pnpm -C frontend exec tsx scripts/fix-canonical-csw-profile.ts \
 *     --profile-id=1 \
 *     --csw=0xAb6d5C10b03300326cd7fab7267ae192842967b5 \
 *     --embedded=0xb2aad65a5402714bf428a66731ae62ba5c45cac0 \
 *     --clear-base-sub-account \
 *     --apply
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { repointCanonicalCswOnProfile } from '../server/_lib/wallet/repointCanonicalCsw.ts'

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

const scriptDir = fileURLToPath(new URL('.', import.meta.url))
loadEnvFile(resolve(scriptDir, '../.env.local'))
loadEnvFile(resolve(scriptDir, '../../.env.local'))
loadEnvFile(resolve(scriptDir, '../.env'))

function getArg(name: string): string {
  const eqPrefix = `${name}=`
  const eqMatch = process.argv.find((arg) => arg.startsWith(eqPrefix))
  if (eqMatch) return eqMatch.slice(eqPrefix.length).trim()
  const idx = process.argv.indexOf(name)
  if (idx === -1) return ''
  const next = process.argv[idx + 1]
  if (!next || next.startsWith('--')) return ''
  return String(next).trim()
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply')
  const profileId = Number(getArg('--profile-id'))
  const csw = getArg('--csw').toLowerCase()
  const embedded = getArg('--embedded').toLowerCase() || null
  const clearBaseSubAccount = process.argv.includes('--clear-base-sub-account')

  if (!Number.isInteger(profileId) || profileId <= 0) throw new Error('Provide --profile-id=<id>')
  if (!/^0x[a-f0-9]{40}$/.test(csw)) throw new Error('Provide --csw=0x...')

  const { getDb } = await import('../server/_lib/db/postgres.ts')
  const db = await getDb()
  if (!db) throw new Error('Database unavailable')

  const before = await db.sql`
    SELECT id, email, csw_address, primary_embedded_eoa, embedded_wallet, base_sub_account, primary_wallet
    FROM profiles
    WHERE id = ${profileId}
    LIMIT 1;
  `
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', before: before.rows?.[0] ?? null, csw, embedded, clearBaseSubAccount }, null, 2))

  if (!apply) {
    console.log('\nRe-run with --apply to write changes.')
    return
  }

  const result = await repointCanonicalCswOnProfile({
    db: db as any,
    profileId,
    canonicalCswAddress: csw,
    embeddedEoaAddress: embedded,
    clearBaseSubAccount,
  })

  const after = await db.sql`
    SELECT id, email, csw_address, primary_embedded_eoa, embedded_wallet, base_sub_account, primary_wallet
    FROM profiles
    WHERE id = ${profileId}
    LIMIT 1;
  `

  console.log(JSON.stringify({ result, after: after.rows?.[0] ?? null }, null, 2))
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
