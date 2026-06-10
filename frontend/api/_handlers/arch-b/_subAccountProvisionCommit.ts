/**
 * Architecture B Phase 5 — sub-account provisioning (commit).
 *
 * POST /api/arch-b/sub-account/provision/commit
 *
 * SIWE-gated. Accepts the signed SpendPermission payload echoed from /prepare,
 * verifies the signature is from an on-chain owner of the parent CSW, re-derives
 * the sub-account address, confirms Privy delegation, and writes the
 * sub-account columns onto the profile's command_issuer_execution_context row.
 *
 * Invariants:
 *  - Signer MUST be an on-chain owner of `permission.account` (parent CSW) at
 *    commit time (EOA-scan owner check or ERC-1271 fallback).
 *  - Permission hash is recomputed server-side; client-supplied hash is
 *    never trusted.
 *  - Caps are re-validated against server ceilings, not just echoed.
 *  - Privy delegation is verified before the DB write.
 *
 * Responses:
 *   200 { success: true, data: { profileId, subAccountAddress, status: 'ready' } }
 *   400 invalid_body | invalid_hash | invalid_spender | invalid_caps | invalid_token | invalid_window | permission_not_yet_active | permission_expired
 *   401 unauthenticated
 *   403 signer_not_owner | invalid_signature
 *   409 invalid_parent_account | profile_not_ready | missing_privy_wallet
 *   412 privy_delegation_missing
 *   500 signature_verification_failed
 *   503 db_unavailable
 */

import { PrivyClient } from '@privy-io/server-auth'
import type { Address, Hex } from 'viem'
import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  setCors,
  setNoStore,
  getClientIp,
  RATE_LIMITS,
  checkRateLimit,
  rateLimitKey,
  readBoundedJsonObjectBody,
  getDb,
  isDbConfigured,
  resolveAuthorizedRequestPrincipal,
  logger,
} from '@4626/server-core'
import { provisionCommandIssuerContext } from '@4626/server-core'
import type { SpendPermissionPayload } from '@4626/server-core'
import {
  CHAIN_ID_BASE,
  checkPrivyDelegation,
  getBasePublicClient,
  verifySubAccountProvision,
} from '../../../server/_lib/wallet/subAccountProvisionVerify.js'
import { resolveOwnerWalletId } from '../../../server/_lib/wallet/privyOwnerWalletIdResolver.js'

declare const process: { env: Record<string, string | undefined> }

const COMMIT_BODY_MAX_BYTES = 16_384

function asObjectBody(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}
  return input as Record<string, unknown>
}

function parseBigInt(value: unknown): bigint | null {
  if (typeof value === 'bigint') return value > 0n ? value : null
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null
    try {
      const v = BigInt(trimmed)
      return v > 0n ? v : null
    } catch {
      return null
    }
  }
  return null
}

function parsePermission(input: unknown): SpendPermissionPayload | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null
  const o = input as Record<string, unknown>
  const addr = (v: unknown) =>
    typeof v === 'string' && /^0x[a-fA-F0-9]{40}$/.test(v) ? (v.toLowerCase() as Address) : null
  const account = addr(o.account)
  const spender = addr(o.spender)
  const token = addr(o.token)
  const allowance = typeof o.allowance === 'string' ? o.allowance : null
  const period = typeof o.period === 'number' ? o.period : NaN
  const start = typeof o.start === 'number' ? o.start : NaN
  const end = typeof o.end === 'number' ? o.end : NaN
  const salt = typeof o.salt === 'string' && /^0x[0-9a-fA-F]+$/.test(o.salt) ? (o.salt as Hex) : null
  const extraData =
    typeof o.extraData === 'string' && /^0x[0-9a-fA-F]*$/.test(o.extraData) ? (o.extraData as Hex) : null
  if (!account || !spender || !token || !allowance || !salt || extraData === null) return null
  if (!Number.isFinite(period) || period <= 0) return null
  if (!Number.isFinite(start) || start < 0) return null
  if (!Number.isFinite(end) || end <= 0) return null
  try {
    BigInt(allowance)
  } catch {
    return null
  }
  return {
    account,
    spender,
    token,
    allowance,
    period,
    start,
    end,
    salt,
    extraData,
  }
}

function getQuorumId(): string {
  const nodeEnv = (process.env.NODE_ENV ?? '').trim().toLowerCase()
  const isProd = nodeEnv === 'production' || Boolean((process.env.VERCEL ?? '').trim())
  const fromEnv = (process.env.ARCH_B_SIGNER_QUORUM_ID ?? '').trim()
  if (!fromEnv && isProd) {
    throw new Error('ARCH_B_SIGNER_QUORUM_ID missing in production')
  }
  return fromEnv || 'lr8vgu2l0wnmwg824n4jrtr3'
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res
      .status(405)
      .json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const principal = await resolveAuthorizedRequestPrincipal(req, { lowercase: true })
  if (!principal) {
    return res
      .status(401)
      .json({ success: false, error: 'Sign in required' } satisfies ApiEnvelope<never>)
  }
  if (!principal.profileId || !principal.canonicalSmartWalletAddress) {
    return res
      .status(409)
      .json({ success: false, error: 'profile_not_ready' } satisfies ApiEnvelope<never>)
  }

  const rate = checkRateLimit(
    rateLimitKey('arch-b-subacct-commit', principal.address, getClientIp(req)),
    RATE_LIMITS.adminAction,
  )
  if (!rate.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000))))
    return res
      .status(429)
      .json({ success: false, error: 'Too many requests' } satisfies ApiEnvelope<never>)
  }

  const rawBody = await readBoundedJsonObjectBody(req, { maxBytes: COMMIT_BODY_MAX_BYTES }).catch(
    () => null,
  )
  const body = asObjectBody(rawBody)
  const permission = parsePermission(body.permission)
  const signature = typeof body.signature === 'string' && /^0x[0-9a-fA-F]+$/.test(body.signature)
    ? (body.signature as Hex)
    : null
  const perTxCapWei = parseBigInt(body.perTxCapWei)
  const dailyCapWei = parseBigInt(body.dailyCapWei)

  if (!permission || !signature || !perTxCapWei || !dailyCapWei) {
    return res
      .status(400)
      .json({ success: false, error: 'invalid_body' } satisfies ApiEnvelope<never>)
  }

  if (!isDbConfigured()) {
    return res
      .status(503)
      .json({ success: false, error: 'db_unavailable' } satisfies ApiEnvelope<never>)
  }
  const db = await getDb()
  if (!db) {
    return res
      .status(503)
      .json({ success: false, error: 'db_unavailable' } satisfies ApiEnvelope<never>)
  }

  const profileRow = await db.sql`
    SELECT privy_user_id, primary_embedded_eoa, primary_smart_wallet
    FROM profiles
    WHERE id = ${principal.profileId}
    LIMIT 1
  `
  const row = profileRow.rows?.[0] as Record<string, unknown> | undefined
  const privyUserId = typeof row?.privy_user_id === 'string' ? row.privy_user_id.trim() : ''
  const ownerEoaRaw = typeof row?.primary_embedded_eoa === 'string' ? row.primary_embedded_eoa.trim() : ''
  const parentCswRaw =
    principal.canonicalSmartWalletAddress ||
    (typeof row?.primary_smart_wallet === 'string' ? row.primary_smart_wallet.trim() : '')
  if (!privyUserId || !/^0x[a-fA-F0-9]{40}$/.test(ownerEoaRaw) || !/^0x[a-fA-F0-9]{40}$/.test(parentCswRaw)) {
    return res
      .status(409)
      .json({ success: false, error: 'profile_not_ready' } satisfies ApiEnvelope<never>)
  }
  const parentCsw = parentCswRaw.toLowerCase() as Address
  const ownerEoa = ownerEoaRaw.toLowerCase() as Address

  const appId = (process.env.PRIVY_APP_ID ?? '').trim()
  const appSecret = (process.env.PRIVY_APP_SECRET ?? '').trim()
  if (!appId || !appSecret) {
    logger.error('[arch-b/subacct/commit] Privy server auth not configured')
    return res
      .status(500)
      .json({ success: false, error: 'privy_not_configured' } satisfies ApiEnvelope<never>)
  }
  const privyClient = new PrivyClient(appId, appSecret)
  const privyUser = await privyClient.getUserById(privyUserId)
  const walletOutcome = resolveOwnerWalletId(privyUser, ownerEoa)
  if (walletOutcome.status !== 'ready' || !walletOutcome.candidate.id) {
    return res
      .status(409)
      .json({ success: false, error: 'missing_privy_wallet' } satisfies ApiEnvelope<never>)
  }
  const privyOwnerWalletId = walletOutcome.candidate.id

  const publicClient = getBasePublicClient()

  const verified = await verifySubAccountProvision({
    profileId: principal.profileId,
    ownerEoa,
    parentCsw,
    permission,
    signature,
    perTxCapWei,
    dailyCapWei,
    publicClient,
  })
  if (!verified.ok) {
    const statusCode =
      verified.code === 'invalid_caps' ||
      verified.code === 'invalid_hash' ||
      verified.code === 'invalid_spender' ||
      verified.code === 'invalid_token' ||
      verified.code === 'invalid_window' ||
      verified.code === 'permission_not_yet_active' ||
      verified.code === 'permission_expired'
        ? 400
        : verified.code === 'invalid_parent_account'
          ? 409
        : verified.code === 'signer_not_owner' || verified.code === 'invalid_signature'
          ? 403
          : 500
    return res
      .status(statusCode)
      .json({ success: false, error: verified.code, data: verified.message ? { message: verified.message } : undefined } satisfies ApiEnvelope<unknown>)
  }

  // Privy delegation gate
  const quorumId = getQuorumId()
  const delegation = await checkPrivyDelegation({ privyOwnerWalletId, quorumId })
  if (!delegation.present) {
    return res.status(412).json({
      success: false,
      error: 'privy_delegation_missing',
      data: { expectedQuorumId: quorumId, walletId: privyOwnerWalletId, actualSigners: delegation.actualSigners },
    } satisfies ApiEnvelope<unknown>)
  }

  const outcome = await provisionCommandIssuerContext({
    profileId: principal.profileId,
    smartWallet: verified.subAccountAddress,
    privyOwnerWalletId,
    ownerEoa,
    ownerIndex: 1,
    perTxCapWei,
    dailyCapWei,
    paymasterPolicy: 'cdp_default',
    provisionedBy: 'user:' + principal.address,
    subAccount: {
      subAccountAddress: verified.subAccountAddress,
      parentCswAddress: parentCsw,
      spendPermission: {
        payload: permission,
        signature,
        hash: verified.permissionHash,
        allowanceWei: BigInt(permission.allowance),
        periodSeconds: permission.period,
        endAt: new Date(permission.end * 1000),
      },
    },
  })

  if (!outcome.ok) {
    const statusCode = outcome.error === 'db_unavailable' ? 503 : 500
    return res
      .status(statusCode)
      .json({ success: false, error: outcome.error } satisfies ApiEnvelope<never>)
  }

  logger.info('[arch-b/subacct/commit] provisioned', {
    profileId: principal.profileId,
    subAccountAddress: verified.subAccountAddress,
    parentCsw,
    chainId: CHAIN_ID_BASE,
  })

  return res.status(200).json({
    success: true,
    data: {
      profileId: principal.profileId,
      subAccountAddress: verified.subAccountAddress,
      parentCswAddress: parentCsw,
      permissionHash: verified.permissionHash,
      status: 'ready' as const,
    },
  } satisfies ApiEnvelope<unknown>)
}
