#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { getDb } from '../server/_lib/db/postgres.ts'

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

const scriptDir = resolve(fileURLToPath(import.meta.url), '..')
loadEnvFile(resolve(scriptDir, '../.env.local'))
loadEnvFile(resolve(scriptDir, '../../.env.local'))
loadEnvFile(resolve(scriptDir, '../.env'))

async function main(): Promise<void> {
  const emailArg = process.argv.find((a) => a.startsWith('--email='))?.slice('--email='.length)?.trim()
  const email = emailArg || '4626dotfun@gmail.com'
  const db = await getDb()
  if (!db) {
    console.error('DATABASE_URL unavailable')
    process.exit(1)
  }

  const profiles = await db.sql`
    SELECT id, email, privy_user_id, csw_address, primary_embedded_eoa, merged_into_profile_id, created_at
    FROM profiles
    WHERE lower(email) = lower(${email})
    ORDER BY id
  `

  const accounts = await db.sql`
    SELECT privy_user_id, email, email_verified FROM accounts WHERE lower(email) = lower(${email})
  `

  const aliases = await db.sql`
    SELECT a.privy_user_id, a.profile_id, a.source, a.created_at, p.email, p.merged_into_profile_id
    FROM privy_user_aliases a
    LEFT JOIN profiles p ON p.id = a.profile_id
    WHERE a.profile_id IN (SELECT id FROM profiles WHERE lower(email) = lower(${email}))
       OR lower(p.email) = lower(${email})
    ORDER BY a.created_at
  `

  const walletRows = await db.sql`
    SELECT pw.profile_id, pw.address, pw.is_primary, pw.is_canonical_smart_wallet, pw.is_embedded_eoa
    FROM profile_wallets pw
    JOIN profiles p ON p.id = pw.profile_id
    WHERE lower(p.email) = lower(${email}) AND p.merged_into_profile_id IS NULL
    ORDER BY pw.profile_id, pw.address
  `

  const eoa = profiles.rows[0]?.primary_embedded_eoa ?? null
  const csw = profiles.rows[0]?.csw_address ?? null
  const addresses = [eoa, csw].filter((v): v is string => typeof v === 'string' && v.length > 0)
  const walletCollisions =
    addresses.length > 0
      ? await db.sql`
          SELECT DISTINCT p.id, p.email, p.privy_user_id, p.merged_into_profile_id, pw.address
          FROM profiles p
          JOIN profile_wallets pw ON pw.profile_id = p.id
          WHERE lower(pw.address) = ANY(${addresses.map((a) => a.toLowerCase())})
          ORDER BY p.id
        `
      : { rows: [] }

  const orphanPrivyProfiles =
    addresses.length > 0
      ? await db.sql`
          SELECT p.id, p.email, p.privy_user_id, p.merged_into_profile_id, p.created_at
          FROM profiles p
          WHERE p.privy_user_id IS NOT NULL
            AND p.merged_into_profile_id IS NULL
            AND p.id <> ${profiles.rows[0]?.id ?? 0}
            AND (
              lower(p.email) = lower(${email})
              OR EXISTS (
                SELECT 1 FROM profile_wallets pw
                WHERE pw.profile_id = p.id
                  AND lower(pw.address) = ANY(${addresses.map((a) => a.toLowerCase())})
              )
            )
          ORDER BY p.created_at DESC
        `
      : { rows: [] }

  console.log(
    JSON.stringify(
      {
        email,
        profiles: profiles.rows,
        accounts: accounts.rows,
        aliases: aliases.rows,
        profileWallets: walletRows.rows,
        walletCollisions: walletCollisions.rows,
        orphanPrivyProfiles: orphanPrivyProfiles.rows,
      },
      null,
      2,
    ),
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
