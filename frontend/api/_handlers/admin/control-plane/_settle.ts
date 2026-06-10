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

type SettleBody = {
  vaultAddress?: unknown
  graduatedAt?: unknown
  settledAt?: unknown
  settlementStage?: unknown
  idempotencyKey?: unknown
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

  const bodyRaw = await readBoundedJsonObjectBody(req, { maxBytes: 2_048 })
  const body = (bodyRaw && typeof bodyRaw === 'object' && !Array.isArray(bodyRaw) ? bodyRaw : {}) as SettleBody
  const vaultAddress = typeof body.vaultAddress === 'string' ? body.vaultAddress.trim() : ''
  if (!vaultAddress) {
    return res.status(400).json({ success: false, error: 'Missing vaultAddress' } satisfies ApiEnvelope<never>)
  }

  try {
    const result = await createVaultControlPlane().settleVault({
      vaultAddress,
      graduatedAt: typeof body.graduatedAt === 'string' ? body.graduatedAt : undefined,
      settledAt: typeof body.settledAt === 'string' ? body.settledAt : undefined,
      settlementStage: typeof body.settlementStage === 'string' ? body.settlementStage : undefined,
      idempotencyKey: typeof body.idempotencyKey === 'string' ? body.idempotencyKey : undefined,
      requestedBy: admin,
    })
    return res.status(202).json({ success: true, data: result } satisfies ApiEnvelope<typeof result>)
  } catch (error) {
    if (error instanceof VaultControlPlaneError) {
      return res.status(error.statusCode).json({ success: false, error: error.message } satisfies ApiEnvelope<never>)
    }
    const message = error instanceof Error ? error.message : 'control_plane_settle_failed'
    return res.status(500).json({ success: false, error: message } satisfies ApiEnvelope<never>)
  }
}
