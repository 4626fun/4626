import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  setCors,
  setNoStore,
  guardAgentApiRequest,
} from '../../../../packages/server-core/src/index.js'


import { resolveWorkspaceSummary } from '../../../../server/_lib/workspace/service.js'
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
    endpoint: 'v1/workspace/summary',
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

  try {
    const summary = await resolveWorkspaceSummary({ req, vaultAddress })
    return res.status(200).json({
      success: true,
      data: {
        ...summary,
        actorRole: access.context.role,
      },
    } satisfies ApiEnvelope<typeof summary & { actorRole: string }>)
  } catch (error: unknown) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error && error.message ? error.message : 'Failed to load workspace summary',
    } satisfies ApiEnvelope<never>)
  }
}
