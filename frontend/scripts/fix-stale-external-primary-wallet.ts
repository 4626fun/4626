#!/usr/bin/env tsx
/**
 * Clears a stale external EOA incorrectly persisted as profiles.primary_wallet
 * when the profile already has a canonical CSW + Privy embedded signer.
 *
 * Usage:
 *   pnpm -C frontend exec tsx scripts/fix-stale-external-primary-wallet.ts --profile-id=1 --apply
 *   pnpm -C frontend exec tsx scripts/fix-stale-external-primary-wallet.ts --email=you@example.com --stale=0x... --apply
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { disconnectExternalWalletFromProfile } from '../server/_lib/wallet/disconnectExternalWallet.ts'

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

function normalizeAddress(value: string): string | null {
  const out = String(value || '').trim().toLowerCase()
  if (!/^0x[a-f0-9]{40}$/.test(out)) return null
  return out
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply')
  const profileIdRaw = getArg('--profile-id')
  const email = getArg('--email').toLowerCase() || null
  const staleOverride = normalizeAddress(getArg('--stale'))

  const { getDb } = await import('../server/_lib/db/postgres.ts')
  const db = await getDb()
  if (!db) throw new Error('Database unavailable')

  let profileId = profileIdRaw ? Number(profileIdRaw) : NaN
  if (!Number.isInteger(profileId) || profileId <= 0) {
    if (!email) throw new Error('Provide --profile-id or --email')
    const found = await db.sql`
      SELECT id, email, primary_wallet, primary_embedded_eoa, embedded_wallet, csw_address
      FROM profiles
      WHERE lower(email) = ${email}
      LIMIT 1;
    `
    profileId = Number(found.rows?.[0]?.id)
    if (!Number.isInteger(profileId) || profileId <= 0) throw new Error(`No profile for email ${email}`)
  }

  const before = await db.sql`
    SELECT id, email, primary_wallet, primary_embedded_eoa, embedded_wallet, csw_address
    FROM profiles
    WHERE id = ${profileId}
    LIMIT 1;
  `
  const row = before.rows?.[0]
  if (!row) throw new Error(`Profile ${profileId} not found`)

  const stale =
    staleOverride ??
    normalizeAddress(String(row.primary_wallet ?? '')) ??
    null

  if (!stale) throw new Error('No stale external wallet address to clear')

  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', profile: row, staleWallet: stale }, null, 2))

  if (!apply) {
    console.log('\nRe-run with --apply to write changes.')
    return
  }

  const result = await disconnectExternalWalletFromProfile({
    db: db as any,
    profileId,
    externalAddress: stale,
  })

  const after = await db.sql`
    SELECT id, email, primary_wallet, primary_embedded_eoa, embedded_wallet, csw_address
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
