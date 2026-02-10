import type { VercelRequest, VercelResponse } from '@vercel/node'

import { handleOptions, readJsonBody, setCors, setNoStore } from '../../../server/auth/_shared.js'
import { buildAgentRegistration } from '../../../server/_lib/agentRegistration.js'
import { tryUploadImmutableJson } from '../../../server/_lib/lensGrove.js'
import { getCanonicalOrigin } from '../../../server/_lib/origin.js'

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string; missing?: string[] }

type LensAgentRegistrationResponse = {
  registration: Record<string, unknown> | null
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
  const shouldStore = body.store !== false

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

  const registration = {
    ...result.payload,
    generatedAt: new Date().toISOString(),
    source: 'erc8004.registration',
  }

  let grove: LensAgentRegistrationResponse['grove']
  let groveStatus: 'stored' | 'unavailable' | 'skipped' = 'skipped'
  if (shouldStore) {
    const attempt = await tryUploadImmutableJson(registration)
    if (attempt.ok) {
      grove = {
        lensUri: attempt.result.lensUri,
        gatewayUrl: attempt.result.gatewayUrl,
        storageKey: attempt.result.storageKey,
        statusUrl: attempt.result.statusUrl,
      }
      groveStatus = 'stored'
    } else {
      groveStatus = 'unavailable'
    }
  }

  return res.status(200).json({ success: true, data: { registration, grove, groveStatus } } satisfies ApiEnvelope<LensAgentRegistrationResponse>)
}
