import type { DbPool } from '../db/postgres.js'
import {
  enrichLotteryEntrySources,
  type LotteryEntrySource,
} from './lotteryEntrySource.js'
import {
  getLotteryIndexTipBlock,
  resolveRecentWinnersBlockRange,
  shouldServeLotteryFromIndex,
  type RecentWinnersQueryParams,
} from './recentWinnersQuery.js'

export type { LotteryEntrySource }

export type RecentLotteryEntryEvent = {
  type: 'LotteryEntryCreated'
  entrySource: LotteryEntrySource
  blockNumber: string
  transactionHash: string
  logIndex: number
  creatorCoin: string
  user: string
  swapAmountUsd1e6: string
  winChancePpm: string
  requestId: string
}

export type RecentEntriesQueryParams = RecentWinnersQueryParams

export type RecentEntriesQueryResult = {
  events: RecentLotteryEntryEvent[]
  dataSource: 'index' | 'rpc'
}

function byteaToHex(value: unknown): string {
  if (value == null) return '0x'
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) {
    return `0x${value.toString('hex')}`
  }
  const raw = String(value)
  if (raw.startsWith('0x')) return raw.toLowerCase()
  if (raw.startsWith('\\x')) return `0x${raw.slice(2)}`.toLowerCase()
  return raw.toLowerCase()
}

function normalizeHexAddress(value: string | null | undefined): string | null {
  const raw = (value ?? '').trim().toLowerCase()
  if (!raw) return null
  return raw.startsWith('0x') ? raw : `0x${raw}`
}

function getLogsRpcUrl(): string {
  const logs = (process.env.BASE_LOGS_RPC_URL ?? '').trim()
  if (logs) return logs
  const rpc = (process.env.BASE_RPC_URL ?? '').trim()
  if (rpc) return rpc
  return 'https://base.meowrpc.com'
}

const LOTTERY_ENTRY_EVENT =
  'event LotteryEntryCreated(address indexed token,address indexed user,uint256 swapAmountUSD,uint256 winChancePPM,uint256 requestId)'

type RawLotteryEntryEvent = Omit<RecentLotteryEntryEvent, 'entrySource'>

function mapRawEntryRow(row: Record<string, unknown>): RawLotteryEntryEvent {
  return {
    type: 'LotteryEntryCreated',
    blockNumber: String(row.block_num ?? '0'),
    transactionHash: byteaToHex(row.tx_hash),
    logIndex: Number(row.log_idx ?? 0),
    creatorCoin: String(row.creator_coin ?? '').toLowerCase(),
    user: String(row.entry_user ?? '').toLowerCase(),
    swapAmountUsd1e6: String(row.swap_amount_usd ?? '0'),
    winChancePpm: String(row.win_chance_ppm ?? '0'),
    requestId: String(row.request_id ?? '0'),
  }
}

export async function fetchRecentEntriesFromIndex(
  db: DbPool,
  params: RecentEntriesQueryParams,
): Promise<RawLotteryEntryEvent[]> {
  const creator = normalizeHexAddress(params.creatorCoin)
  const fromBlock = params.fromBlock.toString()
  const toBlock = params.toBlock.toString()

  const result = await db.query?.(
    `
    select
      block_num,
      tx_hash,
      log_idx,
      lower('0x' || encode(token, 'hex')) as creator_coin,
      lower('0x' || encode("user", 'hex')) as entry_user,
      swap_amount_usd::text as swap_amount_usd,
      win_chance_ppm::text as win_chance_ppm,
      request_id::text as request_id
    from protocol_lottery_entries
    where block_num >= $1::numeric
      and block_num <= $2::numeric
      and ($3::text is null or lower('0x' || encode(token, 'hex')) = $3)
    order by block_num desc, log_idx desc
    limit $4
    `,
    [fromBlock, toBlock, creator, params.limit],
  )

  if (!result) {
    throw new Error('Database query API unavailable')
  }

  return result.rows.map((row: Record<string, unknown>) => mapRawEntryRow(row))
}

export async function fetchRecentEntriesFromRpc(
  params: RecentEntriesQueryParams,
): Promise<RawLotteryEntryEvent[]> {
  const { createPublicClient, http, parseAbiItem } = await import('viem')
  const { base } = await import('viem/chains')

  const client = createPublicClient({
    chain: base,
    transport: http(getLogsRpcUrl(), { timeout: 25_000 }),
  })

  const entryEvent = parseAbiItem(LOTTERY_ENTRY_EVENT)
  const lotteryManager = params.lotteryManager as `0x${string}`

  const entryLogs = await client.getLogs({
    address: lotteryManager,
    event: entryEvent,
    args: params.creatorCoin ? { token: params.creatorCoin as `0x${string}` } : undefined,
    fromBlock: params.fromBlock,
    toBlock: params.toBlock,
  })

  return entryLogs
    .map((l) => ({
      type: 'LotteryEntryCreated' as const,
      blockNumber: (l.blockNumber ?? 0n).toString(),
      transactionHash: String(l.transactionHash ?? '').toLowerCase(),
      logIndex: typeof l.logIndex === 'number' ? l.logIndex : Number(l.logIndex ?? 0),
      creatorCoin: String(l.args?.token ?? '').toLowerCase(),
      user: String(l.args?.user ?? '').toLowerCase(),
      swapAmountUsd1e6: (l.args?.swapAmountUSD ?? 0n).toString(),
      winChancePpm: (l.args?.winChancePPM ?? 0n).toString(),
      requestId: (l.args?.requestId ?? 0n).toString(),
    }))
    .sort((a, b) => {
      const ab = BigInt(a.blockNumber)
      const bb = BigInt(b.blockNumber)
      if (ab === bb) return (b.logIndex ?? 0) - (a.logIndex ?? 0)
      return ab > bb ? -1 : 1
    })
    .slice(0, params.limit)
}

async function createRpcTransactionLookup() {
  const { createPublicClient, http } = await import('viem')
  const { base } = await import('viem/chains')
  const client = createPublicClient({
    chain: base,
    transport: http(getLogsRpcUrl(), { timeout: 25_000 }),
  })

  return async (hash: `0x${string}`) => {
    const tx = await client.getTransaction({ hash })
    return {
      from: tx.from,
      to: tx.to,
      input: tx.input,
    }
  }
}

export async function resolveRecentEntries(
  db: DbPool | null,
  params: RecentEntriesQueryParams,
  options?: {
    fetchFromRpc?: typeof fetchRecentEntriesFromRpc
    enrichSources?: typeof enrichLotteryEntrySources
    getTransaction?: (hash: `0x${string}`) => Promise<{
      from?: string
      to?: string | null
      input?: string
    } | null>
  },
): Promise<RecentEntriesQueryResult> {
  const fetchFromRpc = options?.fetchFromRpc ?? fetchRecentEntriesFromRpc
  const enrichSources = options?.enrichSources ?? enrichLotteryEntrySources
  let dataSource: RecentEntriesQueryResult['dataSource'] = 'rpc'
  let rawEvents: RawLotteryEntryEvent[] = []

  if (db) {
    try {
      const indexTip = await getLotteryIndexTipBlock(db)
      if (shouldServeLotteryFromIndex(params.fromBlock, params.toBlock, indexTip)) {
        rawEvents = await fetchRecentEntriesFromIndex(db, params)
        dataSource = 'index'
      }
    } catch (err) {
      console.warn('[lottery/recentEntries] index read failed; falling back to RPC', err)
    }
  }

  if (dataSource === 'rpc') {
    rawEvents = await fetchFromRpc(params)
  }

  const getTransaction = options?.getTransaction ?? await createRpcTransactionLookup()

  const events = await enrichSources(db, rawEvents, {
    lotteryManager: params.lotteryManager,
    getTransaction,
  })

  return { events, dataSource }
}

export { resolveRecentWinnersBlockRange as resolveRecentEntriesBlockRange }
