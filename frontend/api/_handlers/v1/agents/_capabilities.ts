import type { VercelRequest, VercelResponse } from '@vercel/node'

import { agentCapabilityResponseSchema } from './_accessSchemas.js'
import {
  handleOptions,
  setCors,
  setNoStore,
  guardAgentApiRequest,
} from '../../../../packages/server-core/src/index.js'


import { resolveAgentCapabilityResponse } from '../../../../server/_lib/agentAccessResolver.js'

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }

function isAddressLike(value: string): value is `0x${string}` {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

function readQueryString(req: VercelRequest, key: string): string {
  const raw = req.query?.[key]
  if (typeof raw === 'string') return raw.trim()
  if (Array.isArray(raw)) return String(raw[0] ?? '').trim()
  return ''
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
    endpoint: 'v1/agents/capabilities',
    kind: 'read',
  })
  if (!g.ok) return

  const walletRaw = readQueryString(req, 'wallet').toLowerCase()
  const shareTokenRaw = readQueryString(req, 'shareToken').toLowerCase()
  const chainIdRaw = readQueryString(req, 'chainId')

  if (!isAddressLike(walletRaw)) {
    return res.status(400).json({
      success: false,
      error: 'wallet is required (0x...)',
    } satisfies ApiEnvelope<never>)
  }

  const chainId = Number(chainIdRaw || '8453')
  if (!Number.isFinite(chainId) || Math.floor(chainId) !== chainId || chainId <= 0) {
    return res.status(400).json({
      success: false,
      error: 'chainId must be a positive integer',
    } satisfies ApiEnvelope<never>)
  }

  if (shareTokenRaw && !isAddressLike(shareTokenRaw)) {
    return res.status(400).json({
      success: false,
      error: 'shareToken must be a valid address when provided',
    } satisfies ApiEnvelope<never>)
  }

  const data = await resolveAgentCapabilityResponse({
    wallet: walletRaw,
    chainId,
    shareToken: shareTokenRaw ? (shareTokenRaw as `0x${string}`) : undefined,
  })

  const parsed = agentCapabilityResponseSchema.safeParse(data)
  if (!parsed.success) {
    return res.status(500).json({
      success: false,
      error: 'Capability response serialization failed',
    } satisfies ApiEnvelope<never>)
  }

  return res.status(200).json({
    success: true,
    data: parsed.data,
  } satisfies ApiEnvelope<typeof parsed.data>)
}
