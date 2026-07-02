import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  handleOptions,
  getApiContracts,
  guardAgentApiRequest,
  getClientIp,
  RATE_LIMITS,
  checkRateLimit,
  rateLimitKey,
} from '@4626/server-core'




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

const LOTTERY_ABI = [
  { type: 'function', name: 'totalLotteryEntries', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'totalWinners', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'totalRewardsPaid', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  {
    type: 'function',
    name: 'lotteryConfig',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'minSwapAmount', type: 'uint256' },
      { name: 'rewardPercentage', type: 'uint256' },
      { name: 'isActive', type: 'bool' },
      { name: 'baseWinChance', type: 'uint256' },
      { name: 'maxWinChance', type: 'uint256' },
      { name: 'usdMultiplierBps', type: 'uint256' },
    ],
  },
  { type: 'function', name: 'minVaultWeightBps', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'amoeEnabled', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'amoeSigner', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  {
    type: 'function',
    name: 'amoeMaxEntriesPerBuyerPerEpoch',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint32' }],
  },
  { type: 'function', name: 'amoeEpochDuration', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'totalTradeEntries', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'totalAmoeEntries', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
] as const

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setPublicCors(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const g = await guardAgentApiRequest({ req, res, endpoint: 'v1/lottery/global', kind: 'read' })
  if (!g.ok) return

  const limiter = checkRateLimit(
    rateLimitKey('v1-lottery-global', g.auth?.address?.toLowerCase() ?? 'anon', getClientIp(req)),
    RATE_LIMITS.lotteryRead,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Too many requests' })
  }

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

    const [totalLotteryEntries, totalWinners, totalRewardsPaid, cfg, minVaultWeightBps, amoeEnabled, amoeSigner, amoeMaxEntries, amoeEpochDuration, totalTradeEntries, totalAmoeEntries] =
      await Promise.all([
      client.readContract({ address: lotteryManager as any, abi: LOTTERY_ABI, functionName: 'totalLotteryEntries' }),
      client.readContract({ address: lotteryManager as any, abi: LOTTERY_ABI, functionName: 'totalWinners' }),
      client.readContract({ address: lotteryManager as any, abi: LOTTERY_ABI, functionName: 'totalRewardsPaid' }),
      client.readContract({ address: lotteryManager as any, abi: LOTTERY_ABI, functionName: 'lotteryConfig' }),
      client.readContract({ address: lotteryManager as any, abi: LOTTERY_ABI, functionName: 'minVaultWeightBps' }).catch(() => null),
      client.readContract({ address: lotteryManager as any, abi: LOTTERY_ABI, functionName: 'amoeEnabled' }).catch(() => null),
      client.readContract({ address: lotteryManager as any, abi: LOTTERY_ABI, functionName: 'amoeSigner' }).catch(() => null),
      client.readContract({
        address: lotteryManager as any,
        abi: LOTTERY_ABI,
        functionName: 'amoeMaxEntriesPerBuyerPerEpoch',
      }).catch(() => null),
      client.readContract({ address: lotteryManager as any, abi: LOTTERY_ABI, functionName: 'amoeEpochDuration' }).catch(() => null),
      client.readContract({ address: lotteryManager as any, abi: LOTTERY_ABI, functionName: 'totalTradeEntries' }).catch(() => null),
      client.readContract({ address: lotteryManager as any, abi: LOTTERY_ABI, functionName: 'totalAmoeEntries' }).catch(() => null),
    ])

    const entries = BigInt(totalLotteryEntries ?? 0n).toString()
    const winners = BigInt(totalWinners ?? 0n).toString()
    const rewardsPaid = BigInt(totalRewardsPaid ?? 0n).toString()

    const minSwapAmount = BigInt((cfg as any)?.minSwapAmount ?? (cfg as any)?.[0] ?? 0n).toString()
    const rewardPercentageBps = BigInt((cfg as any)?.rewardPercentage ?? (cfg as any)?.[1] ?? 0n).toString()
    const isActive = Boolean((cfg as any)?.isActive ?? (cfg as any)?.[2] ?? false)
    const baseWinChancePPM = BigInt((cfg as any)?.baseWinChance ?? (cfg as any)?.[3] ?? 0n).toString()
    const maxWinChancePPM = BigInt((cfg as any)?.maxWinChance ?? (cfg as any)?.[4] ?? 0n).toString()
    const usdMultiplierBps = BigInt((cfg as any)?.usdMultiplierBps ?? (cfg as any)?.[5] ?? 0n).toString()

    setCache(res, 30)
    return res.status(200).json({
      success: true,
      data: {
        chainId: 8453,
        generatedAt: new Date().toISOString(),
        lotteryManager: String(lotteryManager).toLowerCase(),
        stats: { entries, winners, rewardsPaid },
        config: {
          minSwapAmountUsd1e6: minSwapAmount,
          rewardPercentageBps,
          isActive,
          baseWinChancePPM,
          maxWinChancePPM,
          usdMultiplierBps,
          minVaultWeightBps: minVaultWeightBps == null ? null : BigInt(minVaultWeightBps as any).toString(),
          amoe: {
            enabled: amoeEnabled == null ? null : Boolean(amoeEnabled),
            signer: typeof amoeSigner === 'string' ? String(amoeSigner).toLowerCase() : null,
            maxEntriesPerBuyerPerEpoch: amoeMaxEntries == null ? null : String(amoeMaxEntries),
            epochDurationSeconds: amoeEpochDuration == null ? null : BigInt(amoeEpochDuration as any).toString(),
          },
          entrySources: {
            trade: totalTradeEntries == null ? null : BigInt(totalTradeEntries as any).toString(),
            amoe: totalAmoeEntries == null ? null : BigInt(totalAmoeEntries as any).toString(),
          },
        },
      },
    })
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message || 'Failed to read lottery stats' })
  }
}
