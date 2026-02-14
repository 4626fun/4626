import type { VercelRequest, VercelResponse } from '@vercel/node'

import { handleOptions, readJsonBody } from '../../../../server/auth/_shared.js'
import { guardAgentApiRequest } from '../../../../server/_lib/agentApiGuard.js'
import { resolveCanonicalSmartWalletAddress } from '../../../../../server/_lib/canonicalWalletResolver.js'
import { getOrCreateCreatorXmtpAgent, enableCswAgent } from '../../../../server/_lib/creatorXmtpAgents.js'

function setPublicCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-SIWA-Receipt')
}

type EnableBody = {
  listedPublicly?: boolean
  agentType?: 'eoa' | 'csw'
  cswAddress?: string
  privyWalletId?: string
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setPublicCors(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' })

  const g = await guardAgentApiRequest({ req, res, endpoint: 'v1/agents/creators/enable', kind: 'build' })
  if (!g.ok) return

  const creator = g.auth?.address ? String(g.auth.address).toLowerCase() : ''
  if (!creator) {
    return res.status(401).json({ success: false, error: 'Authentication required (session or SIWA receipt)' })
  }

  const body = (await readJsonBody<EnableBody>(req)) ?? {}
  const listedPublicly = typeof body.listedPublicly === 'boolean' ? body.listedPublicly : true

  try {
    let row: any

    if (body.agentType === 'csw') {
      // CSW mode: use the creator's canonical Coinbase Smart Wallet
      const cswAddress = body.cswAddress?.trim()
      const privyWalletId = body.privyWalletId?.trim()

      if (!cswAddress || !/^0x[a-fA-F0-9]{40}$/.test(cswAddress)) {
        return res.status(400).json({ success: false, error: 'Valid cswAddress required for CSW agent' })
      }
      if (!privyWalletId) {
        return res.status(400).json({ success: false, error: 'privyWalletId required for CSW agent' })
      }

      const canonical = await resolveCanonicalSmartWalletAddress(creator)
      if (!canonical || canonical.toLowerCase() !== cswAddress.toLowerCase()) {
        return res.status(403).json({
          success: false,
          error: 'cswAddress must match your canonical smart wallet',
        })
      }

      row = await enableCswAgent({
        creatorAddress: creator as `0x${string}`,
        cswAddress: cswAddress as `0x${string}`,
        privyWalletId,
        listedPublicly,
      })
    } else {
      // EOA mode: generate a new keypair (existing flow)
      row = await getOrCreateCreatorXmtpAgent({
        creatorAddress: creator as `0x${string}`,
        listedPublicly,
      })
    }

    return res.status(200).json({
      success: true,
      data: {
        creatorAddress: row.creatorAddress,
        xmtpAgentAddress: row.xmtpAgentAddress,
        agentType: row.agentType ?? 'eoa',
        cswAddress: row.cswAddress ?? null,
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
