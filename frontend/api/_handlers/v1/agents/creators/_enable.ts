import type { VercelRequest, VercelResponse } from '@vercel/node'

import { handleOptions, readJsonBody, readSessionFromRequest } from '../../../../server/auth/_shared.js'
import { guardAgentApiRequest } from '../../../../server/_lib/agentApiGuard.js'
import { getOrCreateCreatorXmtpAgent } from '../../../../server/_lib/creatorXmtpAgents.js'

function setPublicCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setPublicCors(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' })

  const g = await guardAgentApiRequest({ req, res, endpoint: 'v1/agents/creators/enable', kind: 'build' })
  if (!g.ok) return

  const session = readSessionFromRequest(req)
  const creator = session?.address ? String(session.address).toLowerCase() : ''
  if (!creator) return res.status(401).json({ success: false, error: 'Sign in required' })

  const body = (await readJsonBody<{ listedPublicly?: boolean }>(req)) ?? {}
  const listedPublicly = typeof body.listedPublicly === 'boolean' ? body.listedPublicly : true

  try {
    const row = await getOrCreateCreatorXmtpAgent({
      creatorAddress: creator as `0x${string}`,
      listedPublicly,
    })
    return res.status(200).json({
      success: true,
      data: {
        creatorAddress: row.creatorAddress,
        xmtpAgentAddress: row.xmtpAgentAddress,
        listedPublicly: row.listedPublicly,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
    })
  } catch (e: any) {
    const msg = e?.message ? String(e.message) : 'Failed to enable creator XMTP agent'
    const code = msg.includes('db_not_configured') ? 503 : msg.includes('XMTP_AGENT_KEY_ENCRYPTION_KEY') ? 500 : 500
    return res.status(code).json({ success: false, error: msg })
  }
}

