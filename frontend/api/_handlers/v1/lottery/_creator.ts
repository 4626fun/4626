import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  handleOptions,
  getApiContracts,
  guardAgentApiRequest,
  getClientIp,
  RATE_LIMITS,
  checkRateLimit,
  rateLimitKey,
} from '../../../../packages/server-core/src/index.js'




declare const process: { env: Record<string, string | undefined> }

function setPublicCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

function setCache(res: VercelResponse, seconds: number = 30) {
  res.setHeader('Cache-Control', `public, s-maxage=${seconds}, stale-while-revalidate=${seconds * 2}`)
}

function getReadRpcUrl(): string {
  const read = (process.env.BASE_READ_RPC_URL ?? '').trim()
  if (read) return read
  const rpc = (process.env.BASE_RPC_URL ?? '').trim()
  if (rpc) return rpc
  return 'https://mainnet.base.org'
}

function isAddressLike(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

function getCreatorCoinParam(req: VercelRequest): string {
  const v =
    (typeof req.query?.creatorCoin === 'string'
      ? req.query.creatorCoin
      : typeof req.query?.address === 'string'
        ? req.query.address
        : '').trim()
  return v
}

const LOTTERY_ABI = [
  {
    type: 'function',
    name: 'getCreatorLotteryStats',
    stateMutability: 'view',
    inputs: [{ name: 'creatorCoin', type: 'address' }],
    outputs: [{ type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }],
  },
] as const

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setPublicCors(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const g = await guardAgentApiRequest({ req, res, endpoint: 'v1/lottery/creator', kind: 'read' })
  if (!g.ok) return

  const limiter = checkRateLimit(
    rateLimitKey('v1-lottery-creator', g.auth?.address?.toLowerCase() ?? 'anon', getClientIp(req)),
    RATE_LIMITS.lotteryRead,
  )
  if (!limiter.allowed) return res.status(429).json({ success: false, error: 'Too many requests' })

  const creatorCoin = getCreatorCoinParam(req)
  if (!creatorCoin) return res.status(400).json({ success: false, error: 'creatorCoin is required' })
  if (!isAddressLike(creatorCoin)) return res.status(400).json({ success: false, error: 'Invalid creatorCoin address' })

  const contracts = getApiContracts()
  const lotteryManager = contracts.lotteryManager
  if (!lotteryManager) {
    return res.status(503).json({ success: false, error: 'Lottery manager not configured' })
  }

  try {
    const { createPublicClient, http } = await import('viem')
    const { base } = await import('viem/chains')

    const client = createPublicClient({
      chain: base,
      transport: http(getReadRpcUrl(), { timeout: 20_000 }),
    })

    const stats = await client.readContract({
      address: lotteryManager as any,
      abi: LOTTERY_ABI,
      functionName: 'getCreatorLotteryStats',
      args: [creatorCoin as any],
    })

    const entries = BigInt((stats as any)?.[0] ?? 0n).toString()
    const winners = BigInt((stats as any)?.[1] ?? 0n).toString()
    const rewardsPaid = BigInt((stats as any)?.[2] ?? 0n).toString()
    const jackpotBalanceShares = BigInt((stats as any)?.[3] ?? 0n).toString()

    setCache(res, 30)
    return res.status(200).json({
      success: true,
      data: {
        chainId: 8453,
        generatedAt: new Date().toISOString(),
        lotteryManager: String(lotteryManager).toLowerCase(),
        creatorCoin: creatorCoin.toLowerCase(),
        entries,
        winners,
        rewardsPaid,
        jackpotBalanceShares,
      },
    })
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message || 'Failed to read creator lottery stats' })
  }
}
