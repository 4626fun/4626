import type { VercelRequest, VercelResponse } from '@vercel/node'

import { buildAgentRegistration, type RegistrationFile } from '../server/_lib/agent/agentRegistration.js'
import { getErc8004PublicOrigin } from '../server/_lib/infra/origin.js'

function setNoStore(res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
}

/**
 * Intentionally wildcard CORS: the ERC-8004 agent-registration payload is a
 * public identity artifact by design — any dApp, indexer, or wallet that
 * wants to discover the agent must be able to fetch it cross-origin. The
 * handler only ever returns static registry data (no user session, no
 * cookies, no secrets) so a permissive origin is safe. Non-GET/HEAD methods
 * are rejected a few lines below.
 *
 * Do not narrow this to an allowlist without also rewriting the discovery
 * contract — see docs/audits/4626/acceptances/I-01-I-17-info-findings.md (I-12).
 */
function setPublicCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

function sendRegistration(res: VercelResponse, payload: RegistrationFile) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.statusCode = 200
  res.end(JSON.stringify(payload, null, 2))
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setNoStore(res)
  setPublicCors(res)

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const origin = getErc8004PublicOrigin(req)
  const result = buildAgentRegistration(origin)
  if (!result.payload) {
    return res.status(503).json({
      success: false,
      error: result.error || 'Missing ERC-8004 registry configuration.',
      missing: result.missing ?? [],
    })
  }

  sendRegistration(res, result.payload)
}
