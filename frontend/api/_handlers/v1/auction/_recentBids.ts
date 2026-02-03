import type { VercelRequest, VercelResponse } from '@vercel/node'

import { handleOptions } from '../../../server/auth/_shared.js'
import { guardAgentApiRequest } from '../../../server/_lib/agentApiGuard.js'

declare const process: { env: Record<string, string | undefined> }

function setPublicCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

function setCache(res: VercelResponse, seconds: number = 30) {
  res.setHeader('Cache-Control', `public, s-maxage=${seconds}, stale-while-revalidate=${seconds * 2}`)
}

function isAddressLike(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

function getLogsRpcUrl(): string {
  const logs = (process.env.BASE_LOGS_RPC_URL ?? '').trim()
  if (logs) return logs
  const rpc = (process.env.BASE_RPC_URL ?? '').trim()
  if (rpc) return rpc
  return 'https://base.meowrpc.com'
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

const BID_SUBMITTED_EVENT =
  'event BidSubmitted(uint256 indexed id,address indexed owner,uint256 price,uint256 amount)'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setPublicCors(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const g = await guardAgentApiRequest({ req, res, endpoint: 'v1/auction/recentBids', kind: 'logs' })
  if (!g.ok) return

  const auction = (getStringQuery(req, 'auction') || getStringQuery(req, 'address') || '').trim()
  if (!auction) return res.status(400).json({ success: false, error: 'auction is required' })
  if (!isAddressLike(auction)) return res.status(400).json({ success: false, error: 'Invalid auction address' })

  const limit = clampInt(getStringQuery(req, 'limit'), 25, 1, 200)
  const fromBlockQ = parseBlock(getStringQuery(req, 'fromBlock'))
  const toBlockQ = parseBlock(getStringQuery(req, 'toBlock'))

  // Safety caps (avoid RPC griefing)
  const MAX_LOOKBACK_BLOCKS = 200_000n

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

    const event = parseAbiItem(BID_SUBMITTED_EVENT)

    const logs = await client.getLogs({
      address: auction as any,
      event: event as any,
      fromBlock,
      toBlock,
    })

    const trimmed = logs
      .slice(-limit)
      .reverse()
      .map((l: any) => ({
        blockNumber: (l.blockNumber ?? 0n).toString(),
        transactionHash: String(l.transactionHash ?? ''),
        logIndex: typeof l.logIndex === 'number' ? l.logIndex : Number(l.logIndex ?? 0),
        id: (l.args?.id ?? 0n).toString(),
        owner: String(l.args?.owner ?? '').toLowerCase(),
        priceQ96: (l.args?.price ?? 0n).toString(),
        amount: (l.args?.amount ?? 0n).toString(),
      }))

    setCache(res, 30)
    return res.status(200).json({
      success: true,
      data: {
        chainId: 8453,
        generatedAt: new Date().toISOString(),
        auction: auction.toLowerCase(),
        fromBlock: fromBlock.toString(),
        toBlock: toBlock.toString(),
        limit,
        bids: trimmed,
      },
    })
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message || 'Failed to read bid logs' })
  }
}

