/**
 * POST/GET /api/lens/reputation-graph
 *
 * Build an ERC-8004 reputation graph for an agent and optionally store it on Lens Grove.
 *
 * Query / body params:
 *   agentId        – (required) agent token ID
 *   tag1           – (optional) filter by tag1
 *   tag2           – (optional) filter by tag2
 *   includeRevoked – (optional, default true) include revoked feedback
 *   store          – (optional, default true) upload to Lens Grove
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'

import { handleOptions, readJsonBody, setCors, setNoStore } from '../../../server/auth/_shared.js'
import { buildReputationGraph } from '../../../server/_lib/reputationGraph.js'
import { tryUploadImmutableJson } from '../../../server/_lib/lensGrove.js'
import { readRequestPrincipal } from '../../../server/_lib/requestPrincipal.js'

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string }

type GroveAttachment = {
  lensUri: string
  gatewayUrl: string
  storageKey: string
  statusUrl: string | null
}

type ReputationGraphRequest = {
  agentId?: number | string
  tag1?: string
  tag2?: string
  includeRevoked?: boolean
  store?: boolean
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const body = req.method === 'POST' ? (await readJsonBody<ReputationGraphRequest>(req)) ?? {} : {}
  const agentIdRaw = String(body.agentId ?? req.query.agentId ?? '').trim()

  if (!agentIdRaw || !/^\d+$/.test(agentIdRaw)) {
    return res.status(400).json({ success: false, error: 'agentId is required (non-negative integer)' } satisfies ApiEnvelope<never>)
  }

  const agentId = Number(agentIdRaw)
  const tag1 = String(body.tag1 ?? req.query.tag1 ?? '').trim()
  const tag2 = String(body.tag2 ?? req.query.tag2 ?? '').trim()
  const includeRevoked = body.includeRevoked !== false && String(req.query.includeRevoked ?? '').trim() !== 'false'
  const shouldStore = body.store !== false && String(req.query.store ?? '').trim() !== 'false'

  const hasAuthPrincipal = Boolean(readRequestPrincipal(req))
  if (shouldStore && !hasAuthPrincipal) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required to store on Grove. Use session or SIWA receipt, or set store=false.',
    } satisfies ApiEnvelope<never>)
  }

  try {
    const graph = await buildReputationGraph({
      agentId,
      tag1Filter: tag1,
      tag2Filter: tag2,
      includeRevoked,
    })

    let grove: GroveAttachment | undefined
    let groveStatus: 'stored' | 'unavailable' | 'skipped' = 'skipped'
    let groveError: string | undefined

    if (shouldStore) {
      const attempt = await tryUploadImmutableJson(graph)
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
        groveError = attempt.error
      }
    }

    return res.status(200).json({
      success: true,
      data: { graph, grove, groveStatus, groveError },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to build reputation graph'
    return res.status(500).json({ success: false, error: msg } satisfies ApiEnvelope<never>)
  }
}
