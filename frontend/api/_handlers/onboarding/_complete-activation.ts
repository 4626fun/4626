import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getAddress } from 'viem'

import {
  getDb,
  handleOptions,
  readJsonBody,
  setCors,
  setNoStore,
  RATE_LIMITS,
  checkDurableRateLimit,
  getClientIp,
  rateLimitKey,
  enableCswAgent,
  type ApiEnvelope,
} from '@4626/server-core'
import {
  readActivationStatus,
  resolveActivationContext,
} from '../../../server/_lib/wallet/activationContext.js'
import { readActivationOwnerToken } from '../../../server/_lib/wallet/activationOwnerToken.js'
import { consumeActivationOwnerTokenClaim } from '../../../server/_lib/wallet/activationOwnerTokenClaim.js'

const BODY_MAX_BYTES = 8 * 1024

type CompleteActivationResponse = {
  ready: true
  parentCswAddress: string
  serverWalletAddress: string
  xmtpIdentifier: string
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed',
    } satisfies ApiEnvelope<never>)
  }

  const limiter = await checkDurableRateLimit(
    rateLimitKey('onboarding-complete-activation', getClientIp(req)),
    RATE_LIMITS.activationComplete,
    { failClosed: true },
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({
      success: false,
      error: 'Rate limit exceeded',
    } satisfies ApiEnvelope<never>)
  }

  const db = await getDb()
  if (!db) {
    return res.status(503).json({
      success: false,
      error: 'Service unavailable',
    } satisfies ApiEnvelope<never>)
  }

  try {
    const body = (await readJsonBody(req, { maxBytes: BODY_MAX_BYTES })) as Record<string, unknown>
    const token = readActivationOwnerToken(
      typeof body.activationToken === 'string' ? body.activationToken : null,
    )
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'invalid_or_expired_activation_token',
      } satisfies ApiEnvelope<never>)
    }

    const context = await resolveActivationContext({ db: db as never, req })
    const bindingMatches =
      token.profileId === context.profileId &&
      token.privyUserId === context.privyUserId &&
      token.sessionAddress === context.embeddedEoaAddress &&
      token.embeddedOwnerAddress === context.embeddedEoaAddress &&
      token.smartWalletAddress === context.parentCswAddress &&
      context.serverWalletAddress !== null &&
      token.serverOwnerAddress === context.serverWalletAddress
    if (!bindingMatches) {
      return res.status(403).json({
        success: false,
        error: 'activation_binding_mismatch',
      } satisfies ApiEnvelope<never>)
    }

    const status = await readActivationStatus({ db: db as never, context })
    if (!status.embeddedOwnerConfirmed) {
      return res.status(409).json({
        success: false,
        error: 'embedded_owner_not_confirmed',
      } satisfies ApiEnvelope<never>)
    }
    if (!status.serverOwnerConfirmed || !status.serverWalletId || !status.serverWalletAddress) {
      return res.status(409).json({
        success: false,
        error: 'server_owner_not_confirmed',
      } satisfies ApiEnvelope<never>)
    }

    await enableCswAgent({
      creatorAddress: getAddress(status.parentCswAddress).toLowerCase() as `0x${string}`,
      cswAddress: getAddress(status.parentCswAddress).toLowerCase() as `0x${string}`,
      privyWalletId: status.serverWalletId,
      listedPublicly: true,
    })

    const confirmed = await readActivationStatus({ db: db as never, context })
    if (!confirmed.xmtpProvisioned) {
      return res.status(409).json({
        success: false,
        error: 'xmtp_not_provisioned',
      } satisfies ApiEnvelope<never>)
    }

    // Consume only after XMTP readiness is confirmed so retries can reuse the
    // same token if enableCswAgent/readback races before ready.
    await consumeActivationOwnerTokenClaim(db as never, {
      jti: token.jti,
      profileId: token.profileId,
      privyUserId: token.privyUserId,
    })

    const data: CompleteActivationResponse = {
      ready: true,
      parentCswAddress: status.parentCswAddress,
      serverWalletAddress: status.serverWalletAddress,
      xmtpIdentifier: status.parentCswAddress.toLowerCase(),
    }
    return res.status(200).json({
      success: true,
      data,
    } satisfies ApiEnvelope<CompleteActivationResponse>)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Activation completion failed'
    const statusCode = message.includes('Missing Privy') || message.includes('Privy verification')
      ? 401
      : message.includes('activation_token_')
        ? 409
        : 500
    return res.status(statusCode).json({
      success: false,
      error: message,
    } satisfies ApiEnvelope<never>)
  }
}
