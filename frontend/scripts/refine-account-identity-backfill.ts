#!/usr/bin/env tsx
/**
 * One-shot backfill: sync wallets + Zora signals for every Privy user in the DB.
 *
 * Usage:
 *   pnpm -C frontend exec tsx scripts/refine-account-identity-backfill.ts
 *   pnpm -C frontend exec tsx scripts/refine-account-identity-backfill.ts --apply
 *   pnpm -C frontend exec tsx scripts/refine-account-identity-backfill.ts --only-missing-csw --force-zora --apply
 *   pnpm -C frontend exec tsx scripts/refine-account-identity-backfill.ts --clear-ghost-privy --apply
 *
 * Requires: DATABASE_URL (or Supabase postgres env), PRIVY_APP_ID, PRIVY_APP_SECRET.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { PrivyClient } from '@privy-io/server-auth'

import {
  refineAccountIdentityFromPrivy,
  upsertAccount,
} from '../server/_lib/identity/accountsIdentity.js'
import { extractPrivyVerifiedEmail } from '../server/_lib/infra/trust.js'

declare const process: {
  env: Record<string, string | undefined>
  argv: string[]
  exit: (code?: number) => never
}

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

function getPrivyServerAuth(): { appId: string; appSecret: string } {
  const appId = String(process.env.PRIVY_APP_ID ?? '').trim()
  const appSecret = String(process.env.PRIVY_APP_SECRET ?? '').trim()
  if (!appId || !appSecret) {
    throw new Error('Privy server auth is not configured (missing PRIVY_APP_ID / PRIVY_APP_SECRET).')
  }
  return { appId, appSecret }
}

function isPrivyUserNotFound(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '')
  return message.toLowerCase().includes('user not found')
}

type PrivyUserRow = {
  privy_user_id: string
  email: string | null
  email_verified: boolean
  source: 'accounts' | 'profiles_orphan'
}

async function listPrivyUsers(
  db: { sql: (...args: any[]) => Promise<{ rows: any[] }> },
  options: { onlyMissingCsw: boolean },
): Promise<PrivyUserRow[]> {
  const onlyMissingCsw = options.onlyMissingCsw
  const result = await db.sql`
    WITH account_users AS (
      SELECT
        a.privy_user_id,
        a.email,
        a.email_verified,
        'accounts'::text AS source
      FROM accounts a
      WHERE a.privy_user_id IS NOT NULL
        AND btrim(a.privy_user_id) <> ''
        AND (
          ${onlyMissingCsw} = false
          OR EXISTS (
            SELECT 1
            FROM profiles p
            WHERE p.privy_user_id = a.privy_user_id
              AND (p.csw_address IS NULL OR btrim(p.csw_address) = '')
          )
        )
    ),
    orphan_profiles AS (
      SELECT
        p.privy_user_id,
        p.email,
        false AS email_verified,
        'profiles_orphan'::text AS source
      FROM profiles p
      WHERE p.privy_user_id IS NOT NULL
        AND btrim(p.privy_user_id) <> ''
        AND NOT EXISTS (
          SELECT 1 FROM accounts a WHERE a.privy_user_id = p.privy_user_id
        )
        AND (
          ${onlyMissingCsw} = false
          OR (p.csw_address IS NULL OR btrim(p.csw_address) = '')
        )
    )
    SELECT privy_user_id, email, email_verified, source
    FROM account_users
    UNION ALL
    SELECT privy_user_id, email, email_verified, source
    FROM orphan_profiles
    ORDER BY privy_user_id;
  `
  return (result.rows ?? []) as PrivyUserRow[]
}

async function readIdentityStats(db: { sql: (...args: any[]) => Promise<{ rows: any[] }> }): Promise<Record<string, number>> {
  const result = await db.sql`
    SELECT
      (SELECT COUNT(*) FROM profiles WHERE privy_user_id IS NOT NULL) AS profiles_with_privy,
      (SELECT COUNT(*) FROM accounts) AS accounts_rows,
      (SELECT COUNT(*) FROM profiles WHERE csw_address IS NOT NULL AND btrim(csw_address) <> '') AS profiles_with_csw,
      (SELECT COUNT(*) FROM account_zora_signals) AS zora_signals_rows,
      (SELECT COUNT(*) FROM account_zora_signals WHERE canonical_csw_address IS NOT NULL AND btrim(canonical_csw_address) <> '') AS zora_signals_with_csw,
      (SELECT COUNT(*) FROM profiles p WHERE p.privy_user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM accounts a WHERE a.privy_user_id = p.privy_user_id)) AS orphan_profiles;
  `
  const row = result.rows?.[0] ?? {}
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, Number(value) || 0]),
  )
}

async function clearGhostPrivyUser(
  db: { sql: (...args: any[]) => Promise<{ rows: any[] }> },
  privyUserId: string,
): Promise<void> {
  await db.sql`
    DELETE FROM accounts
    WHERE privy_user_id = ${privyUserId};
  `
  await db.sql`
    UPDATE profiles
    SET privy_user_id = NULL, updated_at = NOW()
    WHERE privy_user_id = ${privyUserId};
  `
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolveSleep) => setTimeout(resolveSleep, ms))
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply')
  const forceZora = process.argv.includes('--force-zora')
  const onlyMissingCsw = process.argv.includes('--only-missing-csw')
  const clearGhostPrivy = process.argv.includes('--clear-ghost-privy')
  const limitRaw = getArg('--limit')
  const limit = limitRaw ? Number(limitRaw) : undefined
  const delayMs = Math.max(0, Number(getArg('--delay-ms') || '250') || 250)

  const { getDb, isDbConfigured } = await import('../server/_lib/db/postgres.js')
  if (!isDbConfigured()) throw new Error('Database is not configured')
  const db = await getDb()
  if (!db) throw new Error('Database unavailable')

  const statsBefore = await readIdentityStats(db)
  const allUsers = await listPrivyUsers(db, { onlyMissingCsw })
  const selected =
    Number.isInteger(limit) && limit! > 0 ? allUsers.slice(0, limit!) : allUsers

  const auth = getPrivyServerAuth()
  const privy = new PrivyClient(auth.appId, auth.appSecret)

  const summary = {
    mode: apply ? 'apply' : 'dry-run',
    onlyMissingCsw,
    clearGhostPrivy,
    totalCandidates: allUsers.length,
    selected: selected.length,
    orphanProfiles: selected.filter((u) => u.source === 'profiles_orphan').length,
    accountsCreated: 0,
    refined: 0,
    privyFetchFailed: 0,
    ghostPrivyCleared: 0,
    refineFailed: 0,
    forceZora,
    statsBefore,
    statsAfter: statsBefore,
  }

  console.log(JSON.stringify({ phase: 'start', ...summary }, null, 2))

  if (!apply) {
    console.log(
      JSON.stringify(
        {
          phase: 'dry-run-preview',
          sample: selected.slice(0, 10).map((u) => ({
            privyUserId: u.privy_user_id,
            email: u.email,
            source: u.source,
          })),
          hint: 'Re-run with --apply to create orphan accounts rows and call refineAccountIdentityFromPrivy.',
        },
        null,
        2,
      ),
    )
    return
  }

  for (const row of selected) {
    const privyUserId = row.privy_user_id

    if (row.source === 'profiles_orphan') {
      await upsertAccount({
        db,
        privyUserId,
        email: row.email,
        emailVerified: row.email_verified === true,
      })
      summary.accountsCreated += 1
    }

    let privyUser: unknown
    try {
      privyUser = await privy.getUserById(privyUserId)
    } catch (error) {
      summary.privyFetchFailed += 1
      if (clearGhostPrivy && isPrivyUserNotFound(error)) {
        await clearGhostPrivyUser(db, privyUserId)
        summary.ghostPrivyCleared += 1
      }
      console.warn(
        JSON.stringify({
          privyUserId,
          stage: 'privy_fetch',
          cleared: clearGhostPrivy && isPrivyUserNotFound(error),
          message: error instanceof Error ? error.message : String(error),
        }),
      )
      continue
    }

    const verifiedEmail = extractPrivyVerifiedEmail(privyUser)
    if (verifiedEmail) {
      await upsertAccount({
        db,
        privyUserId,
        email: verifiedEmail,
        emailVerified: true,
      })
    }

    try {
      await refineAccountIdentityFromPrivy({
        db,
        privyUserId,
        privyUser: privyUser as any,
        forceZoraRefresh: forceZora,
      })
      summary.refined += 1
    } catch (error) {
      summary.refineFailed += 1
      console.warn(
        JSON.stringify({
          privyUserId,
          stage: 'refine',
          message: error instanceof Error ? error.message : String(error),
        }),
      )
    }

    if (delayMs > 0) await sleep(delayMs)
  }

  summary.statsAfter = await readIdentityStats(db)
  console.log(JSON.stringify({ phase: 'complete', ...summary }, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
