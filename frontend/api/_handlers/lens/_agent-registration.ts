import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  handleOptions,
  readJsonBody,
  setCors,
  setNoStore,
  readRequestPrincipal,
} from '../../../packages/server-core/src/index.js'

import { buildAgentPublishStatus, type AgentPublishData } from '../../../server/_lib/erc8004OperatorStatus.js'


type ApiEnvelope<T> = { success: boolean; data?: T; error?: string; missing?: string[] }

type LensAgentRegistrationResponse = {
  registration: Record<string, unknown> | null
} & AgentPublishData

type LensAgentRegistrationRequest = {
  store?: boolean
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const body = req.method === 'POST' ? (await readJsonBody<LensAgentRegistrationRequest>(req)) ?? {} : {}
  const storeQueryRaw = typeof req.query.store === 'string' ? req.query.store.trim().toLowerCase() : ''
  const shouldStore = req.method === 'POST'
    ? body.store !== false
    : storeQueryRaw === 'true'

  const principal = readRequestPrincipal(req)
  const hasAuthPrincipal = Boolean(principal)
  if (shouldStore && !hasAuthPrincipal) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required to store on Grove. Use session or SIWA receipt, or set store=false.',
    } satisfies ApiEnvelope<never>)
  }

  try {
    const result = await buildAgentPublishStatus({
      req,
      storeOnGrove: shouldStore,
      includeStoredGroveState: false,
    })

    return res.status(200).json({
      success: true,
      data: {
        registration: result.registration,
        ...result.publish,
        grove: result.publish.grove,
      } satisfies ApiEnvelope<LensAgentRegistrationResponse>['data'],
    } satisfies ApiEnvelope<LensAgentRegistrationResponse>)
  } catch (error) {
    const statusCode = typeof (error as { statusCode?: unknown })?.statusCode === 'number'
      ? Number((error as { statusCode?: number }).statusCode)
      : 500
    const missing = Array.isArray((error as { missing?: unknown })?.missing)
      ? ((error as { missing?: string[] }).missing ?? [])
      : undefined

    return res.status(statusCode).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to build Lens agent registration payload.',
      ...(missing && missing.length > 0 ? { missing } : {}),
    } satisfies ApiEnvelope<never>)
  }
}
