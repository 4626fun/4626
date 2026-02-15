import type { VercelRequest, VercelResponse } from '@vercel/node'

import { handleOptions, readJsonBody, setCors, setNoStore } from '../../../server/auth/_shared.js'
import { buildAgentRegistration } from '../../../server/_lib/agentRegistration.js'
import { tryUploadImmutableJson } from '../../../server/_lib/lensGrove.js'
import { getCanonicalOrigin } from '../../../server/_lib/origin.js'
import { readRequestPrincipal } from '../../../server/_lib/requestPrincipal.js'
import { trackFarcasterRolloutEvent } from '../../../server/_lib/farcasterRolloutTelemetry.js'

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string; missing?: string[] }

type Body = { storeOnGrove?: boolean }

type PublishResult = {
  registration: Record<string, unknown>
  groveStatus: 'stored' | 'unavailable' | 'skipped'
  grove?: {
    lensUri: string
    gatewayUrl: string
    storageKey: string
    statusUrl: string | null
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  if (!readRequestPrincipal(req)) {
    return res.status(401).json({ success: false, error: 'Authentication required' } satisfies ApiEnvelope<never>)
  }

  const body = (await readJsonBody<Body>(req)) ?? {}
  const storeOnGrove = body.storeOnGrove !== false

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

  let groveStatus: PublishResult['groveStatus'] = 'skipped'
  let grove: PublishResult['grove'] | undefined
  if (storeOnGrove) {
    const upload = await tryUploadImmutableJson(result.payload)
    if (upload.ok) {
      groveStatus = 'stored'
      grove = {
        lensUri: upload.result.lensUri,
        gatewayUrl: upload.result.gatewayUrl,
        storageKey: upload.result.storageKey,
        statusUrl: upload.result.statusUrl,
      }
    } else {
      groveStatus = 'unavailable'
    }
  }

  void trackFarcasterRolloutEvent({
    category: 'agent_publish',
    endpoint: '/api/v1/agents/publish',
    mode: storeOnGrove ? 'store' : 'dry-run',
    source: groveStatus,
    statusCode: 200,
    metadata: { hasLensUri: Boolean(grove?.lensUri) },
  })

  return res.status(200).json({
    success: true,
    data: {
      registration: result.payload,
      groveStatus,
      grove,
    } satisfies PublishResult,
  } satisfies ApiEnvelope<PublishResult>)
}
