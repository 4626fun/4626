import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  handleOptions,
  getApiContracts,
  guardAgentApiRequest,
} from '../../../../packages/server-core/src/index.js'




declare const process: { env: Record<string, string | undefined> }

function setPublicCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

function setCache(res: VercelResponse, seconds: number = 60) {
  res.setHeader('Cache-Control', `public, s-maxage=${seconds}, stale-while-revalidate=${seconds * 2}`)
}

function getLogsRpcUrl(): string {
  const logs = (process.env.BASE_LOGS_RPC_URL ?? '').trim()
  if (logs) return logs
  const rpc = (process.env.BASE_RPC_URL ?? '').trim()
  if (rpc) return rpc
  return 'https://base.meowrpc.com'
}

function isAddressLike(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

function getStringQuery(req: VercelRequest, key: string): string | null {
  const v = req.query?.[key]
  if (typeof v === 'string' && v.trim()) return v.trim()
  return null
}

function parseBlock(value: string | null): bigint | null {
  if (!value) return null
  const s = value.trim().toLowerCase()
  try {
    if (s.startsWith('0x')) return BigInt(s)
    const n = BigInt(Math.floor(Number(s)))
    return n >= 0n ? n : null
  } catch {
    return null
  }
}

function clampInt(value: string | null, def: number, min: number, max: number): number {
  const n = value ? Number(value) : NaN
  if (!Number.isFinite(n)) return def
  const i = Math.floor(n)
  return Math.max(min, Math.min(max, i))
}

const LOTTERY_WINNER_EVENT =
  'event LotteryWinner(address indexed creatorCoin,address indexed user,uint256 swapAmountUSD,uint256 rewardAmount,uint256 requestId)'
const MULTI_TOKEN_EVENT =
  'event MultiTokenJackpotWon(address indexed triggeringCoin,address indexed winner,uint256 numVaultsPaid)'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setPublicCors(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const g = await guardAgentApiRequest({ req, res, endpoint: 'v1/lottery/recentWinners', kind: 'logs' })
  if (!g.ok) return

  const creatorCoin = (getStringQuery(req, 'creatorCoin') || '').trim()
  if (creatorCoin && !isAddressLike(creatorCoin)) {
    return res.status(400).json({ success: false, error: 'Invalid creatorCoin address' })
  }

  const limit = clampInt(getStringQuery(req, 'limit'), 25, 1, 200)
  const fromBlockQ = parseBlock(getStringQuery(req, 'fromBlock'))
  const toBlockQ = parseBlock(getStringQuery(req, 'toBlock'))

  const contracts = getApiContracts()
  const lotteryManager = contracts.lotteryManager
  if (!lotteryManager) {
    return res.status(503).json({ success: false, error: 'Lottery manager not configured' })
  }

  // Safety caps (avoid RPC griefing)
  const MAX_LOOKBACK_BLOCKS = 500_000n

  try {
    const { createPublicClient, http, parseAbiItem } = await import('viem')
    const { base } = await import('viem/chains')

    const client = createPublicClient({
      chain: base,
      transport: http(getLogsRpcUrl(), { timeout: 25_000 }),
    })

    const latest = await client.getBlockNumber()
    const toBlock = toBlockQ && toBlockQ <= latest ? toBlockQ : latest
    const defaultFrom = toBlock > MAX_LOOKBACK_BLOCKS ? toBlock - MAX_LOOKBACK_BLOCKS : 0n
    const fromBlock = fromBlockQ !== null ? (fromBlockQ < defaultFrom ? defaultFrom : fromBlockQ) : defaultFrom

    const winnerEvent = parseAbiItem(LOTTERY_WINNER_EVENT)
    const multiEvent = parseAbiItem(MULTI_TOKEN_EVENT)

    const [winnerLogs, multiLogs] = await Promise.all([
      client.getLogs({
        address: lotteryManager as any,
        event: winnerEvent as any,
        args: creatorCoin ? ({ creatorCoin } as any) : undefined,
        fromBlock,
        toBlock,
      }),
      client.getLogs({
        address: lotteryManager as any,
        event: multiEvent as any,
        args: creatorCoin ? ({ triggeringCoin: creatorCoin } as any) : undefined,
        fromBlock,
        toBlock,
      }).catch(() => []),
    ])

    const normalize = (l: any) => ({
      blockNumber: (l.blockNumber ?? 0n).toString(),
      transactionHash: String(l.transactionHash ?? ''),
      logIndex: typeof l.logIndex === 'number' ? l.logIndex : Number(l.logIndex ?? 0),
    })

    const winners = (winnerLogs as any[])
      .map((l) => ({
        ...normalize(l),
        type: 'LotteryWinner' as const,
        creatorCoin: String(l.args?.creatorCoin ?? '').toLowerCase(),
        user: String(l.args?.user ?? '').toLowerCase(),
        swapAmountUsd1e6: (l.args?.swapAmountUSD ?? 0n).toString(),
        rewardAmount: (l.args?.rewardAmount ?? 0n).toString(),
        requestId: (l.args?.requestId ?? 0n).toString(),
      }))

    const multi = (multiLogs as any[])
      .map((l) => ({
        ...normalize(l),
        type: 'MultiTokenJackpotWon' as const,
        triggeringCoin: String(l.args?.triggeringCoin ?? '').toLowerCase(),
        winner: String(l.args?.winner ?? '').toLowerCase(),
        numVaultsPaid: (l.args?.numVaultsPaid ?? 0n).toString(),
      }))

    const combined = [...winners, ...multi]
      .sort((a, b) => {
        const ab = BigInt(a.blockNumber)
        const bb = BigInt(b.blockNumber)
        if (ab === bb) return (b.logIndex ?? 0) - (a.logIndex ?? 0)
        return ab > bb ? -1 : 1
      })
      .slice(0, limit)

    setCache(res, 60)
    return res.status(200).json({
      success: true,
      data: {
        chainId: 8453,
        generatedAt: new Date().toISOString(),
        lotteryManager: String(lotteryManager).toLowerCase(),
        creatorCoin: creatorCoin ? creatorCoin.toLowerCase() : null,
        fromBlock: fromBlock.toString(),
        toBlock: toBlock.toString(),
        limit,
        events: combined,
      },
    })
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message || 'Failed to read winner logs' })
  }
}

