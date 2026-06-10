/**
 * Architecture B Phase 2 — user self-service enroll endpoint.
 *
 * POST /api/arch-b/enroll
 *
 * Bridges a "linked" profile to "execution-ready" after the user has delegated
 * their owner EOA to the kpr-privy-signer quorum via the client-side
 * Privy delegateWallet() call. This endpoint:
 *
 *   1. Resolves the authenticated SIWE session to a profile.
 *   2. Loads privy_user_id + primary_embedded_eoa from the profiles row.
 *   3. Fetches the Privy user and resolves the owner wallet id.
 *   4. Verifies the kpr-privy-signer quorum appears in additional_signers.
 *   5. Smoke-tests signing with the resolved wallet.
 *   6. Calls provisionCommandIssuerContext to persist the execution context.
 *
 * Responses:
 *   200 { success: true, data: { profileId, smartWallet, ... } }
 *   400 profile_not_ready | profile_missing_privy_user | profile_missing_owner_eoa
 *   401 unauthenticated
 *   409 delegation_not_configured | invalid_parent_account
 *   500 smoke_sign_failed | provision error
 *   503 parent_csw_probe_failed
 */

import { PrivyClient } from '@privy-io/server-auth'
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
} from '@4626/server-core'
import {
  provisionCommandIssuerContext,
  envBigInt,
} from '@4626/server-core'
import {
  fetchPrivyWalletFull,
  secp256k1SignHash,
} from '../../../server/_lib/wallet/privyWalletApi.js'
import { resolveOwnerWalletId } from '../../../server/_lib/wallet/privyOwnerWalletIdResolver.js'
import {
  getBasePublicClient,
  isContractAddressByBytecode,
} from '../../../server/_lib/wallet/subAccountProvisionVerify.js'

declare const process: { env: Record<string, string | undefined> }

const ENROLL_BODY_MAX_BYTES = 8_192

function getQuorumId(): string {
  const nodeEnv = (process.env.NODE_ENV ?? '').trim().toLowerCase()
  const isProd = nodeEnv === 'production' || Boolean((process.env.VERCEL ?? '').trim())
  const fromEnv = (process.env.ARCH_B_SIGNER_QUORUM_ID ?? '').trim()
  if (!fromEnv && isProd) {
    throw new Error('ARCH_B_SIGNER_QUORUM_ID missing in production')
  }
  return fromEnv || 'lr8vgu2l0wnmwg824n4jrtr3'
}

function getPrivyServerAuth(): { appId: string; appSecret: string } {
  const appId = (process.env.PRIVY_APP_ID ?? '').trim()
  const appSecret = (process.env.PRIVY_APP_SECRET ?? '').trim()
  if (!appId || !appSecret) {
    throw new Error('Privy server auth not configured (missing PRIVY_APP_ID / PRIVY_APP_SECRET).')
  }
  return { appId, appSecret }
}

function normalizeSignerId(entry: { signer_id?: string; id?: string } | string): string | null {
  if (typeof entry === 'string') return entry.trim() || null
  const v = entry.signer_id ?? entry.id ?? ''
  return typeof v === 'string' && v.trim() ? v.trim() : null
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
      .status(400)
      .json({ success: false, error: 'profile_not_ready' } satisfies ApiEnvelope<never>)
  }

  const principalAddress = principal.address

  const rate = checkRateLimit(
    rateLimitKey('arch-b-enroll', principalAddress, getClientIp(req)),
    RATE_LIMITS.adminAction,
  )
  if (!rate.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000))))
    return res
      .status(429)
      .json({ success: false, error: 'Too many requests' } satisfies ApiEnvelope<never>)
  }

  // Consume body (not used but must be read to avoid stalled connections)
  await readBoundedJsonObjectBody(req, { maxBytes: ENROLL_BODY_MAX_BYTES }).catch(() => null)

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

  const { profileId, canonicalSmartWalletAddress } = principal
  if (!/^0x[a-fA-F0-9]{40}$/.test(canonicalSmartWalletAddress)) {
    return res
      .status(409)
      .json({ success: false, error: 'invalid_parent_account' } satisfies ApiEnvelope<never>)
  }
  const publicClient = getBasePublicClient()
  try {
    const parentIsContract = await isContractAddressByBytecode({
      publicClient: publicClient as unknown as Parameters<typeof isContractAddressByBytecode>[0]['publicClient'],
      address: canonicalSmartWalletAddress.toLowerCase() as `0x${string}`,
    })
    if (!parentIsContract) {
      return res
        .status(409)
        .json({ success: false, error: 'invalid_parent_account' } satisfies ApiEnvelope<never>)
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message.slice(0, 256) : String(err).slice(0, 256)
    return res
      .status(503)
      .json({ success: false, error: 'parent_csw_probe_failed', data: { message } } satisfies ApiEnvelope<unknown>)
  }

  // Load privy_user_id and primary_embedded_eoa from profiles
  const profileRow = await db.sql`
    SELECT privy_user_id, primary_embedded_eoa
    FROM profiles
    WHERE id = ${profileId}
    LIMIT 1
  `
  const row = profileRow.rows?.[0] as Record<string, unknown> | undefined
  const privyUserId = typeof row?.privy_user_id === 'string' ? row.privy_user_id.trim() : ''
  const ownerEoa = typeof row?.primary_embedded_eoa === 'string' ? row.primary_embedded_eoa.trim() : ''

  if (!privyUserId) {
    return res
      .status(400)
      .json({ success: false, error: 'profile_missing_privy_user' } satisfies ApiEnvelope<never>)
  }
  if (!ownerEoa) {
    return res
      .status(400)
      .json({ success: false, error: 'profile_missing_owner_eoa' } satisfies ApiEnvelope<never>)
  }

  // Resolve the Privy owner wallet id
  const { appId, appSecret } = getPrivyServerAuth()
  const privyClient = new PrivyClient(appId, appSecret)
  const privyUser = await privyClient.getUserById(privyUserId)

  const walletOutcome = resolveOwnerWalletId(privyUser, ownerEoa)
  if (walletOutcome.status !== 'ready') {
    return res
      .status(400)
      .json({ success: false, error: walletOutcome.status } satisfies ApiEnvelope<never>)
  }

  // At this point status is 'ready'; candidate carries the wallet id
  const walletId = walletOutcome.candidate.id
  if (!walletId) {
    return res
      .status(400)
      .json({ success: false, error: 'no_server_id' } satisfies ApiEnvelope<never>)
  }

  // Verify delegation quorum
  const quorumId = getQuorumId()
  const walletFull = await fetchPrivyWalletFull(walletId)
  if (!walletFull) {
    return res
      .status(400)
      .json({ success: false, error: 'privy_wallet_not_found' } satisfies ApiEnvelope<never>)
  }

  const actualSigners = walletFull.additional_signers
    .map(normalizeSignerId)
    .filter((s): s is string => s !== null)

  if (!actualSigners.includes(quorumId)) {
    return res.status(409).json({
      success: false,
      error: 'delegation_not_configured',
      data: {
        expectedQuorumId: quorumId,
        walletId,
        actualSigners,
      },
    } satisfies ApiEnvelope<unknown>)
  }

  // Smoke test signing
  try {
    await secp256k1SignHash({
      walletId,
      hash: '0x0000000000000000000000000000000000000000000000000000000000000001',
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message.slice(0, 256) : String(err).slice(0, 256)
    return res.status(500).json({
      success: false,
      error: 'smoke_sign_failed',
      data: { message },
    } satisfies ApiEnvelope<unknown>)
  }

  // Provision execution context
  const perTxCapWei = envBigInt('ARCH_B_DEFAULT_PER_TX_CAP_WEI', 10_000_000_000_000_000n)
  const dailyCapWei = envBigInt('ARCH_B_DEFAULT_DAILY_CAP_WEI', 50_000_000_000_000_000n)

  const outcome = await provisionCommandIssuerContext({
    profileId,
    smartWallet: canonicalSmartWalletAddress,
    privyOwnerWalletId: walletId,
    ownerEoa,
    ownerIndex: 0,
    perTxCapWei,
    dailyCapWei,
    paymasterPolicy: 'cdp_default',
    provisionedBy: 'user:' + principalAddress,
  })

  if (!outcome.ok) {
    const statusCode =
      outcome.error === 'db_unavailable' ? 503 : outcome.error === 'invalid_address' ? 400 : 500
    return res
      .status(statusCode)
      .json({ success: false, error: outcome.error } satisfies ApiEnvelope<never>)
  }

  return res.status(200).json({
    success: true,
    data: {
      profileId: outcome.context.profileId,
      smartWallet: outcome.context.smartWallet,
      privyOwnerWalletId: outcome.context.privyOwnerWalletId,
      perTxCapWei: outcome.context.perTxCapWei.toString(),
      dailyCapWei: outcome.context.dailyCapWei.toString(),
      paymasterPolicy: outcome.context.paymasterPolicy,
      provisionedAt: outcome.context.provisionedAt.toISOString(),
    },
  } satisfies ApiEnvelope<unknown>)
}
