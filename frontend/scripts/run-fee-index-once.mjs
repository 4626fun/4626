import { getDb } from '../server/_lib/db/postgres.ts'
import { ensureCreatorMetricsSchema } from '../server/_lib/zora/creatorMetricsSync.ts'
import { indexCreatorCoinTradeRewardsFees } from '../server/_lib/zora/coinTradeRewardsIndexer.ts'

async function main() {
  const limit = Number(process.env.CREATOR_METRICS_FEE_INDEX_LIMIT || 5)
  const apiKey = process.env.ZORA_API_KEY || process.env.VITE_ZORA_PUBLIC_API_KEY || ''
  let sdk = null
  if (apiKey) {
    const mod = await import('@zoralabs/coins-sdk')
    mod.setApiKey(apiKey)
    sdk = mod
  }
  const db = await getDb()
  if (!db) throw new Error('no_db')
  await ensureCreatorMetricsSchema(db)
  console.log('[fee-index-once] starting', { limit, hasSdk: Boolean(sdk) })
  const started = Date.now()
  const result = await indexCreatorCoinTradeRewardsFees(db, { sdk, limit })
  console.log('[fee-index-once] done', { ms: Date.now() - started, ...result })
}

main().catch((err) => {
  console.error('[fee-index-once] failed', err)
  process.exit(1)
})
