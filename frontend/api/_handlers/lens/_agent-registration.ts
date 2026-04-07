import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  handleOptions,
  readJsonBody,
  setCors,
  setNoStore,
  readRequestPrincipal,
} from '../../../packages/server-core/src/index.js'

import { buildAgentRegistration } from '../../../server/_lib/agentRegistration.js'
import {
  publishAgentRegistrationToGrove,
  resolveAgentRegistrationKey,
} from '../../../server/_lib/agentRegistrationPublisher.js'
import { getCanonicalOrigin } from '../../../server/_lib/origin.js'
import { buildAgentUriPolicy, type AgentUriPolicy } from '../../../src/lib/erc8004AgentUriPolicy.js'


type ApiEnvelope<T> = { success: boolean; data?: T; error?: string; missing?: string[] }

type LensAgentRegistrationResponse = {
  registration: Record<string, unknown> | null
  uriPolicy: AgentUriPolicy
  grove?: {
    lensUri: string
    gatewayUrl: string
    storageKey: string
    statusUrl: string | null
  }
  groveStatus?: 'stored' | 'unavailable' | 'skipped'
}

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

  const origin = (() => {
    try {
      return getCanonicalOrigin(req)
    } catch {
      return 'https://4626.fun'
    }
  })()

  const result = buildAgentRegistration(origin)
  if (!result.payload) {
    return res.status(503).json({
      success: false,
      error: result.error || 'Missing ERC-8004 registry configuration.',
      missing: result.missing ?? [],
    } satisfies ApiEnvelope<never>)
  }

  const registration = result.payload
  const baseAgentKey = resolveAgentRegistrationKey(registration, 'single-agent')

  // Keep uploaded payload deterministic/content-addressed.
  // Adding timestamps here changes the hash and therefore the resulting lens:// URI on every call.
  let grove: LensAgentRegistrationResponse['grove']
  let groveStatus: 'stored' | 'unavailable' | 'skipped' = 'skipped'
  let compatibilityFallbackUrl: string | null = null
  if (shouldStore) {
    const publish = await publishAgentRegistrationToGrove({
      payload: registration,
      agentKey: resolveAgentRegistrationKey(registration, baseAgentKey),
    })
    if (publish.ok) {
      grove = {
        lensUri: publish.lensUri,
        gatewayUrl: publish.gatewayUrl,
        storageKey: publish.storageKey ?? publish.lensUri.replace(/^lens:\/\//, ''),
        statusUrl: null,
      }
      compatibilityFallbackUrl = publish.gatewayUrl
      groveStatus = 'stored'
    } else {
      groveStatus = 'unavailable'
    }
  }

  const uriPolicy = buildAgentUriPolicy({
    origin,
    registration,
    compatibilityFallbackUrl,
  })

  return res.status(200).json({
    success: true,
    data: { registration, uriPolicy, grove, groveStatus },
  } satisfies ApiEnvelope<LensAgentRegistrationResponse>)
}
