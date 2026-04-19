#!/usr/bin/env tsx
/**
 * Profile-merge operator script. Folds one profiles row (`--from`) into
 * another (`--to`), going through the same logic the admin HTTP endpoint
 * uses. Dry-run by default.
 *
 * Usage:
 *   tsx scripts/merge-profiles.ts --from=728 --to=1                    # dry run
 *   tsx scripts/merge-profiles.ts --from=728 --to=1 \
 *       --execute --confirm=MERGE-PROFILES
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { logAdminAction } from '../server/_lib/admin/adminAudit.js'
import {
  executeProfileMerge,
  planProfileMerge,
  ProfileMergeValidationError,
} from '../server/_lib/identity/profileMerge.js'

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
const fromArg = args.find((a) => a.startsWith('--from='))?.slice('--from='.length)
const toArg = args.find((a) => a.startsWith('--to='))?.slice('--to='.length)
const wantsExecute = args.includes('--execute')
const confirmArg = args.find((a) => a.startsWith('--confirm='))?.slice('--confirm='.length) ?? ''
const EXECUTE_CONFIRMATION = 'MERGE-PROFILES'

function die(msg: string): never {
  console.error(`✗ ${msg}`)
  process.exit(1)
}

function toInt(v: string | undefined): number | null {
  if (!v) return null
  const n = Number(v)
  return Number.isInteger(n) && n > 0 ? n : null
}

async function main(): Promise<void> {
  const from = toInt(fromArg)
  const to = toInt(toArg)
  if (from === null || to === null) die('Provide --from=<id> and --to=<id>')

  const adminAudit =
    process.env.ADMIN_AUDIT_ADDRESS ||
    (process.env.CREATOR_ACCESS_ADMIN_ADDRESSES ?? '').split(',')[0]?.trim() ||
    ''
  if (!/^0x[a-fA-F0-9]{40}$/.test(adminAudit)) {
    die('Set ADMIN_AUDIT_ADDRESS or CREATOR_ACCESS_ADMIN_ADDRESSES')
  }

  const { getDb, getDbInitError } = await import('../server/_lib/db/postgres.js')
  const db = await getDb()
  if (!db) die(`db connect failed: ${getDbInitError() ?? 'unknown'}`)

  console.log('┌─────────────────────────────────────────────────────────┐')
  console.log(`│  Profile merge: ${String(from).padStart(4)} → ${String(to).padStart(4)}`.padEnd(58) + '│')
  console.log(`│  mode   : ${(wantsExecute ? 'EXECUTE' : 'dry_run').padEnd(45)}│`)
  console.log(`│  auditAs: ${adminAudit.padEnd(45)}│`)
  console.log('└─────────────────────────────────────────────────────────┘\n')

  try {
    const plan = await planProfileMerge(db as any, from, to)
    console.log('── From profile ──')
    console.log(JSON.stringify(plan.from, null, 2))
    console.log('\n── To profile (canonical) ──')
    console.log(JSON.stringify(plan.to, null, 2))
    console.log('\n── Plan ──')
    console.log(`points rows to move                : ${plan.pointsRowsToMove}`)
    console.log(`points rows to drop as duplicate   : ${plan.pointsRowsSkippedAsDuplicate}`)
    console.log(`referral_conversions to repoint    : ${plan.referralConversionsToRepoint}`)
    console.log(`referees to repoint                : ${plan.refereesToRepoint}`)

    await logAdminAction({
      db: db as any,
      adminAddress: adminAudit,
      action: 'profile_merge_dry_run',
      targetType: 'profile',
      targetId: `${from}->${to}`,
      details: {
        pointsRowsToMove: plan.pointsRowsToMove,
        pointsRowsSkippedAsDuplicate: plan.pointsRowsSkippedAsDuplicate,
        referralConversionsToRepoint: plan.referralConversionsToRepoint,
        refereesToRepoint: plan.refereesToRepoint,
        driver: 'scripts/merge-profiles.ts',
      },
    })

    if (!wantsExecute) {
      console.log('\nDry-run complete. To execute:')
      console.log(`  tsx scripts/merge-profiles.ts --from=${from} --to=${to} --execute --confirm=${EXECUTE_CONFIRMATION}`)
      return
    }

    if (confirmArg !== EXECUTE_CONFIRMATION) {
      die(`--execute requires --confirm=${EXECUTE_CONFIRMATION}`)
    }

    console.log('\nExecuting…')
    const result = await executeProfileMerge(db as any, plan)
    console.log('\n── Result ──')
    console.log(JSON.stringify(result, null, 2))

    await logAdminAction({
      db: db as any,
      adminAddress: adminAudit,
      action: 'profile_merge_execute',
      targetType: 'profile',
      targetId: `${from}->${to}`,
      details: { ...result, driver: 'scripts/merge-profiles.ts' },
    })
    console.log('\nDone. Audit rows written to admin_logs.')
  } catch (err) {
    if (err instanceof ProfileMergeValidationError) {
      die(err.message)
    }
    throw err
  }
}

main().catch((err) => {
  console.error('✗', err instanceof Error ? err.stack ?? err.message : err)
  process.exit(1)
})
