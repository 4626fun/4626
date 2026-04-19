#!/usr/bin/env tsx
/**
 * Read-only diagnostic for a suspected split-identity case. Given two Privy
 * user ids (and optionally an email / EVM address), prints every row that
 * references either identity across the canonical tables so you can see
 * exactly how the fragmentation happened and what a merge would need to
 * touch.
 *
 * Usage:
 *   tsx scripts/diagnose-identity.ts --privy=A --privy=B [--email=...] [--wallet=0x...]
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

function loadEnvFile(path: string): void {
  let raw = ''
  try { raw = readFileSync(path, 'utf8') } catch { return }
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

const args = process.argv.slice(2)
const privyIds = args.filter((a) => a.startsWith('--privy=')).map((a) => a.slice('--privy='.length))
const email = (args.find((a) => a.startsWith('--email='))?.slice('--email='.length) ?? '').toLowerCase() || null
const wallet = (args.find((a) => a.startsWith('--wallet='))?.slice('--wallet='.length) ?? '').toLowerCase() || null

async function main() {
  if (privyIds.length === 0 && !email && !wallet) {
    console.error('provide at least --privy=X or --email=... or --wallet=0x...')
    process.exit(1)
  }
  const { getDb, getDbInitError } = await import('../server/_lib/db/postgres.js')
  const db = await getDb()
  if (!db) { console.error('db connect failed:', getDbInitError()); process.exit(1) }

  const profiles = await db.sql`
    SELECT id, email, privy_user_id, referral_code, referred_by_signup_id,
           primary_wallet, embedded_wallet, csw_address, created_at, updated_at
    FROM profiles
    WHERE privy_user_id = ANY(${privyIds}::text[])
       OR (${email}::text IS NOT NULL AND LOWER(email) = ${email})
       OR (${wallet}::text IS NOT NULL AND (
             LOWER(primary_wallet) = ${wallet}
             OR LOWER(embedded_wallet) = ${wallet}
             OR LOWER(csw_address) = ${wallet}
           ))
    ORDER BY id ASC;
  `
  console.log('\n── profiles rows matching any identifier ─────────────────')
  for (const r of profiles.rows) {
    console.log(JSON.stringify(r, null, 2))
  }
  const signupIds = profiles.rows.map((r: any) => r.id).filter((v: any) => typeof v === 'number')

  if (signupIds.length === 0) {
    console.log('  (none)')
    return
  }

  // profile_wallets if present
  try {
    const pw = await db.sql`
      SELECT profile_id, address, is_canonical_smart_wallet, is_primary, source, created_at
      FROM profile_wallets
      WHERE profile_id = ANY(${signupIds}::bigint[])
      ORDER BY profile_id ASC, created_at ASC;
    `
    console.log('\n── profile_wallets ───────────────────────────────────────')
    if (pw.rows.length === 0) console.log('  (none)')
    else for (const r of pw.rows) console.log(JSON.stringify(r))
  } catch { /* table may not exist */ }

  // linked_methods / account_links (if present)
  for (const table of ['linked_methods', 'account_links', 'account_identities']) {
    try {
      const rows = await db.sql`
        SELECT * FROM ${/* eslint-disable-line */ { toString: () => table }} AS t
        WHERE t.profile_id = ANY(${signupIds}::bigint[])
        ORDER BY t.profile_id ASC;
      `
      console.log(`\n── ${table} ──`)
      if (rows.rows.length === 0) console.log('  (none)')
      else for (const r of rows.rows) console.log(JSON.stringify(r))
    } catch { /* ignore */ }
  }

  // points
  const pts = await db.sql`
    SELECT signup_id, source, source_id, amount, created_at
    FROM points
    WHERE signup_id = ANY(${signupIds}::bigint[])
    ORDER BY signup_id ASC, created_at ASC;
  `
  console.log('\n── points ────────────────────────────────────────────────')
  if (pts.rows.length === 0) console.log('  (none)')
  else console.table(pts.rows)

  // referrals
  try {
    const ref = await db.sql`
      SELECT * FROM referral_conversions
      WHERE referrer_signup_id = ANY(${signupIds}::bigint[])
         OR referee_signup_id = ANY(${signupIds}::bigint[])
      ORDER BY created_at ASC;
    `
    console.log('\n── referral_conversions ──────────────────────────────────')
    if (ref.rows.length === 0) console.log('  (none)')
    else console.table(ref.rows)
  } catch { /* ignore */ }
}

main().catch((err) => {
  console.error('✗', err instanceof Error ? err.stack ?? err.message : err)
  process.exit(1)
})
