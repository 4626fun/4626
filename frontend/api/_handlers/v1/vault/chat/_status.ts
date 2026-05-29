import type { VercelRequest, VercelResponse } from '@vercel/node'

import { guardAgentApiRequest, handleOptions, setCors, setNoStore, checkRateLimit, rateLimitKey, RATE_LIMITS, getClientIp } from '../../../../../packages/server-core/src/index.js'
import { readVaultChatMembership, readVaultChatPolicy } from '../../../../../server/_lib/chat/vaultChatPolicy.js'
import { normalizeChatAddress } from '../../../../../server/_lib/chat/presence.js'
import { normalizeVaultAddressFromQuery } from '../../workspace/_shared.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Method not allowed' })

  const g = await guardAgentApiRequest({ req, res, endpoint: 'v1/vault/chat/status', kind: 'read' })
  if (!g.ok) return

  const limiter = checkRateLimit(
    rateLimitKey('v1/vault/chat/status', (g.auth?.address ?? 'anon').toLowerCase(), getClientIp(req)),
    RATE_LIMITS.read,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' })
  }

  const vaultAddress = normalizeVaultAddressFromQuery(req)
  if (!vaultAddress) return res.status(400).json({ success: false, error: 'vault is required' })

  const walletAddress = normalizeChatAddress(g.auth?.address)
  const policy = await readVaultChatPolicy(vaultAddress)
  const membership = policy && walletAddress
    ? await readVaultChatMembership({ vaultAddress, walletAddress })
    : null

  return res.status(200).json({
    success: true,
    data: {
      policy,
      membership,
      canJoin: Boolean(policy?.enabled && policy.groupId),
      generatedAt: new Date().toISOString(),
    },
  })
}
