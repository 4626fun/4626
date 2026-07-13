import type { VercelRequest, VercelResponse } from '@vercel/node'
import { isHex, type Hex } from 'viem'

import {
  checkDurableRateLimit,
  enforceCookieSessionTrustedOrigin,
  getClientIp,
  getSessionAddress,
  handleOptions,
  RATE_LIMITS,
  rateLimitKey,
  readBoundedJsonObjectBody,
  setCors,
  setNoStore,
} from '@4626/server-core'
import {
  consumeCreatorCoinLinkChallenge,
  CreatorCoinLinkError,
  inspectCreatorCoinLink,
  persistCreatorCoinLink,
} from '../../../../server/_lib/alfaclub/creatorCoinLink.js'
import { verifyCswWalletSignature } from '../../../../server/_lib/zora/cswGateVerification.js'

function sendError(res: VercelResponse, error: unknown) {
  if (error instanceof CreatorCoinLinkError) {
    return res.status(error.status).json({ success: false, error: error.code, message: error.message })
  }
  return res.status(500).json({ success: false, error: 'creator_coin_verification_failed' })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }
  if (enforceCookieSessionTrustedOrigin(req, res)) return

  const sessionAddress = getSessionAddress(req)
  if (!sessionAddress) {
    return res.status(401).json({ success: false, error: 'authentication_required' })
  }
  const limiter = await checkDurableRateLimit(
    rateLimitKey('v1/alfaclub/creator-coin/verify', sessionAddress.toLowerCase(), getClientIp(req)),
    RATE_LIMITS.cswLink,
    { failClosed: true },
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'rate_limit_exceeded' })
  }

  try {
    const body = (await readBoundedJsonObjectBody(req, { maxBytes: 16_384 })) ?? {}
    const nonce = typeof body.nonce === 'string' ? body.nonce.trim() : ''
    const signatureRaw = typeof body.signature === 'string' ? body.signature.trim() : ''
    if (!nonce || !isHex(signatureRaw)) {
      return res.status(400).json({ success: false, error: 'nonce_and_signature_required' })
    }

    const consumed = await consumeCreatorCoinLinkChallenge({ sessionAddress, nonce })
    const signatureResult = await verifyCswWalletSignature({
      cswAddress: consumed.row.executionAddress as `0x${string}`,
      message: consumed.message,
      signature: signatureRaw as Hex,
    })
    if (!signatureResult.ok) {
      return res.status(401).json({ success: false, error: 'invalid_wallet_signature' })
    }

    const inspection = await inspectCreatorCoinLink({
      sessionAddress,
      roomId: consumed.row.roomId,
      creatorCoinAddress: consumed.row.creatorCoinAddress,
      executionAddress: consumed.row.executionAddress,
    })
    if (
      inspection.status === 'control_not_verified' ||
      inspection.status === 'claimed_by_another_account' ||
      !inspection.verificationMethod
    ) {
      throw new CreatorCoinLinkError(
        inspection.status,
        inspection.status === 'claimed_by_another_account' ? 409 : 403,
        'Creator Coin authority changed before verification completed',
      )
    }

    const link = await persistCreatorCoinLink({
      inspection,
      profileId: consumed.row.profileId,
      verifiedSignerAddress: signatureResult.recoveredSigner as `0x${string}` | null,
      contractSignatureValidated: signatureResult.contractValidated,
    })
    return res.status(201).json({
      success: true,
      data: {
        status:
          link.verificationMethod === 'direct_owner'
            ? 'verified_owner'
            : 'managed_by_policy_controller',
        link,
      },
    })
  } catch (error) {
    return sendError(res, error)
  }
}
