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

function isAddressLike(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

function getUserParam(req: VercelRequest): string {
  const v = (typeof req.query?.user === 'string' ? req.query.user : typeof req.query?.address === 'string' ? req.query.address : '').trim()
  return v
}

const GAUGE_ABI = [
  { type: 'function', name: 'getUserVotes', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'address[]' }, { type: 'uint256[]' }] },
  { type: 'function', name: 'hasVotedThisEpoch', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'currentEpoch', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
] as const

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setPublicCors(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const g = await guardAgentApiRequest({ req, res, endpoint: 'v1/gauge/user', kind: 'read' })
  if (!g.ok) return

  const user = getUserParam(req)
  if (!user) return res.status(400).json({ success: false, error: 'user is required' })
  if (!isAddressLike(user)) return res.status(400).json({ success: false, error: 'Invalid user address' })

  const contracts = getApiContracts()
  const gauge = contracts.vaultGaugeVoting
  if (!gauge) {
    return res.status(503).json({ success: false, error: 'VaultGaugeVoting not configured' })
  }

  try {
    const { createPublicClient, http } = await import('viem')
    const { base } = await import('viem/chains')
    const client = createPublicClient({ chain: base, transport: http(getReadRpcUrl(), { timeout: 20_000 }) })

    const [votes, hasVoted, epoch] = await Promise.all([
      client.readContract({ address: gauge as any, abi: GAUGE_ABI, functionName: 'getUserVotes', args: [user as any] }),
      client.readContract({ address: gauge as any, abi: GAUGE_ABI, functionName: 'hasVotedThisEpoch', args: [user as any] }).catch(() => false),
      client.readContract({ address: gauge as any, abi: GAUGE_ABI, functionName: 'currentEpoch' }).catch(() => 0n),
    ])

    const vaults = ((votes as any)?.[0] ?? []) as string[]
    const weights = ((votes as any)?.[1] ?? []) as (bigint | string | number)[]

    const parsed = vaults.map((v, i) => ({
      vault: String(v).toLowerCase(),
      weight: BigInt(weights[i] as any).toString(),
    }))

    setCache(res, 30)
    return res.status(200).json({
      success: true,
      data: {
        chainId: 8453,
        generatedAt: new Date().toISOString(),
        vaultGaugeVoting: String(gauge).toLowerCase(),
        user: user.toLowerCase(),
        currentEpoch: Number(epoch ?? 0n),
        hasVotedThisEpoch: Boolean(hasVoted),
        votes: parsed,
      },
    })
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message || 'Failed to read user votes' })
  }
}

