import type { VercelRequest, VercelResponse } from '@vercel/node'

import { guardAgentApiRequest, handleOptions, readBoundedJsonObjectBody, setCors, setNoStore, checkRateLimit, rateLimitKey, RATE_LIMITS, getClientIp } from '@4626/server-core'
import { normalizeChatAddress } from '../../../../../server/_lib/chat/presence.js'
import { upsertVaultChatPolicy } from '../../../../../server/_lib/chat/vaultChatPolicy.js'
import { normalizeVaultAddressFromQuery, requireWorkspaceAccess } from '../../workspace/_shared.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' })

  const g = await guardAgentApiRequest({ req, res, endpoint: 'v1/vault/chat/policy', kind: 'write' })
  if (!g.ok) return

  const limiter = checkRateLimit(
    rateLimitKey('v1/vault/chat/policy', (g.auth?.address ?? 'anon').toLowerCase(), getClientIp(req)),
    RATE_LIMITS.adminAction,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' })
  }

  const vaultAddress = normalizeVaultAddressFromQuery(req)
  if (!vaultAddress) return res.status(400).json({ success: false, error: 'vault is required' })

  const access = await requireWorkspaceAccess({ req, vaultAddress, permission: 'rooms_manage' })
  if (!access.ok) return res.status(access.status).json({ success: false, error: access.error })

  const body = (await readBoundedJsonObjectBody(req, { maxBytes: 8192 })) ?? {}
  const groupId = typeof body.groupId === 'string' ? body.groupId.trim() : null
  const creatorAddress = normalizeChatAddress(body.creatorAddress) ?? normalizeChatAddress(access.context.principalAddress)
  const shareTokenAddress = normalizeChatAddress(body.shareTokenAddress)
  const minHoldingRaw = typeof body.minHoldingRaw === 'string' ? body.minHoldingRaw.trim() : String(body.minHoldingRaw ?? '0')
  const graceHours = Number(body.graceHours ?? 24)
  const enabled = Boolean(body.enabled)
  const actorAddress = normalizeChatAddress(g.auth?.address)

  try {
    const policy = await upsertVaultChatPolicy({
      vaultAddress,
      groupId,
      creatorAddress,
      shareTokenAddress,
      minHoldingRaw,
      graceHours,
      enabled,
      actorAddress,
    })
    return res.status(200).json({ success: true, data: { policy } })
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error?.message ? String(error.message) : 'policy_update_failed' })
  }
}
