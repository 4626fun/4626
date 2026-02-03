import type { VercelRequest, VercelResponse } from '@vercel/node'

import { handleOptions } from '../../../server/auth/_shared.js'
import { getApiContracts } from '../../../server/_lib/contracts.js'
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

function getReadRpcUrl(): string {
  const read = (process.env.BASE_READ_RPC_URL ?? '').trim()
  if (read) return read
  const rpc = (process.env.BASE_RPC_URL ?? '').trim()
  if (rpc) return rpc
  return 'https://mainnet.base.org'
}

const LOTTERY_ABI = [
  { type: 'function', name: 'getGlobalStats', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }] },
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
] as const

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setPublicCors(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const g = await guardAgentApiRequest({ req, res, endpoint: 'v1/lottery/global', kind: 'read' })
  if (!g.ok) return

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

    const [stats, cfg, minVaultWeightBps] = await Promise.all([
      client.readContract({ address: lotteryManager as any, abi: LOTTERY_ABI, functionName: 'getGlobalStats' }),
      client.readContract({ address: lotteryManager as any, abi: LOTTERY_ABI, functionName: 'lotteryConfig' }),
      client.readContract({ address: lotteryManager as any, abi: LOTTERY_ABI, functionName: 'minVaultWeightBps' }).catch(() => null),
    ])

    const entries = BigInt((stats as any)?.[0] ?? 0n).toString()
    const winners = BigInt((stats as any)?.[1] ?? 0n).toString()
    const rewardsPaid = BigInt((stats as any)?.[2] ?? 0n).toString()

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
        },
      },
    })
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message || 'Failed to read lottery stats' })
  }
}

