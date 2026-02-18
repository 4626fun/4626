import type { VercelRequest, VercelResponse } from '@vercel/node'

import { handleOptions, readJsonBody, setCors, setNoStore } from '../../../../server/auth/_shared.js'
import { buildAgentRegistration, enrichAgentRegistrationWithFarcaster } from '../../../../server/_lib/agentRegistration.js'
import {
  publishAgentRegistrationToGrove,
  resolveAgentRegistrationKey,
} from '../../../../server/_lib/agentRegistrationPublisher.js'
import { getCanonicalOrigin } from '../../../../server/_lib/origin.js'
import { readRequestPrincipal } from '../../../../server/_lib/requestPrincipal.js'
import { trackFarcasterRolloutEvent } from '../../../../server/_lib/farcasterRolloutTelemetry.js'

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

function ownerFromAgentKey(agentKey: string): string | null {
  const match = String(agentKey).match(/^single-csw:(0x[a-fA-F0-9]{40})$/)
  return match ? match[1].toLowerCase() : null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const principal = readRequestPrincipal(req)
  if (!principal) {
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

  // Keep registration payload deterministic across linked signer sessions by
  // anchoring enrichment + state keying to canonical CSW identity.
  const baseAgentKey = resolveAgentRegistrationKey(result.payload, 'single-agent')
  const canonicalOwner = ownerFromAgentKey(baseAgentKey)
  const registration = await enrichAgentRegistrationWithFarcaster({
    payload: result.payload,
    ownerAddress: canonicalOwner ?? principal.address,
  })

  let groveStatus: PublishResult['groveStatus'] = 'skipped'
  let grove: PublishResult['grove'] | undefined
  if (storeOnGrove) {
    const agentKey = resolveAgentRegistrationKey(registration, baseAgentKey)
    const publish = await publishAgentRegistrationToGrove({
      payload: registration,
      agentKey,
    })
    if (publish.ok) {
      groveStatus = 'stored'
      grove = {
        lensUri: publish.lensUri,
        gatewayUrl: publish.gatewayUrl,
        storageKey: publish.storageKey ?? publish.lensUri.replace(/^lens:\/\//, ''),
        statusUrl: null,
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
      registration,
      groveStatus,
      grove,
    } satisfies PublishResult,
  } satisfies ApiEnvelope<PublishResult>)
}
