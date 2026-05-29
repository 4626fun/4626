/**
 * Architecture B Phase 5 — sub-account provisioning (prepare).
 *
 * POST /api/arch-b/sub-account/provision/prepare
 *
 * SIWE-gated. Returns the deterministic sub-account address plus the unsigned
 * EIP-712 SpendPermission payload for the parent CSW to sign. The client then
 * submits the signature to /commit. No DB write happens here.
 *
 * Body (optional, max 8 KB):
 *   { caps?: { perTxCapWei?: string; dailyCapWei?: string } }
 *
 * Responses:
 *   200 { success: true, data: PreparePayload }
 *   400 invalid_body | invalid_caps
 *   401 unauthenticated
 *   409 profile_not_ready | missing_privy_wallet | invalid_parent_account
 *   503 db_unavailable | parent_csw_probe_failed
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
  logger,
} from '../../../packages/server-core/src/index.js'
import {
  NATIVE_TOKEN_SENTINEL,
  SPEND_PERMISSION_EIP712_DOMAIN,
  SPEND_PERMISSION_TYPES,
  hashSpendPermission,
} from '../../../server/_lib/wallet/spendPermission.js'
import { computeSubAccountAddress } from '../../../server/_lib/wallet/subAccountAddress.js'
import { resolveOwnerWalletId } from '../../../server/_lib/wallet/privyOwnerWalletIdResolver.js'
import type { Address } from 'viem'
import type { SpendPermissionPayload } from '@4626/server-core'
import { randomBytes } from 'node:crypto'
import {
  getBasePublicClient,
  isContractAddressByBytecode,
} from '../../../server/_lib/wallet/subAccountProvisionVerify.js'

declare const process: { env: Record<string, string | undefined> }

const PREPARE_BODY_MAX_BYTES = 8_192
const CHAIN_ID_BASE = 8453

const DEFAULT_PER_TX_CAP_WEI = 100_000_000_000_000_000n // 0.1 ETH
const DEFAULT_DAILY_CAP_WEI = 500_000_000_000_000_000n // 0.5 ETH
const MAX_PER_TX_CAP_WEI = 1_000_000_000_000_000_000n // 1 ETH
const MAX_DAILY_CAP_WEI = 10_000_000_000_000_000_000n // 10 ETH
const PERIOD_SECONDS = 86_400
const END_SECONDS_FROM_NOW = 100 * 365 * 24 * 60 * 60 // ~100 years, clamped below
const INT32_MAX = 2_147_483_647

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

function asObjectBody(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}
  return input as Record<string, unknown>
}

function randomSaltHex(): `0x${string}` {
  return ('0x' + randomBytes(32).toString('hex')) as `0x${string}`
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
    rateLimitKey('arch-b-subacct-prepare', principal.address, getClientIp(req)),
    RATE_LIMITS.adminAction,
  )
  if (!rate.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000))))
    return res
      .status(429)
      .json({ success: false, error: 'Too many requests' } satisfies ApiEnvelope<never>)
  }

  const rawBody = await readBoundedJsonObjectBody(req, { maxBytes: PREPARE_BODY_MAX_BYTES }).catch(
    () => null,
  )
  const body = asObjectBody(rawBody)
  const capsBody = asObjectBody(body.caps)

  const requestedPerTx = parseBigInt(capsBody.perTxCapWei)
  const requestedDaily = parseBigInt(capsBody.dailyCapWei)

  const perTxCapWei = (() => {
    const base = requestedPerTx ?? envBigInt('ARCH_B_DEFAULT_PER_TX_CAP_WEI', DEFAULT_PER_TX_CAP_WEI)
    return base > MAX_PER_TX_CAP_WEI ? MAX_PER_TX_CAP_WEI : base
  })()
  const dailyCapWei = (() => {
    const base = requestedDaily ?? envBigInt('ARCH_B_DEFAULT_DAILY_CAP_WEI', DEFAULT_DAILY_CAP_WEI)
    return base > MAX_DAILY_CAP_WEI ? MAX_DAILY_CAP_WEI : base
  })()

  if (perTxCapWei <= 0n || dailyCapWei <= 0n || perTxCapWei > dailyCapWei) {
    return res
      .status(400)
      .json({ success: false, error: 'invalid_caps' } satisfies ApiEnvelope<never>)
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

  if (!privyUserId) {
    return res
      .status(409)
      .json({ success: false, error: 'profile_missing_privy_user' } satisfies ApiEnvelope<never>)
  }
  if (!/^0x[a-fA-F0-9]{40}$/.test(ownerEoaRaw)) {
    return res
      .status(409)
      .json({ success: false, error: 'profile_missing_owner_eoa' } satisfies ApiEnvelope<never>)
  }
  if (!/^0x[a-fA-F0-9]{40}$/.test(parentCswRaw)) {
    return res
      .status(409)
      .json({ success: false, error: 'profile_missing_parent_csw' } satisfies ApiEnvelope<never>)
  }

  const parentCsw = parentCswRaw.toLowerCase() as Address
  const ownerEoa = ownerEoaRaw.toLowerCase() as Address

  const publicClient = getBasePublicClient()
  try {
    const parentIsContract = await isContractAddressByBytecode({
      publicClient: publicClient as unknown as Parameters<typeof isContractAddressByBytecode>[0]['publicClient'],
      address: parentCsw,
    })
    if (!parentIsContract) {
      logger.warn('[arch-b/subacct/prepare] canonical parent is not a contract CSW', {
        profileId: principal.profileId,
        parentCsw,
      })
      return res
        .status(409)
        .json({ success: false, error: 'invalid_parent_account' } satisfies ApiEnvelope<never>)
    }
  } catch (err) {
    logger.error('[arch-b/subacct/prepare] parent CSW bytecode probe failed', {
      profileId: principal.profileId,
      parentCsw,
      error: err instanceof Error ? err.message : String(err),
    })
    return res
      .status(503)
      .json({ success: false, error: 'parent_csw_probe_failed' } satisfies ApiEnvelope<never>)
  }

  // Resolve Privy wallet id for the owner EOA. Required even in prepare so
  // /commit does not have to reach Privy a second time unnecessarily.
  const appId = (process.env.PRIVY_APP_ID ?? '').trim()
  const appSecret = (process.env.PRIVY_APP_SECRET ?? '').trim()
  if (!appId || !appSecret) {
    logger.error('[arch-b/subacct/prepare] Privy server auth not configured')
    return res
      .status(500)
      .json({ success: false, error: 'privy_not_configured' } satisfies ApiEnvelope<never>)
  }
  const privyClient = new PrivyClient(appId, appSecret)
  const privyUser = await privyClient.getUserById(privyUserId)
  const walletOutcome = resolveOwnerWalletId(privyUser, ownerEoa)
  if (walletOutcome.status !== 'ready') {
    return res
      .status(409)
      .json({ success: false, error: walletOutcome.status } satisfies ApiEnvelope<never>)
  }
  const privyOwnerWalletId = walletOutcome.candidate.id
  if (!privyOwnerWalletId) {
    return res
      .status(409)
      .json({ success: false, error: 'missing_privy_wallet' } satisfies ApiEnvelope<never>)
  }

  let subAccountAddress: Address
  try {
    subAccountAddress = await computeSubAccountAddress({
      publicClient: publicClient as unknown as Parameters<typeof computeSubAccountAddress>[0]['publicClient'],
      parentCsw,
      ownerEoa,
      profileId: principal.profileId,
    })
  } catch (err) {
    logger.error('[arch-b/subacct/prepare] computeSubAccountAddress failed', {
      profileId: principal.profileId,
      error: err instanceof Error ? err.message : String(err),
    })
    return res
      .status(503)
      .json({ success: false, error: 'sub_account_derivation_failed' } satisfies ApiEnvelope<never>)
  }

  const nowSec = Math.floor(Date.now() / 1000)
  const endSec = Math.min(nowSec + END_SECONDS_FROM_NOW, INT32_MAX)
  const saltHex = randomSaltHex()

  const permission: SpendPermissionPayload = {
    account: parentCsw,
    spender: subAccountAddress,
    token: NATIVE_TOKEN_SENTINEL,
    allowance: dailyCapWei.toString(),
    period: PERIOD_SECONDS,
    start: nowSec,
    end: endSec,
    salt: saltHex,
    extraData: '0x',
  }

  const permissionHash = hashSpendPermission(permission, CHAIN_ID_BASE)
  const domain = SPEND_PERMISSION_EIP712_DOMAIN(CHAIN_ID_BASE)

  return res.status(200).json({
    success: true,
    data: {
      profileId: principal.profileId,
      subAccountAddress,
      parentCswAddress: parentCsw,
      ownerEoaAddress: ownerEoa,
      privyOwnerWalletId,
      permission,
      permissionHash,
      eip712: {
        domain,
        types: SPEND_PERMISSION_TYPES,
        primaryType: 'SpendPermission',
        message: permission,
      },
      perTxCapWei: perTxCapWei.toString(),
      dailyCapWei: dailyCapWei.toString(),
    },
  } satisfies ApiEnvelope<unknown>)
}
