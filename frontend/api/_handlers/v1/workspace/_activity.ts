import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  setCors,
  setNoStore,
} from '../../../../server/auth/_shared.js'
import { guardAgentApiRequest } from '../../../../server/_lib/agentApiGuard.js'
import { resolveWorkspaceActivity } from '../../../../server/_lib/workspace/service.js'
import {
  normalizeVaultAddressFromQuery,
  readNumberQuery,
  readStringQuery,
  requireWorkspaceAccess,
} from './_shared.js'

function parseBooleanQuery(raw: string | null, fallback = false): boolean {
  if (!raw) return fallback
  const normalized = raw.trim().toLowerCase()
  if (normalized === '1' || normalized === 'true' || normalized === 'yes') return true
  if (normalized === '0' || normalized === 'false' || normalized === 'no') return false
  return fallback
}

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
    endpoint: 'v1/workspace/activity',
    kind: 'read',
  })
  if (!g.ok) return

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

  const includeSystem = parseBooleanQuery(readStringQuery(req, 'includeSystem'), true)
  const limit = readNumberQuery(req, 'limit') ?? 150

  try {
    const payload = await resolveWorkspaceActivity({ vaultAddress, includeSystem, limit })
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
      error: error instanceof Error && error.message ? error.message : 'Failed to load workspace activity',
    } satisfies ApiEnvelope<never>)
  }
}
