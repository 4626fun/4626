import type { VercelRequest, VercelResponse } from '@vercel/node'

import { buildAgentRegistration, type RegistrationFile } from '../server/_lib/agentRegistration.js'
import { getErc8004PublicOrigin } from '../server/_lib/origin.js'

function setNoStore(res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
}

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
