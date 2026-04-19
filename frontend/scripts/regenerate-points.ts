#!/usr/bin/env tsx
/**
 * One-shot points regeneration driver.
 *
 * Invokes the same `pointsBackfill` module the admin HTTP endpoint uses, but
 * from the shell so an operator with `DATABASE_URL` access can execute
 * without forging an authenticated admin session. Safety rails:
 *
 *   - Always runs a dry-run first, regardless of flags.
 *   - Execute requires BOTH `--execute` and `--confirm=REGENERATE-POINTS`.
 *   - Target database host is printed so the operator can sanity-check
 *     they're not pointing at the wrong environment.
 *   - An audit row is recorded via the same `logAdminAction` helper the
 *     HTTP endpoint uses, attributed to a configured admin address.
 *
 * Usage:
 *   pnpm -C frontend regen:points                               # dry run
 *   pnpm -C frontend regen:points -- --execute --confirm=REGENERATE-POINTS
 *
 * Env requirements:
 *   - DATABASE_URL (or POSTGRES_URL / POSTGRES_URL_NON_POOLING)
 *   - ADMIN_AUDIT_ADDRESS (optional; defaults to first entry of
 *     CREATOR_ACCESS_ADMIN_ADDRESSES)
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { logAdminAction } from '../server/_lib/admin/adminAudit.js'
import { ensureWaitlistSchema } from '../server/_lib/onboarding/waitlistSchema.js'
import {
  executePointsBackfill,
  planPointsBackfill,
} from '../server/_lib/onboarding/pointsBackfill.js'

// ─── .env.local loader ──────────────────────────────────────────────────
// Minimal loader so we don't add a runtime dep. Looks for `.env.local` at
// the repo root and at the frontend/ dir; earlier wins.
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
    // Strip surrounding quotes if present.
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

// ─── Arg parsing ───────────────────────────────────────────────────────
const args = process.argv.slice(2)
const wantsExecute = args.includes('--execute')
const confirmArg = args.find((a) => a.startsWith('--confirm='))?.split('=')[1] ?? ''
const limitArg = args.find((a) => a.startsWith('--limit='))?.split('=')[1]
const limit = limitArg && /^\d+$/.test(limitArg) ? Number(limitArg) : undefined
const EXECUTE_CONFIRMATION = 'REGENERATE-POINTS'

function die(msg: string, code = 1): never {
  console.error(`\n✗ ${msg}\n`)
  process.exit(code)
}

function humanHost(url: string | undefined): string {
  try {
    if (!url) return '<unset>'
    const u = new URL(url)
    return `${u.hostname}${u.pathname}`
  } catch {
    return '<unparseable>'
  }
}

async function main(): Promise<void> {
  const dbUrl =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    ''
  if (!dbUrl) die('No DATABASE_URL / POSTGRES_URL configured.')

  // Resolve audit attribution (never anonymous — the admin_logs row needs
  // a real admin address).
  const adminAudit =
    process.env.ADMIN_AUDIT_ADDRESS ||
    (process.env.CREATOR_ACCESS_ADMIN_ADDRESSES ?? '').split(',')[0]?.trim() ||
    ''
  if (!adminAudit || !/^0x[a-fA-F0-9]{40}$/.test(adminAudit)) {
    die('Could not resolve an admin EOA for audit attribution. Set ADMIN_AUDIT_ADDRESS.')
  }

  // Import getDb lazily so env loading above takes effect before the module
  // reads its connection string.
  const { getDb, getDbInitError } = await import('../server/_lib/db/postgres.js')
  const db = await getDb()
  if (!db) die(`Database connection failed: ${getDbInitError() ?? 'unknown'}`)

  console.log('┌─────────────────────────────────────────────────────────┐')
  console.log('│  Points regeneration                                    │')
  console.log('├─────────────────────────────────────────────────────────┤')
  console.log(`│  target   : ${humanHost(dbUrl).padEnd(41)}│`)
  console.log(`│  auditAs  : ${adminAudit.padEnd(41)}│`)
  console.log(`│  mode     : ${(wantsExecute ? 'EXECUTE (append-only)' : 'dry_run').padEnd(41)}│`)
  if (limit) console.log(`│  limit    : ${String(limit).padEnd(41)}│`)
  console.log('└─────────────────────────────────────────────────────────┘')

  await ensureWaitlistSchema(db)

  console.log('\n[1/2] Planning…')
  const plan = await planPointsBackfill(db, { limit })
  const totalTopupDelta = plan.topups.reduce((sum, t) => sum + t.delta, 0)

  console.log(`\nTop-up candidates: ${plan.topups.length}`)
  console.log(`Total delta      : +${totalTopupDelta} points`)
  console.log('By source:')
  const sources = Object.entries(plan.topupsBySource).sort(
    ([, a], [, b]) => b.totalDelta - a.totalDelta,
  )
  if (sources.length === 0) {
    console.log('  (none)')
  } else {
    for (const [src, info] of sources) {
      console.log(`  ${src.padEnd(22)} count=${String(info.count).padEnd(5)} total=+${info.totalDelta}`)
    }
  }

  console.log(`\nPassthrough candidates: ${plan.passthroughs.length}`)
  const sampleBySource = new Map<string, number>()
  for (const p of plan.passthroughs) {
    sampleBySource.set(p.source, (sampleBySource.get(p.source) ?? 0) + 1)
  }
  if (sampleBySource.size === 0) {
    console.log('  (none)')
  } else {
    for (const [src, n] of [...sampleBySource.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${src.padEnd(22)} count=${n}`)
    }
  }

  console.log(`\nMissing baseline (waitlist_signup) candidates: ${plan.missingBaselines.length}`)
  if (plan.missingBaselines.length > 0) {
    console.log(
      `  → will mint +${/* WAITLIST_POINTS.signup */ 5} per profile via awardWaitlistPoints`,
    )
  }

  console.log(`\nMissing link_email candidates (privy-verified): ${plan.missingLinkEmails.length}`)
  if (plan.missingLinkEmails.length > 0) {
    console.log(
      `  → will mint +10 per profile via applyPointEvent (same path as live writer)`,
    )
  }

  if (plan.unknownSourcesObserved.length > 0) {
    console.log('\n⚠ Unknown sources present in `points` (neither in canonical map nor excluded):')
    for (const s of plan.unknownSourcesObserved) console.log(`  - ${s}`)
    console.log('  Review these. They are left untouched by this run.')
  }

  // Dry-run audit row
  await logAdminAction({
    db,
    adminAddress: adminAudit,
    action: 'waitlist_regenerate_points_dry_run',
    targetType: 'profile',
    targetId: 'all',
    details: {
      topupCandidates: plan.topups.length,
      passthroughCandidates: plan.passthroughs.length,
      missingBaselines: plan.missingBaselines.length,
      missingLinkEmails: plan.missingLinkEmails.length,
      totalTopupDelta,
      unknownSourcesObserved: plan.unknownSourcesObserved,
      driver: 'scripts/regenerate-points.ts',
    },
  })

  if (!wantsExecute) {
    console.log('\n[2/2] Dry-run complete. No rows written.')
    console.log('\nTo execute:')
    console.log('  pnpm -C frontend regen:points -- --execute --confirm=REGENERATE-POINTS')
    return
  }

  if (confirmArg !== EXECUTE_CONFIRMATION) {
    die(`--execute requires --confirm=${EXECUTE_CONFIRMATION}`)
  }

  if (
    plan.topups.length === 0 &&
    plan.passthroughs.length === 0 &&
    plan.missingBaselines.length === 0 &&
    plan.missingLinkEmails.length === 0
  ) {
    console.log('\nNothing to write — ledger is already current. Exiting.')
    return
  }

  console.log('\n[2/2] Executing (append-only, idempotent)…')
  const result = await executePointsBackfill(db, plan)

  console.log('\n┌─ Result ────────────────────────────────────────────────┐')
  console.log(`│  baselines inserted       : ${String(result.baselinesInserted).padEnd(25)}│`)
  console.log(`│  link_emails inserted     : ${String(result.linkEmailsInserted).padEnd(25)}│`)
  console.log(`│  top-ups inserted         : ${String(result.topupsInserted).padEnd(25)}│`)
  console.log(`│  passthroughs inserted    : ${String(result.passthroughsInserted).padEnd(25)}│`)
  console.log(`│  passthroughs skipped*    : ${String(result.passthroughsSkipped).padEnd(25)}│`)
  console.log('└─────────────────────────────────────────────────────────┘')
  console.log(
    '  * skipped = no-op: no referrer, self-ref, exempt source, or already exists',
  )

  await logAdminAction({
    db,
    adminAddress: adminAudit,
    action: 'waitlist_regenerate_points_execute',
    targetType: 'profile',
    targetId: 'all',
    details: {
      topupsInserted: result.topupsInserted,
      passthroughsInserted: result.passthroughsInserted,
      passthroughsSkipped: result.passthroughsSkipped,
      baselinesInserted: result.baselinesInserted,
      linkEmailsInserted: result.linkEmailsInserted,
      totalTopupDelta,
      driver: 'scripts/regenerate-points.ts',
    },
  })

  console.log('\nDone. Audit rows written to admin_logs.')
}

main().catch((err) => {
  console.error('\n✗ Failed:', err instanceof Error ? err.stack ?? err.message : err)
  process.exit(1)
})
