import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  getSessionAddress,
  handleOptions,
  isAdminAddress,
  readBoundedJsonObjectBody,
  setCors,
  setNoStore,
} from '../../../../packages/server-core/src/index.js'
import { createVaultControlPlane, VaultControlPlaneError } from '../../../../server/_lib/controlPlane/vaultControlPlane.js'

type ProvisionBody = {
  vaultAddress?: unknown
  chainId?: unknown
  creatorAddress?: unknown
  strategyVariant?: unknown
  requestedBy?: unknown
}

function parseOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function parseOptionalChainId(value: unknown): number | undefined {
  if (value === null || typeof value === 'undefined' || value === '') return undefined
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error('Invalid chainId')
  return Math.floor(parsed)
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

  const bodyRaw = await readBoundedJsonObjectBody(req, { maxBytes: 4_096 })
  const body = (bodyRaw && typeof bodyRaw === 'object' && !Array.isArray(bodyRaw) ? bodyRaw : {}) as ProvisionBody
  const vaultAddress = parseOptionalString(body.vaultAddress)
  if (!vaultAddress) {
    return res.status(400).json({ success: false, error: 'Missing vaultAddress' } satisfies ApiEnvelope<never>)
  }

  try {
    const result = await createVaultControlPlane().provisionVaultEconomy({
      vaultAddress,
      chainId: parseOptionalChainId(body.chainId),
      creatorAddress: parseOptionalString(body.creatorAddress),
      strategyVariant: parseOptionalString(body.strategyVariant),
      requestedBy: parseOptionalString(body.requestedBy) ?? admin.toLowerCase(),
    })
    return res.status(202).json({ success: true, data: result } satisfies ApiEnvelope<typeof result>)
  } catch (error) {
    if (error instanceof VaultControlPlaneError) {
      return res.status(error.statusCode).json({ success: false, error: error.message } satisfies ApiEnvelope<never>)
    }
    if (error instanceof Error && error.message === 'Invalid chainId') {
      return res.status(400).json({ success: false, error: error.message } satisfies ApiEnvelope<never>)
    }
    const message = error instanceof Error ? error.message : 'control_plane_provision_failed'
    return res.status(500).json({ success: false, error: message } satisfies ApiEnvelope<never>)
  }
}

