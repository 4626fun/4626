import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  getSessionAddress,
  handleOptions,
  isAdminAddress,
  readBoundedJsonObjectBody,
  setCors,
  setNoStore,
} from '@4626/server-core'
import { createVaultControlPlane, VaultControlPlaneError } from '../../../../server/_lib/controlPlane/vaultControlPlane.js'

type OperatorActionBody = {
  vaultAddress?: unknown
  actionType?: unknown
  payload?: unknown
  idempotencyKey?: unknown
  requestedBy?: unknown
}

function parseOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function parsePayload(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const admin = getSessionAddress(req)
  if (!admin) {
    return res.status(401).json({ success: false, error: 'Sign in required' } satisfies ApiEnvelope<never>)
  }
  if (!isAdminAddress(admin)) {
    return res.status(403).json({ success: false, error: 'Admin only' } satisfies ApiEnvelope<never>)
  }

  const bodyRaw = await readBoundedJsonObjectBody(req, { maxBytes: 8_192 })
  const body = (bodyRaw && typeof bodyRaw === 'object' && !Array.isArray(bodyRaw) ? bodyRaw : {}) as OperatorActionBody
  const vaultAddress = parseOptionalString(body.vaultAddress)
  const actionType = parseOptionalString(body.actionType)
  if (!vaultAddress || !actionType) {
    return res.status(400).json({
      success: false,
      error: 'Missing vaultAddress or actionType',
    } satisfies ApiEnvelope<never>)
  }

  try {
    const result = await createVaultControlPlane().queueOperatorAction({
      vaultAddress,
      actionType,
      payload: parsePayload(body.payload),
      idempotencyKey: parseOptionalString(body.idempotencyKey),
      requestedBy: parseOptionalString(body.requestedBy) ?? admin.toLowerCase(),
    })
    return res.status(202).json({ success: true, data: result } satisfies ApiEnvelope<typeof result>)
  } catch (error) {
    if (error instanceof VaultControlPlaneError) {
      return res.status(error.statusCode).json({ success: false, error: error.message } satisfies ApiEnvelope<never>)
    }
    const message = error instanceof Error ? error.message : 'control_plane_operator_action_failed'
    return res.status(500).json({ success: false, error: message } satisfies ApiEnvelope<never>)
  }
}

