/**
 * Architecture B Phase 5 — admin sub-account provisioning bypass.
 *
 * POST /api/admin/arch-b/sub-account/provision
 *
 * Bearer-auth variant of /api/arch-b/sub-account/provision/commit. Skips SIWE
 * and accepts an explicit `profileId` in the body. Privy delegation is not
 * enforced (only logged as a warning) so ops can provision rows ahead of the
 * user completing their delegation flow.
 *
 * Auth: `Authorization: Bearer <ADMIN_API_TOKEN>`.
 *
 * Note: most admin endpoints in this repo use SIWE + isAdminAddress. This
 * endpoint intentionally uses a separate bearer token so ops tooling can
 * provision without an admin-wallet signature. If the env var is unset the
 * endpoint always returns 401 — no default token.
 *
 * Body:
 *   {
 *     profileId: number,
 *     parentCswAddress: `0x...`,
 *     ownerEoaAddress: `0x...`,
 *     permission: SpendPermissionPayload,   // echoed from /prepare
 *     signature: `0x...`,
 *     perTxCapWei: string,
 *     dailyCapWei: string,
 *     privyOwnerWalletId?: string          // optional; resolved from Privy if absent
 *   }
 *
 * Responses:
 *   200 { success: true, data: { profileId, subAccountAddress, status: 'ready' } }
 *   400 invalid_body | invalid_caps | invalid_spender | permission_expired
 *   401 admin_token_missing | admin_token_invalid
 *   403 signer_not_owner
 *   409 missing_privy_wallet
 *   500 signature_verification_failed | privy_not_configured
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
} from '../../../../packages/server-core/src/index.js'
import { provisionCommandIssuerContext } from '../../../../server/_lib/wallet/commandIssuerContext.js'
import type { SpendPermissionPayload } from '../../../../server/_lib/wallet/commandIssuerContext.js'
import {
  checkPrivyDelegation,
  getBasePublicClient,
  verifySubAccountProvision,
} from '../../../../server/_lib/wallet/subAccountProvisionVerify.js'
import { resolveOwnerWalletId } from '../../../../server/_lib/wallet/privyOwnerWalletIdResolver.js'
import { logger } from '../../../../server/_lib/infra/logger.js'

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
  return { account, spender, token, allowance, period, start, end, salt, extraData }
}

function getQuorumId(): string {
  const fromEnv = (process.env.ARCH_B_SIGNER_QUORUM_ID ?? '').trim()
  return fromEnv || 'lr8vgu2l0wnmwg824n4jrtr3'
}

function extractBearerToken(req: VercelRequest): string | null {
  const header = req.headers.authorization ?? req.headers.Authorization
  const raw = Array.isArray(header) ? header[0] : header
  if (!raw || typeof raw !== 'string') return null
  const match = /^Bearer\s+(.+)$/i.exec(raw.trim())
  if (!match) return null
  return match[1].trim() || null
}

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

function requireAdminBearer(req: VercelRequest, res: VercelResponse): boolean {
  const expected = (process.env.ADMIN_API_TOKEN ?? '').trim()
  if (!expected) {
    res
      .status(401)
      .json({ success: false, error: 'admin_token_missing' } satisfies ApiEnvelope<never>)
    return false
  }
  const provided = extractBearerToken(req)
  if (!provided || !timingSafeEqualStr(provided, expected)) {
    res
      .status(401)
      .json({ success: false, error: 'admin_token_invalid' } satisfies ApiEnvelope<never>)
    return false
  }
  return true
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

  if (!requireAdminBearer(req, res)) return

  const rate = checkRateLimit(
    rateLimitKey('admin-arch-b-subacct-provision', getClientIp(req) || 'no-ip', 'token'),
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

  const profileId =
    typeof body.profileId === 'number' && Number.isFinite(body.profileId) && body.profileId > 0
      ? Math.floor(body.profileId)
      : NaN
  const parentCswRaw = typeof body.parentCswAddress === 'string' ? body.parentCswAddress.trim() : ''
  const ownerEoaRaw = typeof body.ownerEoaAddress === 'string' ? body.ownerEoaAddress.trim() : ''
  const permission = parsePermission(body.permission)
  const signature =
    typeof body.signature === 'string' && /^0x[0-9a-fA-F]+$/.test(body.signature)
      ? (body.signature as Hex)
      : null
  const perTxCapWei = parseBigInt(body.perTxCapWei)
  const dailyCapWei = parseBigInt(body.dailyCapWei)
  const providedPrivyWalletId =
    typeof body.privyOwnerWalletId === 'string' ? body.privyOwnerWalletId.trim() : ''

  if (
    !Number.isFinite(profileId) ||
    !/^0x[a-fA-F0-9]{40}$/.test(parentCswRaw) ||
    !/^0x[a-fA-F0-9]{40}$/.test(ownerEoaRaw) ||
    !permission ||
    !signature ||
    !perTxCapWei ||
    !dailyCapWei
  ) {
    return res
      .status(400)
      .json({ success: false, error: 'invalid_body' } satisfies ApiEnvelope<never>)
  }

  const parentCsw = parentCswRaw.toLowerCase() as Address
  const ownerEoa = ownerEoaRaw.toLowerCase() as Address

  // Privy wallet id lookup: prefer explicit, otherwise resolve from Privy user.
  let privyOwnerWalletId = providedPrivyWalletId
  if (!privyOwnerWalletId) {
    const appId = (process.env.PRIVY_APP_ID ?? '').trim()
    const appSecret = (process.env.PRIVY_APP_SECRET ?? '').trim()
    if (!appId || !appSecret) {
      logger.error('[admin/arch-b/subacct] Privy server auth not configured')
      return res
        .status(500)
        .json({ success: false, error: 'privy_not_configured' } satisfies ApiEnvelope<never>)
    }
    const privyUserIdFromBody = typeof body.privyUserId === 'string' ? body.privyUserId.trim() : ''
    if (!privyUserIdFromBody) {
      return res
        .status(409)
        .json({ success: false, error: 'missing_privy_wallet' } satisfies ApiEnvelope<never>)
    }
    const privyClient = new PrivyClient(appId, appSecret)
    const privyUser = await privyClient.getUserById(privyUserIdFromBody)
    const walletOutcome = resolveOwnerWalletId(privyUser, ownerEoa)
    if (walletOutcome.status !== 'ready' || !walletOutcome.candidate.id) {
      return res
        .status(409)
        .json({ success: false, error: 'missing_privy_wallet' } satisfies ApiEnvelope<never>)
    }
    privyOwnerWalletId = walletOutcome.candidate.id
  }

  const publicClient = getBasePublicClient()

  const verified = await verifySubAccountProvision({
    profileId,
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
      verified.code === 'permission_expired'
        ? 400
        : verified.code === 'signer_not_owner' || verified.code === 'invalid_signature'
          ? 403
          : 500
    return res
      .status(statusCode)
      .json({
        success: false,
        error: verified.code,
        data: verified.message ? { message: verified.message } : undefined,
      } satisfies ApiEnvelope<unknown>)
  }

  // Privy delegation — admin warns but does not reject.
  const quorumId = getQuorumId()
  const delegation = await checkPrivyDelegation({ privyOwnerWalletId, quorumId }).catch((err) => {
    logger.warn('[admin/arch-b/subacct] privy delegation check threw', {
      walletId: privyOwnerWalletId,
      error: err instanceof Error ? err.message : String(err),
    })
    return { present: false as const, actualSigners: [] }
  })
  if (!delegation.present) {
    logger.warn('[admin/arch-b/subacct] privy delegation missing; continuing (admin override)', {
      walletId: privyOwnerWalletId,
      expectedQuorumId: quorumId,
      actualSigners: delegation.actualSigners,
    })
  }

  const outcome = await provisionCommandIssuerContext({
    profileId,
    smartWallet: verified.subAccountAddress,
    privyOwnerWalletId,
    ownerEoa,
    ownerIndex: 1,
    perTxCapWei,
    dailyCapWei,
    paymasterPolicy: 'cdp_default',
    provisionedBy: 'admin:token',
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

  return res.status(200).json({
    success: true,
    data: {
      profileId,
      subAccountAddress: verified.subAccountAddress,
      parentCswAddress: parentCsw,
      permissionHash: verified.permissionHash,
      privyDelegationPresent: delegation.present,
      status: 'ready' as const,
    },
  } satisfies ApiEnvelope<unknown>)
}
