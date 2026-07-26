import { createPublicClient, http, parseAbiItem, type PublicClient } from 'viem'
import { base } from 'viem/chains'

import type { FeeModel } from './creatorMetricsSyncHelpers.js'

type Db = {
  sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }>
}

/** Legacy coin-emitted event (pre-V4 / some older coins). */
export const COIN_TRADE_REWARDS_EVENT =
  'event CoinTradeRewards(address indexed payoutRecipient,address indexed platformReferrer,address indexed tradeReferrer,address protocolRewardRecipient,uint256 creatorReward,uint256 platformReferrerReward,uint256 traderReferrerReward,uint256 protocolReward,address currency)'

/**
 * Current Zora V4 hook event. `coin` is not indexed — scan by topic, filter in-process.
 * Doppler is included in the struct; LP is still not (see LpReward).
 */
export const COIN_MARKET_REWARDS_V4_EVENT =
  'event CoinMarketRewardsV4(address coin, address currency, address payoutRecipient, address platformReferrer, address tradeReferrer, address protocolRewardRecipient, address dopplerRecipient, (uint256 creatorPayoutAmountCurrency, uint256 creatorPayoutAmountCoin, uint256 platformReferrerAmountCurrency, uint256 platformReferrerAmountCoin, uint256 tradeReferrerAmountCurrency, uint256 tradeReferrerAmountCoin, uint256 protocolAmountCurrency, uint256 protocolAmountCoin, uint256 dopplerAmountCurrency, uint256 dopplerAmountCoin) marketRewards)'

export const ZORA_TOKEN_ADDRESS = '0x1111111111166b7fe7bd91427724b487980afc69'
export const USDC_BASE_ADDRESS = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'

/** Market share of total v4 fee excluding LP (creator+platform+trade+protocol+doppler ≈ 80%). */
export const V4_EVENT_MARKET_SHARE = 0.79
export const V4_DOPPLER_OF_TOTAL = 0.01
export const V4_LP_OF_TOTAL = 0.2
/** creator+platform+trade+protocol portion of total fee (excludes doppler + LP). */
export const V4_EVENT_CORE_MARKET_SHARE = 0.79

const DEFAULT_FEE_INDEX_LIMIT = 40
const DEFAULT_BLOCK_TIME_SECONDS = 2n
const BASE_CHAIN_ID = 8453

export type FeeBucketUsd = {
  creatorUsd: number
  platformUsd: number
  tradeRefUsd: number
  protocolUsd: number
  lpUsd: number
  dopplerUsd: number
  totalUsd: number
}

export type RawRewardTotals = {
  creatorRaw: bigint
  platformRaw: bigint
  tradeRefRaw: bigint
  protocolRaw: bigint
  dopplerRaw: bigint
  currency: string
  /** True when any contributing log included on-chain Doppler (CoinMarketRewardsV4). */
  hasOnchainDoppler: boolean
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const n = Number(String(value ?? '').trim())
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.floor(n)
}

function isAlchemyFreeTierLogsUnusable(url: string): boolean {
  // Alchemy free-tier eth_getLogs is capped at 10 blocks — cannot cover a 24h window.
  return url.includes('alchemy.com') || url.includes('alchemyapi.io')
}

function getLogsRpcUrl(): string {
  const logs = String(process.env.BASE_LOGS_RPC_URL ?? '').trim()
  const rpc = String(process.env.BASE_RPC_URL ?? '').trim()
  // Prefer a logs-capable endpoint. Many envs set BASE_LOGS_RPC_URL to Alchemy while
  // BASE_RPC_URL is a paid/matrixed provider that supports large getLogs ranges.
  if (logs && !isAlchemyFreeTierLogsUnusable(logs)) return logs
  if (rpc) return rpc
  if (logs) return logs
  return 'https://base.meowrpc.com'
}

function getRange(rpcUrl: string): bigint {
  const raw = String(process.env.BASE_LOGS_RPC_RANGE ?? '').trim()
  if (raw) {
    try {
      const n = BigInt(raw)
      return n > 0n ? n : 25_000n
    } catch {
      return 25_000n
    }
  }
  // Topic-wide CoinMarketRewardsV4 scans can be dense; keep chunks under ~20k results.
  if (rpcUrl.includes('matrixed') || rpcUrl.includes('endpoints.matrixed.link')) return 25_000n
  return 15_000n
}

function normalizeAddress(value: unknown): string | null {
  const s = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (!/^0x[a-f0-9]{40}$/.test(s)) return null
  return s
}

export function rawAmountToUsd(raw: bigint, decimals: number, usdPrice: number): number {
  if (raw <= 0n || !Number.isFinite(usdPrice) || usdPrice <= 0) return 0
  const base = 10n ** BigInt(Math.max(0, Math.min(36, Math.floor(decimals))))
  // Avoid float overflow for huge ints: convert via number only after scaling down.
  const whole = Number(raw / base)
  const frac = Number(raw % base) / Number(base)
  const tokens = whole + frac
  if (!Number.isFinite(tokens)) return 0
  return tokens * usdPrice
}

/**
 * Derive LP (and Doppler when missing) from observed on-chain market rewards using fee_model.
 * v4 CoinMarketRewardsV4 includes Doppler; LP remains derived (20% of total).
 * legacy: UI rates have lp=0, doppler=0; treat core market sum as full fee total.
 */
export function deriveFeeBucketsFromMarketRewards(
  marketUsd: {
    creatorUsd: number
    platformUsd: number
    tradeRefUsd: number
    protocolUsd: number
    /** When set (from CoinMarketRewardsV4), use instead of deriving Doppler. */
    dopplerUsd?: number | null
  },
  feeModel: FeeModel,
): FeeBucketUsd {
  const creatorUsd = Math.max(0, marketUsd.creatorUsd)
  const platformUsd = Math.max(0, marketUsd.platformUsd)
  const tradeRefUsd = Math.max(0, marketUsd.tradeRefUsd)
  const protocolUsd = Math.max(0, marketUsd.protocolUsd)
  const M = creatorUsd + platformUsd + tradeRefUsd + protocolUsd

  if (feeModel === 'legacy') {
    return {
      creatorUsd,
      platformUsd,
      tradeRefUsd,
      protocolUsd,
      lpUsd: 0,
      dopplerUsd: 0,
      totalUsd: M,
    }
  }

  const lpUsd = M > 0 ? M * (V4_LP_OF_TOTAL / V4_EVENT_CORE_MARKET_SHARE) : 0
  const providedDoppler =
    typeof marketUsd.dopplerUsd === 'number' && Number.isFinite(marketUsd.dopplerUsd)
      ? Math.max(0, marketUsd.dopplerUsd)
      : null
  const dopplerUsd =
    providedDoppler != null
      ? providedDoppler
      : M > 0
        ? M * (V4_DOPPLER_OF_TOTAL / V4_EVENT_CORE_MARKET_SHARE)
        : 0
  return {
    creatorUsd,
    platformUsd,
    tradeRefUsd,
    protocolUsd,
    lpUsd,
    dopplerUsd,
    totalUsd: M + lpUsd + dopplerUsd,
  }
}

export async function resolveCurrencyUsdPrice(
  currency: string,
  options: {
    sdk?: any
    envPrice?: number | null
    sampleCoin?: {
      priceInUsdc?: unknown
      priceInPoolToken?: unknown
      poolCurrencyAddress?: unknown
    } | null
  } = {},
): Promise<number | null> {
  const addr = normalizeAddress(currency)
  if (!addr) return null
  if (addr === USDC_BASE_ADDRESS) return 1

  const envPrice = options.envPrice
  if (typeof envPrice === 'number' && Number.isFinite(envPrice) && envPrice > 0) return envPrice

  if (addr === ZORA_TOKEN_ADDRESS) {
    const sample = options.sampleCoin
    const poolCurrency = normalizeAddress(sample?.poolCurrencyAddress)
    const priceInUsdc = Number(sample?.priceInUsdc)
    const priceInPoolToken = Number(sample?.priceInPoolToken)
    if (
      poolCurrency === ZORA_TOKEN_ADDRESS &&
      Number.isFinite(priceInUsdc) &&
      priceInUsdc > 0 &&
      Number.isFinite(priceInPoolToken) &&
      priceInPoolToken > 0
    ) {
      return priceInUsdc / priceInPoolToken
    }

    if (options.sdk?.getCoin) {
      try {
        const response = await options.sdk.getCoin({ address: ZORA_TOKEN_ADDRESS, chain: BASE_CHAIN_ID })
        const coin = response?.data?.zora20Token
        const direct = Number(coin?.tokenPrice?.priceInUsdc)
        if (Number.isFinite(direct) && direct > 0) return direct
      } catch {
        // fall through
      }
    }
  }

  return null
}

type CandidateCoin = {
  coinAddress: string
  feeModel: FeeModel
  volume24hUsd: number
}

async function loadFeeIndexCandidates(db: Db, limit: number): Promise<CandidateCoin[]> {
  const result = await db.sql`
    SELECT
      lower(coin_address) AS coin_address,
      fee_model,
      COALESCE(volume_24h_usd, 0)::float8 AS volume_24h_usd
    FROM creator_coins
    WHERE chain_id = ${BASE_CHAIN_ID}
      AND volume_24h_usd IS NOT NULL
      AND volume_24h_usd > 0
      AND last_seen_at IS NOT NULL
      AND last_seen_at >= NOW() - INTERVAL '48 hours'
    ORDER BY volume_24h_usd DESC NULLS LAST
    LIMIT ${limit};
  `
  const out: CandidateCoin[] = []
  for (const row of result.rows ?? []) {
    const coinAddress = normalizeAddress(row.coin_address)
    if (!coinAddress) continue
    const feeModel = row.fee_model === 'legacy' ? 'legacy' : 'v4'
    const volume24hUsd = Number(row.volume_24h_usd)
    if (!Number.isFinite(volume24hUsd) || volume24hUsd <= 0) continue
    out.push({ coinAddress, feeModel, volume24hUsd })
  }
  return out
}

type RewardLog = {
  coin: string
  args: {
    currency?: unknown
    creatorReward?: unknown
    platformReferrerReward?: unknown
    traderReferrerReward?: unknown
    protocolReward?: unknown
    marketRewards?: {
      creatorPayoutAmountCurrency?: unknown
      platformReferrerAmountCurrency?: unknown
      tradeReferrerAmountCurrency?: unknown
      protocolAmountCurrency?: unknown
      dopplerAmountCurrency?: unknown
    }
  }
  source: 'v4' | 'legacy'
}

async function fetchMarketRewardsV4Logs(params: {
  client: PublicClient
  coinSet: Set<string>
  fromBlock: bigint
  toBlock: bigint
  range: bigint
}): Promise<RewardLog[]> {
  const event = parseAbiItem(COIN_MARKET_REWARDS_V4_EVENT)
  const logsOut: RewardLog[] = []
  const { client, coinSet, fromBlock, toBlock, range } = params

  for (let start = fromBlock; start <= toBlock; start += range + 1n) {
    const end = start + range > toBlock ? toBlock : start + range
    const logs = await client.getLogs({
      event: event as any,
      fromBlock: start,
      toBlock: end,
    })
    for (const log of logs as any[]) {
      const coin = normalizeAddress(log.args?.coin)
      if (!coin || !coinSet.has(coin)) continue
      logsOut.push({ coin, args: log.args ?? {}, source: 'v4' })
    }
  }
  return logsOut
}

async function fetchLegacyTradeRewardLogs(params: {
  client: PublicClient
  coinAddresses: string[]
  fromBlock: bigint
  toBlock: bigint
  range: bigint
  addressBatchSize: number
}): Promise<RewardLog[]> {
  const event = parseAbiItem(COIN_TRADE_REWARDS_EVENT)
  const logsOut: RewardLog[] = []
  const { client, coinAddresses, fromBlock, toBlock, range, addressBatchSize } = params

  for (let offset = 0; offset < coinAddresses.length; offset += addressBatchSize) {
    const batch = coinAddresses.slice(offset, offset + addressBatchSize)
    for (let start = fromBlock; start <= toBlock; start += range + 1n) {
      const end = start + range > toBlock ? toBlock : start + range
      const logs = await client.getLogs({
        address: batch as any,
        event: event as any,
        fromBlock: start,
        toBlock: end,
      })
      for (const log of logs as any[]) {
        const coin = normalizeAddress(log.address)
        if (!coin) continue
        logsOut.push({ coin, args: log.args ?? {}, source: 'legacy' })
      }
    }
  }
  return logsOut
}

function aggregateRawRewards(logs: RewardLog[]): Map<string, Map<string, RawRewardTotals>> {
  // coin -> currency -> totals
  const byCoin = new Map<string, Map<string, RawRewardTotals>>()
  for (const { coin, args, source } of logs) {
    const currency = normalizeAddress(args?.currency)
    if (!currency) continue
    let byCurrency = byCoin.get(coin)
    if (!byCurrency) {
      byCurrency = new Map()
      byCoin.set(coin, byCurrency)
    }
    let totals = byCurrency.get(currency)
    if (!totals) {
      totals = {
        creatorRaw: 0n,
        platformRaw: 0n,
        tradeRefRaw: 0n,
        protocolRaw: 0n,
        dopplerRaw: 0n,
        currency,
        hasOnchainDoppler: false,
      }
      byCurrency.set(currency, totals)
    }

    if (source === 'v4') {
      const mr = args.marketRewards
      totals.creatorRaw += BigInt(mr?.creatorPayoutAmountCurrency ?? 0n)
      totals.platformRaw += BigInt(mr?.platformReferrerAmountCurrency ?? 0n)
      totals.tradeRefRaw += BigInt(mr?.tradeReferrerAmountCurrency ?? 0n)
      totals.protocolRaw += BigInt(mr?.protocolAmountCurrency ?? 0n)
      totals.dopplerRaw += BigInt(mr?.dopplerAmountCurrency ?? 0n)
      totals.hasOnchainDoppler = true
    } else {
      totals.creatorRaw += BigInt(args?.creatorReward ?? 0n)
      totals.platformRaw += BigInt(args?.platformReferrerReward ?? 0n)
      totals.tradeRefRaw += BigInt(args?.traderReferrerReward ?? 0n)
      totals.protocolRaw += BigInt(args?.protocolReward ?? 0n)
    }
  }
  return byCoin
}

async function upsertFeeBuckets(
  db: Db,
  rows: Array<{ coinAddress: string; buckets: FeeBucketUsd }>,
): Promise<number> {
  let updated = 0
  for (const row of rows) {
    await db.sql`
      UPDATE creator_coins
      SET
        fees_24h_creator_usd = ${row.buckets.creatorUsd},
        fees_24h_platform_usd = ${row.buckets.platformUsd},
        fees_24h_trade_ref_usd = ${row.buckets.tradeRefUsd},
        fees_24h_protocol_usd = ${row.buckets.protocolUsd},
        fees_24h_lp_usd = ${row.buckets.lpUsd},
        fees_24h_doppler_usd = ${row.buckets.dopplerUsd},
        fees_24h_usd = ${row.buckets.totalUsd},
        fees_24h_indexed_at = NOW()
      WHERE chain_id = ${BASE_CHAIN_ID}
        AND lower(coin_address) = ${row.coinAddress};
    `
    updated += 1
  }
  return updated
}

export type CoinTradeRewardsIndexResult = {
  candidates: number
  coinsIndexed: number
  logsFetched: number
  skippedNoPrice: number
  zoraUsdPrice: number | null
}

/**
 * Index on-chain market reward events for top recent-volume coins and write fee bucket USD columns.
 * Prefers CoinMarketRewardsV4 (hook); also scans legacy CoinTradeRewards on coin contracts.
 */
export async function indexCreatorCoinTradeRewardsFees(
  db: Db,
  options: { sdk?: any; limit?: number } = {},
): Promise<CoinTradeRewardsIndexResult> {
  const enabled = process.env.CREATOR_METRICS_FEE_INDEX_ENABLED !== '0'
  if (!enabled) {
    return { candidates: 0, coinsIndexed: 0, logsFetched: 0, skippedNoPrice: 0, zoraUsdPrice: null }
  }

  const limit = Math.max(
    1,
    options.limit ?? parsePositiveInt(process.env.CREATOR_METRICS_FEE_INDEX_LIMIT, DEFAULT_FEE_INDEX_LIMIT),
  )
  const candidates = await loadFeeIndexCandidates(db, limit)
  if (candidates.length === 0) {
    return { candidates: 0, coinsIndexed: 0, logsFetched: 0, skippedNoPrice: 0, zoraUsdPrice: null }
  }

  const feeModelByCoin = new Map(candidates.map((c) => [c.coinAddress, c.feeModel]))
  const coinAddresses = candidates.map((c) => c.coinAddress)
  const coinSet = new Set(coinAddresses)

  const rpcUrl = getLogsRpcUrl()
  const client = createPublicClient({
    chain: base,
    transport: http(rpcUrl, { timeout: 25_000 }),
  })
  const latest = await client.getBlockNumber()
  const blockTime = process.env.BASE_BLOCK_TIME_SECONDS
    ? BigInt(process.env.BASE_BLOCK_TIME_SECONDS)
    : DEFAULT_BLOCK_TIME_SECONDS
  const lookbackBlocks = (24n * 60n * 60n) / (blockTime > 0n ? blockTime : 2n)
  const fromBlock = latest > lookbackBlocks ? latest - lookbackBlocks : 0n
  const range = getRange(rpcUrl)
  const addressBatchSize = Math.max(
    1,
    Math.min(10, parsePositiveInt(process.env.COIN_REWARDS_ADDRESS_BATCH_SIZE, 3)),
  )

  const v4Logs = await fetchMarketRewardsV4Logs({
    client,
    coinSet,
    fromBlock,
    toBlock: latest,
    range,
  })

  // Legacy path for coins that still emit CoinTradeRewards on the coin contract.
  // Skip coins already covered by V4 logs to avoid double-counting.
  const coinsWithV4 = new Set(v4Logs.map((l) => l.coin))
  const legacyAddresses = coinAddresses.filter((a) => !coinsWithV4.has(a))
  const legacyLogs =
    legacyAddresses.length > 0
      ? await fetchLegacyTradeRewardLogs({
          client,
          coinAddresses: legacyAddresses,
          fromBlock,
          toBlock: latest,
          range,
          addressBatchSize,
        })
      : []

  const logs = [...v4Logs, ...legacyLogs]
  const aggregated = aggregateRawRewards(logs)

  const envZoraPrice = Number(String(process.env.CREATOR_METRICS_ZORA_USD_PRICE ?? '').trim())
  let sampleCoin: {
    priceInUsdc?: unknown
    priceInPoolToken?: unknown
    poolCurrencyAddress?: unknown
  } | null = null
  if (options.sdk?.getCoin && coinAddresses[0]) {
    try {
      const response = await options.sdk.getCoin({ address: coinAddresses[0], chain: BASE_CHAIN_ID })
      const coin = response?.data?.zora20Token
      sampleCoin = {
        priceInUsdc: coin?.tokenPrice?.priceInUsdc,
        priceInPoolToken: coin?.tokenPrice?.priceInPoolToken,
        poolCurrencyAddress: coin?.poolCurrencyToken?.address,
      }
    } catch {
      sampleCoin = null
    }
  }

  const zoraUsdPrice = await resolveCurrencyUsdPrice(ZORA_TOKEN_ADDRESS, {
    sdk: options.sdk,
    envPrice: Number.isFinite(envZoraPrice) && envZoraPrice > 0 ? envZoraPrice : null,
    sampleCoin,
  })

  const priceByCurrency = new Map<string, number | null>()
  priceByCurrency.set(USDC_BASE_ADDRESS, 1)
  priceByCurrency.set(ZORA_TOKEN_ADDRESS, zoraUsdPrice)

  const upserts: Array<{ coinAddress: string; buckets: FeeBucketUsd }> = []
  let skippedNoPrice = 0

  for (const coinAddress of coinAddresses) {
    const byCurrency = aggregated.get(coinAddress)
    if (!byCurrency || byCurrency.size === 0) continue

    let creatorUsd = 0
    let platformUsd = 0
    let tradeRefUsd = 0
    let protocolUsd = 0
    let dopplerUsd = 0
    let hasOnchainDoppler = false
    let convertible = false

    for (const [currency, totals] of byCurrency) {
      let price = priceByCurrency.get(currency)
      if (price === undefined) {
        price = await resolveCurrencyUsdPrice(currency, { sdk: options.sdk })
        priceByCurrency.set(currency, price)
      }
      if (price == null || !(price > 0)) {
        skippedNoPrice += 1
        continue
      }
      convertible = true
      const decimals = currency === USDC_BASE_ADDRESS ? 6 : 18
      creatorUsd += rawAmountToUsd(totals.creatorRaw, decimals, price)
      platformUsd += rawAmountToUsd(totals.platformRaw, decimals, price)
      tradeRefUsd += rawAmountToUsd(totals.tradeRefRaw, decimals, price)
      protocolUsd += rawAmountToUsd(totals.protocolRaw, decimals, price)
      if (totals.hasOnchainDoppler) {
        hasOnchainDoppler = true
        dopplerUsd += rawAmountToUsd(totals.dopplerRaw, decimals, price)
      }
    }

    if (!convertible) continue

    const feeModel = feeModelByCoin.get(coinAddress) ?? 'v4'
    const buckets = deriveFeeBucketsFromMarketRewards(
      {
        creatorUsd,
        platformUsd,
        tradeRefUsd,
        protocolUsd,
        dopplerUsd: hasOnchainDoppler ? dopplerUsd : null,
      },
      feeModel,
    )
    upserts.push({ coinAddress, buckets })
  }

  const coinsIndexed = await upsertFeeBuckets(db, upserts)
  return {
    candidates: candidates.length,
    coinsIndexed,
    logsFetched: logs.length,
    skippedNoPrice,
    zoraUsdPrice,
  }
}
