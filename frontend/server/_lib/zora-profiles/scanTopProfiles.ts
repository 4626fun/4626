// SPDX-License-Identifier: MIT
//
// Bounded Zora explore scan → upsert into public.zora_profiles.
// Ported from indexer/src/scanTopCoins.ts for Vercel cron use.

import {
  readProfileRefreshListType,
  readProfileRefreshPageSize,
  readProfileRefreshRequestIntervalMs,
  readProfileRefreshTargetCount,
  readProfileRefreshUpsertBatchSize,
  ZORA_PROFILES_TABLE,
} from './cronConfig.js'

export type ProfileScanResult = {
  coinsFetched: number
  profilesUpserted: number
  skippedNoHandle: number
  pages: number
  listType: string
}

type CoinEdge = {
  node: {
    id?: string
    name?: string
    address?: string
    symbol?: string
    totalVolume?: string
    marketCap?: string
    volume24h?: string
    uniqueHolders?: number | string
    payoutRecipientAddress?: string
    creatorProfile?: {
      id?: string
      handle?: string
      username?: string
      displayName?: string
      publicWallet?: { walletAddress?: string } | null
    } | null
  }
}

type SupabaseUpsertClient = {
  from: (table: string) => {
    upsert: (
      rows: unknown[],
      options: { onConflict: string },
    ) => Promise<{ error: { message: string } | null }>
  }
}

function parseNumeric(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const trimmed = String(value).trim()
  if (trimmed === '') return null
  const n = Number(trimmed)
  return Number.isFinite(n) ? n : null
}

function parseIntOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const n = Number(value)
  return Number.isFinite(n) ? Math.trunc(n) : null
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function chunkProfileRows<T>(items: T[], batchSize: number): T[][] {
  const size = Math.max(1, Math.floor(batchSize))
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

async function upsertProfileRowsInBatches(
  db: SupabaseUpsertClient,
  rows: Array<Record<string, unknown>>,
  batchSize: number,
): Promise<void> {
  for (const batch of chunkProfileRows(rows, batchSize)) {
    const { error } = await db.from(ZORA_PROFILES_TABLE).upsert(batch, { onConflict: 'handle' })
    if (error) throw new Error(`profile_upsert_failed:${error.message}`)
  }
}

export async function scanTopProfilesFromExplore(
  db: SupabaseUpsertClient,
  apiKey: string,
): Promise<ProfileScanResult> {
  const targetCount = readProfileRefreshTargetCount()
  const pageSize = readProfileRefreshPageSize()
  const listType = readProfileRefreshListType()
  const requestIntervalMs = readProfileRefreshRequestIntervalMs()
  const upsertBatchSize = readProfileRefreshUpsertBatchSize()

  const sdk: any = await import('@zoralabs/coins-sdk')
  sdk.setApiKey(apiKey)

  const sdkFnByListType: Record<string, (args?: { count: number; after?: string }) => Promise<unknown>> = {
    most_valuable_creators: sdk.getMostValuableCreatorCoins,
    creator_coins: sdk.getCreatorCoins,
    most_valuable: sdk.getCoinsMostValuable,
    top_volume_24h: sdk.getCoinsTopVolume24h,
    top_gainers: sdk.getCoinsTopGainers,
    new_coins: sdk.getCoinsNew,
    last_traded: sdk.getCoinsLastTraded,
    last_traded_unique: sdk.getCoinsLastTradedUnique,
  }
  const sdkFn = sdkFnByListType[listType]
  if (!sdkFn) {
    throw new Error(`unknown_profile_refresh_list_type:${listType}`)
  }

  let after: string | undefined
  let totalFetched = 0
  let totalUpserted = 0
  let totalSkipped = 0
  let pages = 0
  const refreshedAt = new Date().toISOString()

  while (totalFetched < targetCount) {
    pages += 1
    const count = Math.min(pageSize, targetCount - totalFetched)
    let response: any
    try {
      response = await sdkFn({ count, after })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      throw new Error(`zora_explore_fetch_failed:${message}`)
    }

    const exploreList = response?.data?.exploreList
    const edges: CoinEdge[] = exploreList?.edges ?? []
    const pageInfo = exploreList?.pageInfo ?? {}

    if (edges.length === 0) break

    const rows = edges
      .map((edge) => {
        const node = edge.node
        if (!node) return null
        const handle = node.creatorProfile?.handle ?? node.creatorProfile?.username ?? null
        if (!handle) {
          totalSkipped += 1
          return null
        }
        const payout = (node.payoutRecipientAddress ?? '').toLowerCase() || null
        return {
          handle,
          zora_profile_id: node.creatorProfile?.id ?? null,
          zora_display_name: node.creatorProfile?.displayName ?? null,
          zora_creator_coin_address: (node.address ?? '').toLowerCase() || null,
          zora_creator_coin_name: node.name ?? null,
          zora_creator_coin_symbol: node.symbol ?? null,
          zora_creator_coin_market_cap: parseNumeric(node.marketCap),
          zora_creator_coin_total_volume: parseNumeric(node.totalVolume),
          volume_24h_usd: parseNumeric(node.volume24h),
          unique_holders: parseIntOrNull(node.uniqueHolders),
          payout_recipient: payout,
          primary_wallet: (node.creatorProfile?.publicWallet?.walletAddress ?? '').toLowerCase() || null,
          source: `explore:${listType}`,
          last_refreshed_at: refreshedAt,
        }
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)

    if (rows.length > 0) {
      await upsertProfileRowsInBatches(db, rows, upsertBatchSize)
      totalUpserted += rows.length
    }

    totalFetched += edges.length

    if (!pageInfo?.hasNextPage) break
    after = pageInfo?.endCursor
    if (!after) break

    if (requestIntervalMs > 0) {
      await sleep(requestIntervalMs)
    }
  }

  return {
    coinsFetched: totalFetched,
    profilesUpserted: totalUpserted,
    skippedNoHandle: totalSkipped,
    pages,
    listType,
  }
}
