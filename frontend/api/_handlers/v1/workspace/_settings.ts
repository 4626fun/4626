import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  setCors,
  setNoStore,
  guardAgentApiRequest,
  getClientIp,
  RATE_LIMITS,
  checkRateLimit,
  rateLimitKey,
} from '../../../../packages/server-core/src/index.js'


import { resolveWorkspaceSettings } from '../../../../server/_lib/workspace/service.js'
import { normalizeVaultAddressFromQuery, requireWorkspaceAccess } from './_shared.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const g = await guardAgentApiRequest({
    req,
    res,
    endpoint: 'v1/workspace/settings',
    kind: 'read',
  })
  if (!g.ok) return

  const limiter = checkRateLimit(
    rateLimitKey('v1-workspace-settings', g.auth?.address?.toLowerCase() ?? 'anon', getClientIp(req)),
    RATE_LIMITS.workspaceRead,
  )
  if (!limiter.allowed) {
    return res.status(429).json({ success: false, error: 'Too many requests' } satisfies ApiEnvelope<never>)
  }

  const vaultAddress = normalizeVaultAddressFromQuery(req)
  if (!vaultAddress) {
    return res.status(400).json({
      success: false,
      error: 'vault is required',
    } satisfies ApiEnvelope<never>)
  }

  const access = await requireWorkspaceAccess({
    req,
    vaultAddress,
    permission: 'read',
  })
  if (!access.ok) {
    return res.status(access.status).json({
      success: false,
      error: access.error,
    } satisfies ApiEnvelope<never>)
  }

  try {
    const payload = await resolveWorkspaceSettings({
      vaultAddress,
      principalAddress: access.context.principalAddress,
    })
    return res.status(200).json({
      success: true,
      data: {
        ...payload,
        actorRole: access.context.role,
      },
    } satisfies ApiEnvelope<typeof payload & { actorRole: string }>)
  } catch (error: unknown) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error && error.message ? error.message : 'Failed to load workspace settings',
    } satisfies ApiEnvelope<never>)
  }
}
