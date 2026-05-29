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
import { resolveAmoeCreatorTarget } from '../../../../server/_lib/lottery/amoeCreatorTarget.js'




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

function formatUsd(value: bigint): string {
  const whole = value / 1_000_000n
  const fraction = value % 1_000_000n
  if (fraction === 0n) return whole.toString()
  return `${whole.toString()}.${fraction.toString().padStart(6, '0').replace(/0+$/, '')}`
}

function creatorAssetsToUsd1e6(params: {
  assets1e18: bigint
  priceUsd1e18: bigint
}): bigint {
  return (params.assets1e18 * params.priceUsd1e18) / 1_000_000_000_000_000_000_000_000_000_000n
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

const REGISTRY_ABI = [
  {
    type: 'function',
    name: 'getVaultForToken',
    stateMutability: 'view',
    inputs: [{ name: 'token', type: 'address' }],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'getOracleForToken',
    stateMutability: 'view',
    inputs: [{ name: 'token', type: 'address' }],
    outputs: [{ type: 'address' }],
  },
] as const

const VAULT_ABI = [
  {
    type: 'function',
    name: 'convertToAssets',
    stateMutability: 'view',
    inputs: [{ name: 'shares', type: 'uint256' }],
    outputs: [{ type: 'uint256' }],
  },
] as const

const ORACLE_ABI = [
  {
    type: 'function',
    name: 'getCreatorPrice',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'int256' }, { type: 'uint256' }],
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
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Too many requests' })
  }

  const creatorTarget = resolveAmoeCreatorTarget(getCreatorCoinParam(req))
  if (!creatorTarget.ok) {
    const status = creatorTarget.error === 'invalid_creator_coin' ? 400 : 503
    return res.status(status).json({
      success: false,
      error: creatorTarget.error === 'invalid_creator_coin' ? 'Invalid creatorCoin address' : creatorTarget.error,
    })
  }
  const creatorCoin = creatorTarget.creatorCoin

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
    let jackpotUsd: string | null = null

    if (BigInt(jackpotBalanceShares) > 0n && isAddressLike(String(contracts.registry ?? ''))) {
      const [vaultAddr, oracleAddr] = await Promise.all([
        client.readContract({
          address: contracts.registry as any,
          abi: REGISTRY_ABI,
          functionName: 'getVaultForToken',
          args: [creatorCoin as any],
        }).catch(() => null),
        client.readContract({
          address: contracts.registry as any,
          abi: REGISTRY_ABI,
          functionName: 'getOracleForToken',
          args: [creatorCoin as any],
        }).catch(() => null),
      ])
      if (typeof vaultAddr === 'string' && isAddressLike(vaultAddr) && typeof oracleAddr === 'string' && isAddressLike(oracleAddr)) {
        const [jackpotAssets, priceResult] = await Promise.all([
          client.readContract({
            address: vaultAddr as any,
            abi: VAULT_ABI,
            functionName: 'convertToAssets',
            args: [BigInt(jackpotBalanceShares)],
          }).catch(() => null),
          client.readContract({
            address: oracleAddr as any,
            abi: ORACLE_ABI,
            functionName: 'getCreatorPrice',
          }).catch(() => null),
        ])
        const priceUsd1e18 = BigInt((priceResult as any)?.[0] ?? 0n)
        if (typeof jackpotAssets === 'bigint' && jackpotAssets > 0n && priceUsd1e18 > 0n) {
          jackpotUsd = formatUsd(creatorAssetsToUsd1e6({ assets1e18: jackpotAssets, priceUsd1e18 }))
        }
      }
    }

    setCache(res, 30)
    return res.status(200).json({
      success: true,
      data: {
        chainId: 8453,
        generatedAt: new Date().toISOString(),
        lotteryManager: String(lotteryManager).toLowerCase(),
        creatorCoin: creatorCoin.toLowerCase(),
        creatorCoinSource: creatorTarget.source,
        entries,
        winners,
        rewardsPaid,
        jackpotBalanceShares,
        jackpotUsd,
      },
    })
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message || 'Failed to read creator lottery stats' })
  }
}

export const __testHooks = {
  creatorAssetsToUsd1e6,
  formatUsd,
}
