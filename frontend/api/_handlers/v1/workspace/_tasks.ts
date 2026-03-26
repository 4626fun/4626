import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  setCors,
  setNoStore,
} from '../../../../server/auth/_shared.js'
import { guardAgentApiRequest } from '../../../../server/_lib/agentApiGuard.js'
import { resolveWorkspaceTasks } from '../../../../server/_lib/workspace/service.js'
import {
  normalizeVaultAddressFromQuery,
  readStringQuery,
  requireWorkspaceAccess,
} from './_shared.js'

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
    endpoint: 'v1/workspace/tasks',
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

  const taskStatus = readStringQuery(req, 'taskStatus')
  const approvalStatus = readStringQuery(req, 'approvalStatus')

  try {
    const payload = await resolveWorkspaceTasks({ vaultAddress, taskStatus, approvalStatus })
    return res.status(200).json({
      success: true,
      data: {
        ...payload,
        actorRole: access.context.role,
      },
    } satisfies ApiEnvelope<typeof payload & { actorRole: string }>)
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: typeof error?.message === 'string' ? error.message : 'Failed to load workspace tasks',
    } satisfies ApiEnvelope<never>)
  }
}
