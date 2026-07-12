import type { DbPool } from '../db/postgres.js'

/** Shovel greenfield start (v1.18 DeploymentBatcher window). */
export const LOTTERY_INDEX_START_BLOCK = BigInt(
  String(process.env.SHOVEL_BASE_START_BLOCK ?? '48345250').trim() || '48345250',
)

/** Index considered caught up within this many blocks of `toBlock`. */
export const LOTTERY_INDEX_TIP_SLACK_BLOCKS = 128n

export type RecentWinnerEvent =
  | {
      type: 'LotteryWinner'
      blockNumber: string
      transactionHash: string
      logIndex: number
      creatorCoin: string
      user: string
      swapAmountUsd1e6: string
      rewardAmount: string
      requestId: string
    }
  | {
      type: 'MultiTokenJackpotWon'
      blockNumber: string
      transactionHash: string
      logIndex: number
      triggeringCoin: string
      winner: string
      numVaultsPaid: string
    }

export type RecentWinnersQueryParams = {
  lotteryManager: string
  creatorCoin: string | null
  fromBlock: bigint
  toBlock: bigint
  limit: number
}

export type RecentWinnersQueryResult = {
  events: RecentWinnerEvent[]
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

/** Lottery integrations that must all have a live cursor before serving index. */
export const LOTTERY_INDEX_INTEGRATIONS = [
  'protocol_lottery_winners',
  'protocol_lottery_multi_jackpot',
  'protocol_lottery_entries',
] as const

export async function getLotteryIndexTipBlock(db: DbPool): Promise<bigint | null> {
  // Gate on the slowest *live* lottery cursor. shovel.task_updates is append-only
  // history, so bare MIN(src_num) returns the oldest retained row — wrong.
  // Correct: MIN(MAX(src_num) per integration), requiring all three present.
  const result = await db.sql<{ tip: string | null; present: string | null }>`
    select
      coalesce(min(tip), 0)::text as tip,
      count(*)::text as present
    from (
      select ig_name, max(src_num::bigint) as tip
      from shovel.task_updates
      where ig_name in (
        'protocol_lottery_winners',
        'protocol_lottery_multi_jackpot',
        'protocol_lottery_entries'
      )
      group by ig_name
    ) per_ig
  `
  const tipRaw = result.rows[0]?.tip
  const present = Number(result.rows[0]?.present ?? '0')
  if (!Number.isFinite(present) || present < LOTTERY_INDEX_INTEGRATIONS.length) return null
  if (tipRaw == null || tipRaw === '0') return null
  try {
    return BigInt(tipRaw)
  } catch {
    return null
  }
}

export function shouldServeLotteryFromIndex(
  fromBlock: bigint,
  toBlock: bigint,
  indexTip: bigint | null,
): boolean {
  if (indexTip == null) return false
  if (fromBlock < LOTTERY_INDEX_START_BLOCK) return false
  return indexTip + LOTTERY_INDEX_TIP_SLACK_BLOCKS >= toBlock
}

export async function fetchRecentWinnersFromIndex(
  db: DbPool,
  params: RecentWinnersQueryParams,
): Promise<RecentWinnerEvent[]> {
  const creator = normalizeHexAddress(params.creatorCoin)
  const fromBlock = params.fromBlock.toString()
  const toBlock = params.toBlock.toString()
  const rowLimit = Math.min(Math.max(params.limit * 2, params.limit), 400)

  const result = await db.query?.(
    `
    select *
    from (
      select
        block_num,
        tx_hash,
        log_idx,
        'LotteryWinner'::text as event_type,
        lower('0x' || encode(token, 'hex')) as creator_coin,
        lower('0x' || encode("user", 'hex')) as winner_user,
        swap_amount_usd::text as swap_amount_usd,
        reward_amount::text as reward_amount,
        request_id::text as request_id,
        null::text as triggering_coin,
        null::text as num_vaults_paid
      from protocol_lottery_winners
      where block_num >= $1::numeric
        and block_num <= $2::numeric
        and ($3::text is null or lower('0x' || encode(token, 'hex')) = $3)

      union all

      select
        block_num,
        tx_hash,
        log_idx,
        'MultiTokenJackpotWon'::text as event_type,
        null::text as creator_coin,
        lower('0x' || encode(winner, 'hex')) as winner_user,
        null::text as swap_amount_usd,
        null::text as reward_amount,
        null::text as request_id,
        lower('0x' || encode(triggering_coin, 'hex')) as triggering_coin,
        num_vaults_paid::text as num_vaults_paid
      from protocol_lottery_multi_jackpot
      where block_num >= $1::numeric
        and block_num <= $2::numeric
        and ($3::text is null or lower('0x' || encode(triggering_coin, 'hex')) = $3)
    ) combined
    order by block_num desc, log_idx desc
    limit $4
    `,
    [fromBlock, toBlock, creator, rowLimit],
  )

  if (!result) {
    throw new Error('Database query API unavailable')
  }

  return result.rows.map((row: Record<string, unknown>) => {
    const blockNumber = String(row.block_num ?? '0')
    const transactionHash = byteaToHex(row.tx_hash)
    const logIndex = Number(row.log_idx ?? 0)

    if (row.event_type === 'MultiTokenJackpotWon') {
      return {
        type: 'MultiTokenJackpotWon' as const,
        blockNumber,
        transactionHash: transactionHash.toLowerCase(),
        logIndex,
        triggeringCoin: String(row.triggering_coin ?? '').toLowerCase(),
        winner: String(row.winner_user ?? '').toLowerCase(),
        numVaultsPaid: String(row.num_vaults_paid ?? '0'),
      }
    }

    return {
      type: 'LotteryWinner' as const,
      blockNumber,
      transactionHash: transactionHash.toLowerCase(),
      logIndex,
      creatorCoin: String(row.creator_coin ?? '').toLowerCase(),
      user: String(row.winner_user ?? '').toLowerCase(),
      swapAmountUsd1e6: String(row.swap_amount_usd ?? '0'),
      rewardAmount: String(row.reward_amount ?? '0'),
      requestId: String(row.request_id ?? '0'),
    }
  }).slice(0, params.limit)
}

function getLogsRpcUrl(): string {
  const logs = (process.env.BASE_LOGS_RPC_URL ?? '').trim()
  if (logs) return logs
  const rpc = (process.env.BASE_RPC_URL ?? '').trim()
  if (rpc) return rpc
  return 'https://base.meowrpc.com'
}

const LOTTERY_WINNER_EVENT =
  'event LotteryWinner(address indexed creatorCoin,address indexed user,uint256 swapAmountUSD,uint256 rewardAmount,uint256 requestId)'
const MULTI_TOKEN_EVENT =
  'event MultiTokenJackpotWon(address indexed triggeringCoin,address indexed winner,uint256 numVaultsPaid)'

export async function fetchRecentWinnersFromRpc(
  params: RecentWinnersQueryParams,
): Promise<RecentWinnerEvent[]> {
  const { createPublicClient, http, parseAbiItem } = await import('viem')
  const { base } = await import('viem/chains')

  const client = createPublicClient({
    chain: base,
    transport: http(getLogsRpcUrl(), { timeout: 25_000 }),
  })

  const winnerEvent = parseAbiItem(LOTTERY_WINNER_EVENT)
  const multiEvent = parseAbiItem(MULTI_TOKEN_EVENT)
  const lotteryManager = params.lotteryManager as `0x${string}`

  const [winnerLogs, multiLogs] = await Promise.all([
    client.getLogs({
      address: lotteryManager,
      event: winnerEvent,
      args: params.creatorCoin ? { creatorCoin: params.creatorCoin as `0x${string}` } : undefined,
      fromBlock: params.fromBlock,
      toBlock: params.toBlock,
    }),
    client.getLogs({
      address: lotteryManager,
      event: multiEvent,
      args: params.creatorCoin ? { triggeringCoin: params.creatorCoin as `0x${string}` } : undefined,
      fromBlock: params.fromBlock,
      toBlock: params.toBlock,
    }).catch(() => []),
  ])

  const normalize = (l: {
    blockNumber?: bigint | null
    transactionHash?: string
    logIndex?: number | bigint | null
  }) => ({
    blockNumber: (l.blockNumber ?? 0n).toString(),
    transactionHash: String(l.transactionHash ?? '').toLowerCase(),
    logIndex: typeof l.logIndex === 'number' ? l.logIndex : Number(l.logIndex ?? 0),
  })

  const winners: RecentWinnerEvent[] = winnerLogs.map((l) => ({
    ...normalize(l),
    type: 'LotteryWinner' as const,
    creatorCoin: String(l.args?.creatorCoin ?? '').toLowerCase(),
    user: String(l.args?.user ?? '').toLowerCase(),
    swapAmountUsd1e6: (l.args?.swapAmountUSD ?? 0n).toString(),
    rewardAmount: (l.args?.rewardAmount ?? 0n).toString(),
    requestId: (l.args?.requestId ?? 0n).toString(),
  }))

  const multi: RecentWinnerEvent[] = multiLogs.map((l) => ({
    ...normalize(l),
    type: 'MultiTokenJackpotWon' as const,
    triggeringCoin: String(l.args?.triggeringCoin ?? '').toLowerCase(),
    winner: String(l.args?.winner ?? '').toLowerCase(),
    numVaultsPaid: (l.args?.numVaultsPaid ?? 0n).toString(),
  }))

  return [...winners, ...multi]
    .sort((a, b) => {
      const ab = BigInt(a.blockNumber)
      const bb = BigInt(b.blockNumber)
      if (ab === bb) return (b.logIndex ?? 0) - (a.logIndex ?? 0)
      return ab > bb ? -1 : 1
    })
    .slice(0, params.limit)
}

export async function resolveRecentWinners(
  db: DbPool | null,
  params: RecentWinnersQueryParams,
  options?: { fetchFromRpc?: typeof fetchRecentWinnersFromRpc },
): Promise<RecentWinnersQueryResult> {
  const fetchFromRpc = options?.fetchFromRpc ?? fetchRecentWinnersFromRpc

  if (db) {
    try {
      const indexTip = await getLotteryIndexTipBlock(db)
      if (shouldServeLotteryFromIndex(params.fromBlock, params.toBlock, indexTip)) {
        const events = await fetchRecentWinnersFromIndex(db, params)
        return { events, dataSource: 'index' }
      }
    } catch (err) {
      console.warn('[lottery/recentWinners] index read failed; falling back to RPC', err)
    }
  }

  const events = await fetchFromRpc(params)
  return { events, dataSource: 'rpc' }
}

export async function resolveRecentWinnersBlockRange(
  fromBlockQ: bigint | null,
  toBlockQ: bigint | null,
): Promise<{ fromBlock: bigint; toBlock: bigint }> {
  const { createPublicClient, http } = await import('viem')
  const { base } = await import('viem/chains')
  const client = createPublicClient({
    chain: base,
    transport: http(getLogsRpcUrl(), { timeout: 25_000 }),
  })

  const MAX_LOOKBACK_BLOCKS = 500_000n
  const latest = await client.getBlockNumber()
  const toBlock = toBlockQ && toBlockQ <= latest ? toBlockQ : latest
  const defaultFrom = toBlock > MAX_LOOKBACK_BLOCKS ? toBlock - MAX_LOOKBACK_BLOCKS : 0n
  const fromBlock = fromBlockQ !== null ? (fromBlockQ < defaultFrom ? defaultFrom : fromBlockQ) : defaultFrom
  return { fromBlock, toBlock }
}
