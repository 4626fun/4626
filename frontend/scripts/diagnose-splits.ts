#!/usr/bin/env tsx
/**
 * Audit the `profiles` table for split-identity cases: multiple live rows
 * that share an EVM wallet address across `primary_wallet`, `embedded_wallet`,
 * `csw_address`, or `profile_wallets`. Read-only.
 *
 * Output groups each shared wallet with the profiles that own it, so you
 * can decide which are legitimate merge candidates.
 */

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

async function main() {
  const { getDb } = await import('../server/_lib/db/postgres.js')
  const db = await getDb()
  if (!db) { console.error('db connect failed'); process.exit(1) }

  // Collect every (profile_id, wallet_address) pair from all sources
  // where the profile is still live (not tombstoned).
  const rows = await db.sql`
    WITH wallet_sources AS (
      SELECT id AS profile_id, LOWER(primary_wallet) AS address, 'primary_wallet' AS src
      FROM profiles
      WHERE merged_into_profile_id IS NULL AND primary_wallet IS NOT NULL AND primary_wallet <> ''
      UNION
      SELECT id, LOWER(embedded_wallet), 'embedded_wallet'
      FROM profiles
      WHERE merged_into_profile_id IS NULL AND embedded_wallet IS NOT NULL AND embedded_wallet <> ''
      UNION
      SELECT id, LOWER(csw_address), 'csw_address'
      FROM profiles
      WHERE merged_into_profile_id IS NULL AND csw_address IS NOT NULL AND csw_address <> ''
    ),
    grouped AS (
      SELECT address, array_agg(DISTINCT profile_id ORDER BY profile_id) AS profile_ids, COUNT(DISTINCT profile_id) AS n
      FROM wallet_sources
      WHERE address ~ '^0x[a-f0-9]{40}$'
      GROUP BY address
    )
    SELECT address, profile_ids, n::int AS n
    FROM grouped
    WHERE n > 1
    ORDER BY n DESC, address;
  `

  console.log(`\n── Shared-wallet clusters (live profiles only): ${rows.rows.length} ──`)
  if (rows.rows.length === 0) {
    console.log('  (none) — no other split identities detected')
    return
  }

  for (const row of rows.rows) {
    const profileIds = Array.isArray(row.profile_ids) ? row.profile_ids : []
    console.log(`\nwallet ${row.address}   shared by ${row.n} profiles: [${profileIds.join(', ')}]`)
    // Pull profile details for context.
    const details = await db.sql`
      SELECT id, email, privy_user_id, primary_wallet, embedded_wallet, csw_address,
             referral_code, created_at
      FROM profiles
      WHERE id = ANY(${profileIds}::bigint[])
      ORDER BY id ASC;
    `
    for (const p of details.rows) {
      console.log(
        `  #${String(p.id).padEnd(5)} email=${p.email ?? '(none)'.padEnd(24)}  ` +
          `privy=${p.privy_user_id ? String(p.privy_user_id).slice(0, 28) + '…' : '(none)'}  ` +
          `code=${p.referral_code ?? '-'}`,
      )
    }
  }

  // Also check profile_wallets cross-contamination if the table exists.
  try {
    const pwRows = await db.sql`
      WITH pw AS (
        SELECT DISTINCT profile_id, LOWER(address) AS address
        FROM profile_wallets
        WHERE address ~ '^0x[a-f0-9]{40}$'
      ),
      grouped AS (
        SELECT address, array_agg(DISTINCT profile_id ORDER BY profile_id) AS profile_ids, COUNT(DISTINCT profile_id) AS n
        FROM pw
        GROUP BY address
      )
      SELECT address, profile_ids, n::int AS n
      FROM grouped
      WHERE n > 1
      ORDER BY n DESC, address;
    `
    console.log(`\n── profile_wallets cross-contamination: ${pwRows.rows.length} ──`)
    if (pwRows.rows.length === 0) console.log('  (none)')
    else for (const r of pwRows.rows) console.log(`  ${r.address}  profiles=[${r.profile_ids.join(', ')}]`)
  } catch {
    console.log('\n── profile_wallets: (table not present)')
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
