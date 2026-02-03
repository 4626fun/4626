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

const VE_ABI = [
  {
    type: 'function',
    name: 'getLock',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [
      {
        name: 'lock',
        type: 'tuple',
        components: [
          { name: 'amount', type: 'uint256' },
          { name: 'end', type: 'uint256' },
          { name: 'start', type: 'uint256' },
          { name: 'lockedToken', type: 'address' },
          { name: 'underlyingValue', type: 'uint256' },
        ],
      },
    ],
  },
  { type: 'function', name: 'getVotingPower', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'hasActiveLock', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'getRemainingLockTime', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] },
] as const

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setPublicCors(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const g = await guardAgentApiRequest({ req, res, endpoint: 'v1/ve4626/user', kind: 'read' })
  if (!g.ok) return

  const user = getUserParam(req)
  if (!user) return res.status(400).json({ success: false, error: 'user is required' })
  if (!isAddressLike(user)) return res.status(400).json({ success: false, error: 'Invalid user address' })

  const contracts = getApiContracts()
  const ve = contracts.ve4626
  if (!ve) {
    return res.status(503).json({ success: false, error: 've4626 not configured' })
  }

  try {
    const { createPublicClient, http } = await import('viem')
    const { base } = await import('viem/chains')
    const client = createPublicClient({ chain: base, transport: http(getReadRpcUrl(), { timeout: 20_000 }) })

    const [lock, power, active, remaining] = await Promise.all([
      client.readContract({ address: ve as any, abi: VE_ABI, functionName: 'getLock', args: [user as any] }).catch(() => null),
      client.readContract({ address: ve as any, abi: VE_ABI, functionName: 'getVotingPower', args: [user as any] }).catch(() => 0n),
      client.readContract({ address: ve as any, abi: VE_ABI, functionName: 'hasActiveLock', args: [user as any] }).catch(() => false),
      client.readContract({ address: ve as any, abi: VE_ABI, functionName: 'getRemainingLockTime', args: [user as any] }).catch(() => 0n),
    ])

    const l = (lock as any)?.amount !== undefined ? (lock as any) : (lock as any)?.[0]
    const amount = l?.amount != null ? BigInt(l.amount).toString() : '0'
    const end = l?.end != null ? BigInt(l.end).toString() : '0'
    const start = l?.start != null ? BigInt(l.start).toString() : '0'
    const lockedToken = typeof l?.lockedToken === 'string' && isAddressLike(l.lockedToken) ? l.lockedToken.toLowerCase() : null
    const underlyingValue = l?.underlyingValue != null ? BigInt(l.underlyingValue).toString() : null

    setCache(res, 30)
    return res.status(200).json({
      success: true,
      data: {
        chainId: 8453,
        generatedAt: new Date().toISOString(),
        ve4626: String(ve).toLowerCase(),
        user: user.toLowerCase(),
        votingPower: BigInt(power as any).toString(),
        hasActiveLock: Boolean(active),
        remainingLockTimeSec: BigInt(remaining as any).toString(),
        lock: { amount, start, end, lockedToken, underlyingValue },
      },
    })
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message || 'Failed to read ve4626 state' })
  }
}

