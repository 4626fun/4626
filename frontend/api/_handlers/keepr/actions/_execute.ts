import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  readJsonBody,
  requireKeeprApiKey,
  requireOptionalHeaderEnvAuth,
  setCors,
  setNoStore,
} from '../../../../packages/server-core/src/index.js'
import { executeKeeprAction } from '../../../../server/keepr/xmtpQueueExecutor.js'
import {
  KEEPR_TRUST_ZONE_KEY_HEADER,
  getKeeprTrustZoneEnvKey,
  resolveKeeprTrustZone,
} from '../../../../server/_lib/agentControl/trustZones.js'

declare const process: { env: Record<string, string | undefined> }

type ExecuteBody = {
  id?: number
  vaultAddress?: string
  groupId?: string
  actionType?: string | null
  action?: Record<string, unknown>
}

type ExecuteResponse = {
  executed: boolean
  retryable: boolean
  actionType: string
  trustZone: string
  error?: string
  details?: Record<string, unknown>
}

function isAddressLike(value: string): value is `0x${string}` {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  if (!requireKeeprApiKey(req, res, { missingSecretError: 'Server misconfigured' })) return

  const body = (await readJsonBody<ExecuteBody>(req)) ?? {}

  const id = Number(body.id)
  const vaultAddress = typeof body.vaultAddress === 'string' ? body.vaultAddress.trim().toLowerCase() : ''
  const groupId = typeof body.groupId === 'string' ? body.groupId.trim() : ''
  const actionType = typeof body.actionType === 'string' ? body.actionType : null
  const action = body.action && typeof body.action === 'object' && !Array.isArray(body.action)
    ? body.action
    : null

  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ success: false, error: 'Invalid action id' } satisfies ApiEnvelope<never>)
  }
  if (!isAddressLike(vaultAddress)) {
    return res.status(400).json({ success: false, error: 'Invalid vaultAddress' } satisfies ApiEnvelope<never>)
  }
  if (!groupId) {
    return res.status(400).json({ success: false, error: 'Invalid groupId' } satisfies ApiEnvelope<never>)
  }
  if (!action) {
    return res.status(400).json({ success: false, error: 'Invalid action payload' } satisfies ApiEnvelope<never>)
  }

  const trustZone = resolveKeeprTrustZone(actionType)
  const trustZoneEnvKey = getKeeprTrustZoneEnvKey(trustZone)
  if (
    !requireOptionalHeaderEnvAuth(req, res, {
      envKey: trustZoneEnvKey,
      headerName: KEEPR_TRUST_ZONE_KEY_HEADER,
      unauthorizedError: `Unauthorized trust zone: ${trustZone}`,
    })
  ) {
    return
  }

  const result = await executeKeeprAction({
    id,
    vaultAddress,
    groupId,
    actionType,
    action,
  })

  const responseBody = {
    success: result.success,
    data: {
      executed: result.success,
      retryable: result.retryable,
      actionType: result.actionType,
      trustZone,
      error: result.error,
      details: result.details,
    } satisfies ExecuteResponse,
    ...(result.success ? {} : { error: result.error ?? 'execution_failed' }),
  } satisfies ApiEnvelope<ExecuteResponse>

  if (result.success) {
    return res.status(200).json(responseBody)
  }
  return res.status(result.retryable ? 503 : 400).json(responseBody)
}

