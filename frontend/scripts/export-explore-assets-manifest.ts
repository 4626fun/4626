#!/usr/bin/env tsx
/**
 * Export top indexed creator coins into public/data/explore-assets-manifest.json.
 *
 * Usage:
 *   DATABASE_URL=... pnpm -C frontend exec tsx scripts/export-explore-assets-manifest.ts
 *   DATABASE_URL=... pnpm -C frontend exec tsx scripts/export-explore-assets-manifest.ts --limit=500
 */
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { getDb } from '../server/_lib/db/postgres.js'
import { ensureCreatorMetricsSchema } from '../server/_lib/zora/creatorMetricsSync.js'

const DEFAULT_LIMIT = 200
const OUT_PATH = resolve(import.meta.dirname, '../public/data/explore-assets-manifest.json')

function parseLimit(argv: string[]): number {
  const flag = argv.find((a) => a.startsWith('--limit='))
  if (!flag) return DEFAULT_LIMIT
  const n = Number(flag.split('=')[1])
  return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), 5000) : DEFAULT_LIMIT
}

async function main(): Promise<void> {
  const limit = parseLimit(process.argv.slice(2))
  const db = await getDb()
  if (!db) {
    console.error('DATABASE_URL is required')
    process.exit(1)
  }

  await ensureCreatorMetricsSchema(db)

  const { rows } = await db.sql`
    SELECT
      lower(cc.coin_address) AS address,
      lower(cc.creator_address) AS "creatorAddress",
      cc.chain_id AS "chainId",
      cc.market_cap_usd AS "marketCapUsd",
      cc.volume_24h_usd AS "volume24hUsd"
    FROM creator_coins cc
    WHERE cc.chain_id = 8453
      AND cc.coin_address IS NOT NULL
    ORDER BY coalesce(cc.volume_24h_usd, 0) DESC, coalesce(cc.market_cap_usd, 0) DESC
    LIMIT ${limit}
  `

  const tokens = (rows ?? []).map((row: Record<string, unknown>) => ({
    address: String(row.address ?? ''),
    creatorAddress: row.creatorAddress != null ? String(row.creatorAddress) : null,
    chainId: Number(row.chainId) || 8453,
    tokenKind: 'creator' as const,
    marketCapUsd: row.marketCapUsd != null ? Number(row.marketCapUsd) : null,
    volume24hUsd: row.volume24hUsd != null ? Number(row.volume24hUsd) : null,
  }))

  const manifest = {
    schemaVersion: 1,
    name: '4626-explore-assets',
    updatedAt: new Date().toISOString(),
    policy: {
      description:
        'Integrator-facing token metadata for Explore-indexed creator coins on Base. Regenerate via export-explore-assets-manifest.ts.',
      tokenKindValues: ['creator', 'share', 'content'],
      chains: [{ chainId: 8453, name: 'Base' }],
    },
    tokens,
  }

  writeFileSync(OUT_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  console.log(`Wrote ${tokens.length} tokens to ${OUT_PATH}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
