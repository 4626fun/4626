#!/usr/bin/env tsx
/**
 * Read-only diagnostic for the waitlist points ledger. Answers:
 *
 *   1. What does the `points` table actually look like right now?
 *      (count + unique signups per source; amount distribution)
 *   2. Which profile states aren't reflected in `points` rows?
 *      E.g., "user has verified email but no `link_email` row."
 *   3. Is the low top-up count because values are already current, or
 *      because the award-write paths never fired in the first place?
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

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
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (key && !process.env[key]) process.env[key] = value
  }
}

const scriptDir = fileURLToPath(new URL('.', import.meta.url))
loadEnvFile(resolve(scriptDir, '../.env.local'))
loadEnvFile(resolve(scriptDir, '../../.env.local'))
loadEnvFile(resolve(scriptDir, '../.env'))

async function main(): Promise<void> {
  const { getDb, getDbInitError } = await import('../server/_lib/db/postgres.js')
  const db = await getDb()
  if (!db) {
    console.error('✗ db connect failed:', getDbInitError())
    process.exit(1)
  }

  // 1. Total rows + distinct signups
  const totals = await db.sql`
    SELECT
      COUNT(*)::int AS total_rows,
      COUNT(DISTINCT signup_id)::int AS distinct_signups,
      COALESCE(SUM(amount), 0)::int AS total_amount
    FROM points;
  `
  console.log('\n── Ledger totals ─────────────────────────────────────────')
  console.log(totals.rows[0])

  // 2. Per-source breakdown with amount histogram
  const perSource = await db.sql`
    SELECT
      source,
      COUNT(*)::int AS rows,
      COUNT(DISTINCT signup_id)::int AS distinct_signups,
      MIN(amount)::int AS min_amount,
      MAX(amount)::int AS max_amount,
      ROUND(AVG(amount)::numeric, 2)::text AS avg_amount,
      COALESCE(SUM(amount), 0)::int AS sum_amount
    FROM points
    GROUP BY source
    ORDER BY sum_amount DESC;
  `
  console.log('\n── Per-source breakdown ──────────────────────────────────')
  console.table(perSource.rows)

  // 3. Profile totals vs participation
  const profileStats = await db.sql`
    SELECT
      (SELECT COUNT(*)::int FROM profiles) AS total_profiles,
      (SELECT COUNT(DISTINCT signup_id)::int FROM points) AS profiles_with_points,
      (SELECT COUNT(*)::int FROM profiles WHERE email IS NOT NULL AND email <> '') AS profiles_with_email,
      (SELECT COUNT(*)::int FROM profiles WHERE privy_user_id IS NOT NULL) AS profiles_with_privy,
      (SELECT COUNT(*)::int FROM profiles WHERE referred_by_signup_id IS NOT NULL) AS profiles_with_referrer;
  `
  console.log('\n── Profile coverage ──────────────────────────────────────')
  console.log(profileStats.rows[0])

  // 4. Profiles with verified email but NO link_email award row
  const missingLinkEmail = await db.sql`
    SELECT COUNT(*)::int AS count
    FROM profiles p
    WHERE p.email IS NOT NULL
      AND p.email <> ''
      AND NOT EXISTS (
        SELECT 1 FROM points pt
        WHERE pt.signup_id = p.id AND pt.source = 'link_email'
      );
  `
  // Same question for waitlist_signup
  const missingWaitlistSignup = await db.sql`
    SELECT COUNT(*)::int AS count
    FROM profiles p
    WHERE NOT EXISTS (
      SELECT 1 FROM points pt
      WHERE pt.signup_id = p.id AND pt.source = 'waitlist_signup'
    );
  `
  console.log('\n── Missing-award diagnostics ─────────────────────────────')
  console.log(`profiles with email but no link_email row     : ${missingLinkEmail.rows[0].count}`)
  console.log(`profiles with no waitlist_signup row          : ${missingWaitlistSignup.rows[0].count}`)

  // 5. Sample of 10 profiles and what points they have
  const sample = await db.sql`
    SELECT
      p.id,
      p.email,
      p.referral_code,
      p.referred_by_signup_id AS referrer,
      (
        SELECT COALESCE(json_agg(json_build_object('source', pt.source, 'amount', pt.amount)), '[]'::json)
        FROM points pt WHERE pt.signup_id = p.id
      ) AS points
    FROM profiles p
    ORDER BY p.id DESC
    LIMIT 10;
  `
  console.log('\n── Sample: 10 most recent profiles ──────────────────────')
  for (const row of sample.rows) {
    const pts = (row.points ?? []) as Array<{ source: string; amount: number }>
    const summary = pts.length
      ? pts.map((p) => `${p.source}(+${p.amount})`).join(', ')
      : '(none)'
    console.log(
      `#${row.id}  email=${row.email ? 'yes' : 'no'}  ref=${row.referral_code ?? '-'}  ref_by=${
        row.referrer ?? '-'
      }\n  points: ${summary}`,
    )
  }
}

main().catch((err) => {
  console.error('\n✗ Failed:', err instanceof Error ? err.stack ?? err.message : err)
  process.exit(1)
})
