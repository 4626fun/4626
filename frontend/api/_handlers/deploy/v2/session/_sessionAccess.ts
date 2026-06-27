import type { VercelRequest } from '@vercel/node'

import { getAddress, type Address } from 'viem'

import type { DeploySessionRecord } from '../../../../../server/_lib/deploy/deploySessions.js'
import { readDeployAuthFromRequest } from '../../../../../server/_lib/auth/deployAuth.js'

const DEPLOY_SESSION_ID_RE = /^[A-Za-z0-9_-]{1,128}$/
// APIAUTH-012: Deploy-critical operations (resume, cancel) must require a fresh
// Privy JWT (issued within the last 5 minutes) in addition to the session cookie.
const FRESH_JWT_MAX_AGE_MS = 5 * 60 * 1000

export class DeploySessionAccessError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'DeploySessionAccessError'
    this.status = status
  }
}

export function normalizeDeploySessionId(value: unknown): string | null {
  const sessionId = typeof value === 'string' ? value.trim() : ''
  if (!sessionId) return null
  return DEPLOY_SESSION_ID_RE.test(sessionId) ? sessionId : null
}

/**
 * APIAUTH-012: Extract Privy JWT from request headers and check freshness.
 * Returns true if a valid JWT with a recent `iat` claim is present.
 */
function checkFreshPrivyJwt(req: VercelRequest): boolean {
  const fromHeader = typeof req.headers?.['x-privy-token'] === 'string' ? req.headers['x-privy-token'].trim() : ''
  let token = fromHeader
  if (!token) {
    const auth = typeof req.headers?.authorization === 'string' ? req.headers.authorization.trim() : ''
    if (auth.toLowerCase().startsWith('bearer ')) {
      token = auth.slice('bearer '.length).trim()
    }
  }
  if (!token) return false
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return false
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'))
    const iat = typeof payload?.iat === 'number' ? payload.iat : null
    if (iat == null) return false
    const nowSec = Math.floor(Date.now() / 1000)
    return (nowSec - iat) * 1000 <= FRESH_JWT_MAX_AGE_MS
  } catch {
    return false
  }
}

export async function loadAuthorizedDeploySession(params: {
  req: VercelRequest
  sessionId: string
  getDeploySessionById: (id: string) => Promise<DeploySessionRecord | null>
  /** APIAUTH-012: When true, require a fresh Privy JWT (≤5 min) in addition to session cookie. */
  requireFreshPrivyJwt?: boolean
}): Promise<{
  auth:
    | {
        type: 'session'
        address: Address
      }
    | {
        type: 'siwa'
        address: Address
        agentId: number
        agentRegistry: string
        chainId: number
      }
  sessionAddress: Address
  rec: DeploySessionRecord
}> {
  const auth = readDeployAuthFromRequest(params.req)
  if (!auth?.address) {
    throw new DeploySessionAccessError(401, 'Not authenticated')
  }

  // APIAUTH-012: For deploy-critical operations (resume, cancel), require a
  // fresh Privy JWT in addition to the session cookie HMAC. This prevents a
  // stolen session cookie from controlling active deploys without recent
  // wallet ownership proof.
  if (params.requireFreshPrivyJwt && !checkFreshPrivyJwt(params.req)) {
    throw new DeploySessionAccessError(401, 'Fresh authentication required — please re-sign in')
  }

  const rec = await params.getDeploySessionById(params.sessionId)
  if (!rec) {
    throw new DeploySessionAccessError(404, 'Not found')
  }

  const sessionAddress = getAddress(auth.address)
  if (sessionAddress.toLowerCase() !== rec.sessionAddress.toLowerCase()) {
    throw new DeploySessionAccessError(403, 'Forbidden')
  }

  return { auth, sessionAddress, rec }
}
