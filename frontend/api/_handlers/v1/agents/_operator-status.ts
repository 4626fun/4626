import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  handleOptions,
  readRequestPrincipal,
} from '../../../../packages/server-core/src/index.js'

import { buildAgentOperatorStatus } from '../../../../server/_lib/erc8004OperatorStatus.js'

type ApiEnvelope<T> = {
  success: boolean
  data?: T
  error?: string
  missing?: string[]
}

function setPrivateCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-SIWA-Receipt')
}

function setPrivateNoStore(res: VercelResponse) {
  res.setHeader('Cache-Control', 'private, no-store')
  res.setHeader('Vary', 'Authorization, Cookie')
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setPrivateCors(res)
  setPrivateNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const principal = readRequestPrincipal(req)
  if (!principal) {
    return res.status(401).json({ success: false, error: 'Authentication required' } satisfies ApiEnvelope<never>)
  }

  try {
    const data = await buildAgentOperatorStatus(req)
    return res.status(200).json({
      success: true,
      data,
    } satisfies ApiEnvelope<typeof data>)
  } catch (error) {
    const statusCode = typeof (error as { statusCode?: unknown })?.statusCode === 'number'
      ? Number((error as { statusCode?: number }).statusCode)
      : 500
    const missing = Array.isArray((error as { missing?: unknown })?.missing)
      ? ((error as { missing?: string[] }).missing ?? [])
      : undefined

    return res.status(statusCode).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to build ERC-8004 operator snapshot.',
      ...(missing && missing.length > 0 ? { missing } : {}),
    } satisfies ApiEnvelope<never>)
  }
}
