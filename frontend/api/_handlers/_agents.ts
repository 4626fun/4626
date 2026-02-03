import type { VercelRequest, VercelResponse } from '@vercel/node'

import { guardAgentApiRequest } from '../server/_lib/agentApiGuard.js'

declare const process: { env: Record<string, string | undefined> }

function setPublicCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

function setCache(res: VercelResponse, seconds: number = 60) {
  res.setHeader('Cache-Control', `public, s-maxage=${seconds}, stale-while-revalidate=${seconds * 5}`)
}

function handleOptions(req: VercelRequest, res: VercelResponse): boolean {
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return true
  }
  return false
}

/**
 * GET /api/agents
 *
 * Directory-compatible agent listing endpoint (XMTP Agent Directory shape).
 * If XMTP_AGENT_ADDRESS is configured, returns a single CreatorVault agent entry.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  setPublicCors(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const g = await guardAgentApiRequest({ req, res, endpoint: 'agents', kind: 'read' })
  if (!g.ok) return

  const addr = (process.env.XMTP_AGENT_ADDRESS ?? '').trim()
  const isAddressLike = (v: string) => /^0x[a-fA-F0-9]{40}$/.test(v)
  const agentAddress = isAddressLike(addr) ? (addr.toLowerCase() as `0x${string}`) : null

  const agents = agentAddress
    ? [
        {
          agentName: 'CreatorVault',
          agentAddress,
          agentWebsite: 'https://4626.fun',
          agentCategories: ['defi', 'analytics', 'governance', 'lottery'],
          status: 'unknown',
          lastChecked: '',
        },
      ]
    : []

  setCache(res, 60)
  return res.status(200).json({
    success: true,
    count: agents.length,
    agents,
  })
}

