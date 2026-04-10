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

function setCache(res: VercelResponse, seconds: number = 60) {
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
  { type: 'function', name: 'getWhitelistedVaults', stateMutability: 'view', inputs: [], outputs: [{ type: 'address[]' }] },
  { type: 'function', name: 'getVaultWeight', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'getVaultWeightBps', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'getVaultGaugeProbabilityBoostPPM', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'getTotalWeight', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
] as const

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setPublicCors(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const g = await guardAgentApiRequest({ req, res, endpoint: 'v1/gauge/vaults', kind: 'read' })
  if (!g.ok) return

  const limiter = checkRateLimit(
    rateLimitKey('v1-gauge-vaults', g.auth?.address?.toLowerCase() ?? 'anon', getClientIp(req)),
    RATE_LIMITS.gaugeRead,
  )
  if (!limiter.allowed) return res.status(429).json({ success: false, error: 'Too many requests' })

  const contracts = getApiContracts()
  const gauge = contracts.vaultGaugeVoting
  if (!gauge) {
    return res.status(503).json({ success: false, error: 'VaultGaugeVoting not configured' })
  }

  try {
    const { createPublicClient, http } = await import('viem')
    const { base } = await import('viem/chains')
    const client = createPublicClient({ chain: base, transport: http(getReadRpcUrl(), { timeout: 20_000 }) })

    const vaults = (await client.readContract({
      address: gauge as any,
      abi: GAUGE_ABI,
      functionName: 'getWhitelistedVaults',
    })) as `0x${string}`[]

    const totalWeight = await client
      .readContract({ address: gauge as any, abi: GAUGE_ABI, functionName: 'getTotalWeight' })
      .catch(() => 0n)

    const calls: any[] = []
    for (const v of vaults) {
      calls.push({ address: gauge as any, abi: GAUGE_ABI, functionName: 'getVaultWeight', args: [v] })
      calls.push({ address: gauge as any, abi: GAUGE_ABI, functionName: 'getVaultWeightBps', args: [v] })
      calls.push({ address: gauge as any, abi: GAUGE_ABI, functionName: 'getVaultGaugeProbabilityBoostPPM', args: [v] })
    }

    const resMulti = calls.length
      ? await client.multicall({
          allowFailure: true,
          contracts: calls,
        })
      : []

    const out = vaults.map((v, i) => {
      const baseIdx = i * 3
      const w = resMulti[baseIdx + 0]?.status === 'success' ? (resMulti[baseIdx + 0] as any).result : null
      const bps = resMulti[baseIdx + 1]?.status === 'success' ? (resMulti[baseIdx + 1] as any).result : null
      const boost = resMulti[baseIdx + 2]?.status === 'success' ? (resMulti[baseIdx + 2] as any).result : null
      return {
        vault: String(v).toLowerCase(),
        weight: w == null ? null : BigInt(w as any).toString(),
        weightBps: bps == null ? null : BigInt(bps as any).toString(),
        gaugeBoostPPM: boost == null ? null : BigInt(boost as any).toString(),
      }
    })

    setCache(res, 60)
    return res.status(200).json({
      success: true,
      data: {
        chainId: 8453,
        generatedAt: new Date().toISOString(),
        vaultGaugeVoting: String(gauge).toLowerCase(),
        totalWeight: BigInt(totalWeight as any).toString(),
        vaults: out,
      },
    })
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message || 'Failed to read gauge vaults' })
  }
}
