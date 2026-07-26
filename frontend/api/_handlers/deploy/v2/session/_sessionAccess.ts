import type { VercelRequest } from '@vercel/node'

import { getAddress, type Address } from 'viem'

import type { DeploySessionRecord } from '../../../../../server/_lib/deploy/deploySessions.js'
import { readDeployAuthFromRequest } from '../../../../../server/_lib/auth/deployAuth.js'
import { verifyPrivyRequest } from '../../../../../server/_lib/wallet/canonicalCswDelegation.js'
import { classifyLinkedAccounts } from '@4626/server-core'

const DEPLOY_SESSION_ID_RE = /^[A-Za-z0-9_-]{1,128}$/
// APIAUTH-012: Deploy-critical operations (resume, advance, cancel) must require a fresh
// Privy JWT (issued within the last 5 minutes) in addition to the session cookie.
const FRESH_JWT_MAX_AGE_MS = 5 * 60 * 1000
const FRESH_JWT_FUTURE_SKEW_MS = 30 * 1000

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

function readIssuedAtMs(token: string): number | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'))
    const iat = typeof payload?.iat === 'number' ? payload.iat : null
    return iat == null ? null : iat * 1000
  } catch {
    return null
  }
}

async function assertFreshVerifiedPrivyJwt(req: VercelRequest, expectedAddress: Address): Promise<void> {
  try {
    const context = await verifyPrivyRequest(req)
    const issuedAtMs = readIssuedAtMs(context.privyToken)
    const nowMs = Date.now()
    if (
      issuedAtMs == null ||
      issuedAtMs < nowMs - FRESH_JWT_MAX_AGE_MS ||
      issuedAtMs > nowMs + FRESH_JWT_FUTURE_SKEW_MS
    ) {
      throw new Error('stale_privy_token')
    }

    const normalizedExpected = expectedAddress.toLowerCase()
    const ownsSessionAddress = classifyLinkedAccounts(context.privyUser).allWallets.some(
      (wallet) => wallet.chain === 'evm' && wallet.address.toLowerCase() === normalizedExpected,
    )
    if (!ownsSessionAddress) throw new Error('privy_principal_mismatch')
  } catch {
    throw new DeploySessionAccessError(401, 'Fresh authentication required — please re-sign in')
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

  const sessionAddress = getAddress(auth.address)

  // SIWA deploy automation has its own signed-agent authentication and does
  // not carry a Privy user token. Browser session mutations require both a
  // verified recent token and a wallet link matching the cookie principal.
  // Privileged addresses do not bypass reauthentication: an old or stolen
  // browser HMAC session must never be enough to mutate a deploy session.
  if (params.requireFreshPrivyJwt && auth.type === 'session') {
    await assertFreshVerifiedPrivyJwt(params.req, sessionAddress)
  }

  const rec = await params.getDeploySessionById(params.sessionId)
  if (!rec) {
    throw new DeploySessionAccessError(404, 'Not found')
  }

  if (sessionAddress.toLowerCase() !== rec.sessionAddress.toLowerCase()) {
    throw new DeploySessionAccessError(403, 'Forbidden')
  }

  return { auth, sessionAddress, rec }
}
