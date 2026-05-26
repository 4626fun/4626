#!/usr/bin/env tsx
/**
 * Operator comp: free/discounted creator strategy features.
 *
 * Two modes (both can run together):
 *   1. Price override rows ($0) — user can self-activate via USDC/x402/Stripe at $0
 *   2. Direct pending activation rows — unlocks deploy immediately (no payment UX)
 *
 * Usage:
 *   pnpm -C frontend exec tsx scripts/grant-creator-strategy-comp.ts \
 *     --creator=0x5b674196812451b7cec024fe9d22d2c0b172fa75 \
 *     --all-deploy-gating --execute --confirm=GRANT-STRATEGY-COMP
 */

import { createHash, randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { getAddress, isAddress, type Address, type Hex } from 'viem'

import {
  DEPLOY_GATING_FEATURE_KEYS,
  getCreatorStrategyFeature,
  type CreatorStrategyFeatureKey,
} from '../server/_lib/creatorStrategy/catalog.js'
import { insertPendingActivation } from '../server/_lib/creatorStrategy/activations.js'
import { resolveProtocolTreasuryForUsdcPayments } from '../server/_lib/creatorStrategy/usdcPayment.js'

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

const EXECUTE_CONFIRMATION = 'GRANT-STRATEGY-COMP'
const DEFAULT_AKITA_CREATOR = '0x5b674196812451b7cec024fe9d22d2c0b172fa75' as const

const args = process.argv.slice(2)

function die(msg: string): never {
  console.error(`✗ ${msg}`)
  process.exit(1)
}

function argValue(prefix: string): string | undefined {
  return args.find((a) => a.startsWith(`${prefix}=`))?.slice(prefix.length + 1)
}

function hasFlag(flag: string): boolean {
  return args.includes(flag)
}

function parseFeatureKeys(): CreatorStrategyFeatureKey[] {
  if (hasFlag('--all-deploy-gating')) {
    return Object.values(DEPLOY_GATING_FEATURE_KEYS)
  }
  const raw = argValue('--features')
  if (!raw) return ['solana_ovault_mesh']
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean) as CreatorStrategyFeatureKey[]
}

function syntheticCompTxHash(creatorToken: Address, featureKey: string): Hex {
  const digest = createHash('sha256')
    .update(`operator_comp:${creatorToken}:${featureKey}:${randomBytes(8).toString('hex')}`)
    .digest('hex')
  return `0x${digest}` as Hex
}

async function revokeLiveOverride(
  db: { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> },
  creatorToken: Address,
  featureKey: string,
): Promise<void> {
  await db.sql`
    UPDATE creator_strategy_price_overrides
    SET revoked_at = NOW(), updated_at = NOW()
    WHERE creator_token = ${creatorToken.toLowerCase()}
      AND feature_key = ${featureKey}
      AND revoked_at IS NULL
  `
}

async function grantPriceOverride(
  db: { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> },
  params: {
    creatorToken: Address
    featureKey: string
    priceUsdcOverride: bigint
    reason: string
    grantedBy: Address
  },
): Promise<void> {
  await revokeLiveOverride(db, params.creatorToken, params.featureKey)
  await db.sql`
    INSERT INTO creator_strategy_price_overrides (
      creator_token, feature_key, price_usdc_override, reason, granted_by
    ) VALUES (
      ${params.creatorToken.toLowerCase()},
      ${params.featureKey},
      ${params.priceUsdcOverride.toString()},
      ${params.reason},
      ${params.grantedBy.toLowerCase()}
    )
  `
}

async function main(): Promise<void> {
  const creatorRaw = argValue('--creator') ?? DEFAULT_AKITA_CREATOR
  if (!isAddress(creatorRaw)) die(`Invalid --creator: ${creatorRaw}`)
  const creatorToken = getAddress(creatorRaw)

  const featureKeys = parseFeatureKeys()
  for (const key of featureKeys) {
    try {
      getCreatorStrategyFeature(key)
    } catch {
      die(`Unknown feature key: ${key}`)
    }
  }

  const wantsExecute = hasFlag('--execute')
  const confirm = argValue('--confirm') ?? ''
  const skipOverrides = hasFlag('--skip-overrides')
  const skipActivations = hasFlag('--skip-activations')
  const reason = argValue('--reason') ?? 'operator_comp_akita_may_2026'

  const grantedByRaw =
    process.env.ADMIN_AUDIT_ADDRESS ||
    (process.env.CREATOR_ACCESS_ADMIN_ADDRESSES ?? '').split(',')[0]?.trim() ||
    '0xB05Cf01231cF2fF99499682E64D3780d57c80FdD'
  if (!isAddress(grantedByRaw)) die('Set ADMIN_AUDIT_ADDRESS or a valid --granted-by')
  const grantedBy = getAddress(grantedByRaw)

  if (wantsExecute && confirm !== EXECUTE_CONFIRMATION) {
    die(`Pass --confirm=${EXECUTE_CONFIRMATION} with --execute`)
  }

  const { getDb, getDbInitError } = await import('../server/_lib/db/postgres.js')
  const db = await getDb()
  if (!db) die(`db connect failed: ${getDbInitError() ?? 'unknown'}`)

  const treasury = resolveProtocolTreasuryForUsdcPayments()

  console.log('Creator strategy comp')
  console.log(`  creator : ${creatorToken}`)
  console.log(`  features: ${featureKeys.join(', ')}`)
  console.log(`  mode    : ${wantsExecute ? 'EXECUTE' : 'dry_run'}`)
  console.log(`  treasury: ${treasury}`)
  console.log(`  granted : ${grantedBy}`)
  console.log('')

  for (const featureKey of featureKeys) {
    const feature = getCreatorStrategyFeature(featureKey)
    console.log(`── ${featureKey} (${feature.displayName}) ──`)

    if (!skipOverrides) {
      console.log('  price override: $0 USDC')
      if (wantsExecute) {
        await grantPriceOverride(db as any, {
          creatorToken,
          featureKey,
          priceUsdcOverride: 0n,
          reason,
          grantedBy,
        })
        console.log('  ✓ override inserted')
      }
    }

    if (!skipActivations) {
      console.log('  activation: pending row (operator comp, unlocks deploy)')
      if (wantsExecute) {
        const txHash = syntheticCompTxHash(creatorToken, featureKey)
        const result = await insertPendingActivation(db as any, {
          creatorToken,
          featureKey,
          priceUsdcPaid: 0n,
          paymentTxHash: txHash,
          paymentFrom: grantedBy,
          paymentTo: treasury,
          paymentVerifiedAt: new Date(),
          status: 'pending',
          metadata: {
            paymentSource: 'operator_comp',
            catalogPriceUsdc: feature.priceUsdc.toString(),
            effectivePriceUsdc: '0',
            grantedBy,
            reason,
          },
        })
        if (!result.ok) {
          if (result.reason === 'live_activation_exists') {
            console.log(`  · skipped activation (${result.message})`)
          } else {
            die(`${featureKey}: activation failed — ${result.message}`)
          }
        } else {
          console.log(`  ✓ activation id=${result.row.id} status=${result.row.status}`)
        }
      }
    }

    console.log('')
  }

  if (!wantsExecute) {
    console.log(`Dry run only. Re-run with --execute --confirm=${EXECUTE_CONFIRMATION}`)
  } else {
    console.log('Done. Refresh:')
    console.log(
      `  https://app.4626.fun/creator/strategy/features?creator=${creatorToken}`,
    )
  }
}

main().catch((err) => {
  die(err instanceof Error ? err.message : String(err))
})
