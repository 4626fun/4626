/**
 * Architecture B Phase 2 — admin provisioning endpoint.
 *
 * POST /api/admin/arch-b/provision
 *
 * Provisions (or re-provisions) a profile's Coinbase Smart Wallet as its
 * execution context for /keepr send (and future Arch B-migrated commands).
 * This is admin-only, server-side, and never exposed to end users. The
 * feature flag `ARCH_B_SEND_VIA_USEROP` controls whether the runtime path
 * uses these rows; provisioning can be rolled out ahead of the flag flip.
 *
 * Body:
 *   {
 *     profileId: number,
 *     smartWallet: `0x...`,
 *     privyOwnerWalletId: string,
 *     ownerEoa: `0x...`,
 *     ownerIndex?: number,   // default 0
 *     perTxCapWei?: string,  // stringified bigint; default from env
 *     dailyCapWei?: string,  // stringified bigint; default from env
 *     paymasterPolicy?: string,
 *     dryRun?: boolean,
 *   }
 *
 * Responses:
 *   200 { success: true, data: CommandIssuerContextView }
 *   400 { success: false, error: 'invalid_body' | 'invalid_address' | 'invalid_caps' | ... }
 *   401/403 unauth
 *   503 db/unavailable
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  readBoundedJsonObjectBody,
  setCors,
  setNoStore,
  getSessionAddress,
  isAdminAddress,
  getClientIp,
  RATE_LIMITS,
  checkRateLimit,
  rateLimitKey,
} from '@4626/server-core'

import {
  provisionCommandIssuerContext,
  resolveCommandIssuerContextByProfileId,
} from '@4626/server-core'

declare const process: { env: Record<string, string | undefined> }

const PROVISION_BODY_MAX_BYTES = 8_192

// Fallback defaults match docs/architecture-b-design.md:
//   per-tx   0.01 ETH = 10_000_000_000_000_000 wei
//   daily    0.05 ETH = 50_000_000_000_000_000 wei
const DEFAULT_PER_TX_CAP_WEI = 10_000_000_000_000_000n
const DEFAULT_DAILY_CAP_WEI = 50_000_000_000_000_000n

function envBigInt(key: string, fallback: bigint): bigint {
  const raw = (process.env[key] ?? '').trim()
  if (!raw) return fallback
  try {
    const v = BigInt(raw)
    return v > 0n ? v : fallback
  } catch {
    return fallback
  }
}

function asObjectBody(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}
  return input as Record<string, unknown>
}

function parseBigInt(value: unknown): bigint | null {
  if (typeof value === 'bigint') return value > 0n ? value : null
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    try {
      return BigInt(Math.floor(value))
    } catch {
      return null
    }
  }
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  try {
    const parsed = BigInt(trimmed)
    return parsed > 0n ? parsed : null
  } catch {
    return null
  }
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

  const admin = getSessionAddress(req)
  if (!admin) {
    return res
      .status(401)
      .json({ success: false, error: 'Sign in required' } satisfies ApiEnvelope<never>)
  }
  if (!isAdminAddress(admin)) {
    return res.status(403).json({ success: false, error: 'Admin only' } satisfies ApiEnvelope<never>)
  }

  const rate = checkRateLimit(
    rateLimitKey('admin-arch-b-provision', admin.toLowerCase(), getClientIp(req)),
    RATE_LIMITS.adminAction,
  )
  if (!rate.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000))))
    return res
      .status(429)
      .json({ success: false, error: 'Too many requests' } satisfies ApiEnvelope<never>)
  }

  const body = asObjectBody(await readBoundedJsonObjectBody(req, { maxBytes: PROVISION_BODY_MAX_BYTES }))

  const profileId =
    typeof body.profileId === 'number' && Number.isFinite(body.profileId) && body.profileId > 0
      ? Math.floor(body.profileId)
      : NaN
  const smartWallet = typeof body.smartWallet === 'string' ? body.smartWallet : ''
  const privyOwnerWalletId =
    typeof body.privyOwnerWalletId === 'string' ? body.privyOwnerWalletId.trim() : ''
  const ownerEoa = typeof body.ownerEoa === 'string' ? body.ownerEoa : ''
  const ownerIndexRaw = body.ownerIndex
  const ownerIndex =
    typeof ownerIndexRaw === 'number' && Number.isFinite(ownerIndexRaw) && ownerIndexRaw >= 0
      ? Math.floor(ownerIndexRaw)
      : 0
  const paymasterPolicy =
    typeof body.paymasterPolicy === 'string' && body.paymasterPolicy.trim()
      ? body.paymasterPolicy.trim().slice(0, 64)
      : undefined
  const dryRun = body.dryRun === true

  if (!Number.isFinite(profileId)) {
    return res
      .status(400)
      .json({ success: false, error: 'invalid_profile_id' } satisfies ApiEnvelope<never>)
  }
  if (!/^0x[a-fA-F0-9]{40}$/.test(smartWallet)) {
    return res
      .status(400)
      .json({ success: false, error: 'invalid_smart_wallet' } satisfies ApiEnvelope<never>)
  }
  if (!/^0x[a-fA-F0-9]{40}$/.test(ownerEoa)) {
    return res
      .status(400)
      .json({ success: false, error: 'invalid_owner_eoa' } satisfies ApiEnvelope<never>)
  }
  if (!privyOwnerWalletId) {
    return res
      .status(400)
      .json({ success: false, error: 'invalid_privy_owner_wallet_id' } satisfies ApiEnvelope<never>)
  }

  const perTxCapWei =
    parseBigInt(body.perTxCapWei) ?? envBigInt('ARCH_B_DEFAULT_PER_TX_CAP_WEI', DEFAULT_PER_TX_CAP_WEI)
  const dailyCapWei =
    parseBigInt(body.dailyCapWei) ?? envBigInt('ARCH_B_DEFAULT_DAILY_CAP_WEI', DEFAULT_DAILY_CAP_WEI)
  if (perTxCapWei <= 0n || dailyCapWei <= 0n || perTxCapWei > dailyCapWei) {
    return res
      .status(400)
      .json({ success: false, error: 'invalid_caps' } satisfies ApiEnvelope<never>)
  }

  if (dryRun) {
    // Return what we would have inserted without writing.
    const existing = await resolveCommandIssuerContextByProfileId(profileId)
    return res.status(200).json({
      success: true,
      data: {
        dryRun: true,
        proposed: {
          profileId,
          smartWallet: smartWallet.toLowerCase(),
          privyOwnerWalletId,
          ownerEoa: ownerEoa.toLowerCase(),
          ownerIndex,
          perTxCapWei: perTxCapWei.toString(),
          dailyCapWei: dailyCapWei.toString(),
          paymasterPolicy: paymasterPolicy ?? 'cdp_default',
        },
        existing:
          existing.status === 'ready'
            ? {
                status: 'ready',
                smartWallet: existing.context.smartWallet,
                perTxCapWei: existing.context.perTxCapWei.toString(),
                dailyCapWei: existing.context.dailyCapWei.toString(),
                provisionedAt: existing.context.provisionedAt.toISOString(),
              }
            : { status: existing.status },
      },
    } satisfies ApiEnvelope<unknown>)
  }

  const outcome = await provisionCommandIssuerContext({
    profileId,
    smartWallet,
    privyOwnerWalletId,
    ownerEoa,
    ownerIndex,
    perTxCapWei,
    dailyCapWei,
    paymasterPolicy,
    provisionedBy: admin.toLowerCase(),
  })

  if (!outcome.ok) {
    const statusCode =
      outcome.error === 'db_unavailable' ? 503 : outcome.error === 'invalid_address' ? 400 : 500
    return res
      .status(statusCode)
      .json({ success: false, error: outcome.error } satisfies ApiEnvelope<never>)
  }

  // Audit trail: `provisioned_by` + `provisioned_at` on the context row itself
  // already record admin + timestamp; separate admin_logs entry intentionally
  // omitted to avoid coupling to the waitlist/creator-access enum.

  return res.status(200).json({
    success: true,
    data: {
      profileId: outcome.context.profileId,
      smartWallet: outcome.context.smartWallet,
      privyOwnerWalletId: outcome.context.privyOwnerWalletId,
      ownerEoa: outcome.context.ownerEoa,
      ownerIndex: outcome.context.ownerIndex,
      perTxCapWei: outcome.context.perTxCapWei.toString(),
      dailyCapWei: outcome.context.dailyCapWei.toString(),
      paymasterPolicy: outcome.context.paymasterPolicy,
      provisionedAt: outcome.context.provisionedAt.toISOString(),
    },
  } satisfies ApiEnvelope<unknown>)
}
