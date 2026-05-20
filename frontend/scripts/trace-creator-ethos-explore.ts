/**
 * Trace creator_address → creator_ethos_projection → explore API ethos fields.
 *
 * Usage:
 *   pnpm -C frontend exec tsx scripts/trace-creator-ethos-explore.ts --creator 0x...
 *   pnpm -C frontend exec tsx scripts/trace-creator-ethos-explore.ts --creator 0x... --base-url https://app.4626.fun
 */
import { getDb, isDbConfigured } from '../packages/server-core/src/index.js'
import { loadCreatorEthosProjectionByAddresses } from '../server/_lib/zora/creatorEthosProjection.js'

function readArg(flag: string): string | null {
  const idx = process.argv.indexOf(flag)
  if (idx === -1) return null
  const value = process.argv[idx + 1]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

async function main() {
  const creator = readArg('--creator')?.toLowerCase() ?? null
  const baseUrl = (readArg('--base-url') ?? 'http://localhost:5173').replace(/\/$/, '')
  if (!creator || !/^0x[a-f0-9]{40}$/.test(creator)) {
    console.error('Provide --creator 0x<40 hex>')
    process.exit(1)
  }

  if (isDbConfigured()) {
    const db = await getDb()
    if (db) {
      const projection = await loadCreatorEthosProjectionByAddresses(db, [creator])
      const row = projection.get(creator) ?? null
      console.log('creator_ethos_projection:', row ?? '(no row)')
    } else {
      console.log('creator_ethos_projection: db_unavailable')
    }
  } else {
    console.log('creator_ethos_projection: DATABASE_URL not configured (skip)')
  }

  const exploreUrl = `${baseUrl}/api/zora/explore?list=TOP_VOLUME_CREATORS_24H&count=50`
  const res = await fetch(exploreUrl)
  const body = (await res.json()) as {
    success?: boolean
    data?: { edges?: Array<{ node?: { creatorAddress?: string; ethosScore?: number; ethosScoreSource?: string } }> }
  }
  const match = (body.data?.edges ?? []).find(
    (edge) => String(edge.node?.creatorAddress ?? '').toLowerCase() === creator,
  )
  console.log('explore_api_status:', res.status)
  console.log(
    'explore_match:',
    match?.node
      ? {
          ethosScore: match.node.ethosScore ?? null,
          ethosScoreSource: match.node.ethosScoreSource ?? null,
        }
      : '(creator not in first page of TOP_VOLUME_CREATORS_24H)',
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
