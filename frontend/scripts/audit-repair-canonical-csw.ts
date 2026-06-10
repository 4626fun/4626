#!/usr/bin/env tsx
/**
 * Audit and repair CSW mixups across all live profiles.
 *
 * Detects EOAs (including Zora Privy wallets like 0x6c0ea…) incorrectly stored
 * as `profiles.csw_address`, mismatched smart-wallet columns, and bad
 * `profile_wallets.is_canonical_smart_wallet` flags.
 *
 * Usage:
 *   pnpm -C frontend exec tsx scripts/audit-repair-canonical-csw.ts
 *   pnpm -C frontend exec tsx scripts/audit-repair-canonical-csw.ts --apply
 *   pnpm -C frontend exec tsx scripts/audit-repair-canonical-csw.ts --limit=50 --apply
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { repairAllProfileCswMixups } from '../server/_lib/wallet/auditCanonicalCsw.ts'

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
  const limitRaw = getArg('--limit')
  const limit = limitRaw ? Number(limitRaw) : undefined
  const rpcUrl = (process.env.BASE_RPC_URL || 'https://mainnet.base.org').trim()

  const { getDb } = await import('../server/_lib/db/postgres.ts')
  const db = await getDb()
  if (!db) throw new Error('Database unavailable')

  const { audits, repairs } = await repairAllProfileCswMixups({
    db: db as any,
    rpcUrl,
    apply,
    limit: Number.isInteger(limit) && limit! > 0 ? limit : undefined,
  })

  console.log(
    JSON.stringify(
      {
        mode: apply ? 'apply' : 'dry-run',
        rpcUrl,
        mixupsFound: audits.length,
        audits,
        repairs,
      },
      null,
      2,
    ),
  )

  if (!apply && audits.length > 0) {
    console.log('\nRe-run with --apply to repair all rows above.')
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
