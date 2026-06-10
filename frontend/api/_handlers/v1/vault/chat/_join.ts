import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  checkRateLimit,
  getClientIp,
  guardAgentApiRequest,
  handleOptions,
  RATE_LIMITS,
  rateLimitKey,
  setCors,
  setNoStore,
} from '@4626/server-core'
import { joinVaultChat } from '../../../../../server/_lib/chat/vaultChatPolicy.js'
import { normalizeChatAddress } from '../../../../../server/_lib/chat/presence.js'
import { normalizeVaultAddressFromQuery } from '../../workspace/_shared.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' })

  const g = await guardAgentApiRequest({ req, res, endpoint: 'v1/vault/chat/join', kind: 'write' })
  if (!g.ok) return

  const vaultAddress = normalizeVaultAddressFromQuery(req)
  const walletAddress = normalizeChatAddress(g.auth?.address)
  if (!vaultAddress) return res.status(400).json({ success: false, error: 'vault is required' })
  if (!walletAddress) return res.status(401).json({ success: false, error: 'Authentication required' })

  const limiter = checkRateLimit(
    rateLimitKey('v1-vault-chat-join', walletAddress, getClientIp(req)),
    RATE_LIMITS.workspaceActions,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Too many requests' })
  }

  try {
    const result = await joinVaultChat({ vaultAddress, walletAddress })
    return res.status(result.eligible ? 200 : 403).json({ success: result.eligible, data: result, error: result.eligible ? undefined : 'not_eligible' })
  } catch (error: any) {
    const message = error?.message ? String(error.message) : 'vault_chat_join_failed'
    const status = message.includes('not_enabled') || message.includes('missing') ? 409 : 500
    return res.status(status).json({ success: false, error: message })
  }
}
