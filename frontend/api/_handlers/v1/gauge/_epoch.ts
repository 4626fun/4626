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

const GAUGE_ABI = [
  { type: 'function', name: 'currentEpoch', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'genesisEpochStart', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'EPOCH_DURATION', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'timeUntilNextEpoch', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'getTotalGaugeProbabilityBps', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'getTotalGaugeProbabilityPPM', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
] as const

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setPublicCors(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const g = await guardAgentApiRequest({ req, res, endpoint: 'v1/gauge/epoch', kind: 'read' })
  if (!g.ok) return

  const limiter = checkRateLimit(
    rateLimitKey('v1-gauge-epoch', g.auth?.address?.toLowerCase() ?? 'anon', getClientIp(req)),
    RATE_LIMITS.gaugeRead,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Too many requests' })
  }

  const contracts = getApiContracts()
  const gauge = contracts.vaultGaugeVoting
  if (!gauge) {
    return res.status(503).json({ success: false, error: 'VaultGaugeVoting not configured' })
  }

  try {
    const { createPublicClient, http } = await import('viem')
    const { base } = await import('viem/chains')
    const client = createPublicClient({ chain: base, transport: http(getReadRpcUrl(), { timeout: 20_000 }) })

    const [currentEpoch, genesisStart, duration, until, budgetBps, budgetPpm] = await Promise.all([
      client.readContract({ address: gauge as any, abi: GAUGE_ABI, functionName: 'currentEpoch' }),
      client.readContract({ address: gauge as any, abi: GAUGE_ABI, functionName: 'genesisEpochStart' }),
      client.readContract({ address: gauge as any, abi: GAUGE_ABI, functionName: 'EPOCH_DURATION' }),
      client.readContract({ address: gauge as any, abi: GAUGE_ABI, functionName: 'timeUntilNextEpoch' }),
      client.readContract({ address: gauge as any, abi: GAUGE_ABI, functionName: 'getTotalGaugeProbabilityBps' }).catch(() => null),
      client.readContract({ address: gauge as any, abi: GAUGE_ABI, functionName: 'getTotalGaugeProbabilityPPM' }).catch(() => null),
    ])

    setCache(res, 30)
    return res.status(200).json({
      success: true,
      data: {
        chainId: 8453,
        generatedAt: new Date().toISOString(),
        vaultGaugeVoting: String(gauge).toLowerCase(),
        currentEpoch: Number(currentEpoch ?? 0n),
        genesisEpochStart: BigInt(genesisStart as any).toString(),
        epochDurationSec: BigInt(duration as any).toString(),
        timeUntilNextEpochSec: BigInt(until as any).toString(),
        gaugeProbabilityBudgetBps: budgetBps == null ? null : BigInt(budgetBps as any).toString(),
        gaugeProbabilityBudgetPPM: budgetPpm == null ? null : BigInt(budgetPpm as any).toString(),
      },
    })
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message || 'Failed to read gauge epoch' })
  }
}
