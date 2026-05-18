import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  checkRateLimit,
  getClientIp,
  getDb,
  handleOptions,
  RATE_LIMITS,
  rateLimitKey,
  resolveAuthorizedRequestPrincipal,
  setCors,
  setNoStore,
} from '../../../packages/server-core/src/index.js'
import { enqueueKeeprAction, getKeeprVaultByVaultAddress } from '../../../server/_lib/keepr/keeprRegistry.js'
import { isCswOwner } from '../../../server/_lib/wallet/cswOwner.js'

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/
const WAITLIST_CHAT_VAULT_ADDRESS = '0x0000000000000000000000000000000000004626'

type WaitlistXmtpJoinResponse = {
  queued: boolean
  actionId: number
  groupId: string
  identityAddress: `0x${string}`
}

function normalizeAddress(value: unknown): `0x${string}` | null {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (!ADDRESS_RE.test(raw)) return null
  return raw as `0x${string}`
}

function getWaitlistGroupId(): string | null {
  const groupId = String(process.env.WAITLIST_XMTP_GROUP_ID ?? '').trim()
  return groupId.length > 0 ? groupId : null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const authorizedPrincipal = await resolveAuthorizedRequestPrincipal(req)
  if (!authorizedPrincipal) {
    return res.status(401).json({ success: false, error: 'Authentication required' } satisfies ApiEnvelope<never>)
  }

  const limiter = checkRateLimit(
    rateLimitKey('waitlist-xmtp-join', String(authorizedPrincipal.profileId), getClientIp(req)),
    RATE_LIMITS.workspaceActions,
  )
  if (!limiter.allowed) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))))
    return res.status(429).json({ success: false, error: 'Too many requests' } satisfies ApiEnvelope<never>)
  }

  const groupId = getWaitlistGroupId()
  if (!groupId) {
    return res.status(503).json({
      success: false,
      error: 'waitlist_chat_not_configured',
    } satisfies ApiEnvelope<never>)
  }

  const waitlistVault = await getKeeprVaultByVaultAddress(WAITLIST_CHAT_VAULT_ADDRESS as `0x${string}`)
  if (!waitlistVault) {
    return res.status(503).json({
      success: false,
      error: 'waitlist_chat_vault_not_configured',
    } satisfies ApiEnvelope<never>)
  }

  const db = await getDb()
  if (!db) {
    return res.status(503).json({ success: false, error: 'Service unavailable' } satisfies ApiEnvelope<never>)
  }

  const profileResult = await db.sql`
    SELECT csw_address, primary_embedded_eoa
    FROM profiles
    WHERE id = ${authorizedPrincipal.profileId}
    LIMIT 1;
  `
  const row = profileResult.rows?.[0] ?? null
  const canonicalCswAddress = normalizeAddress(row?.csw_address)
  const embeddedEoaAddress = normalizeAddress(row?.primary_embedded_eoa)

  if (!canonicalCswAddress) {
    return res.status(409).json({
      success: false,
      error: 'canonical_csw_missing',
    } satisfies ApiEnvelope<never>)
  }
  if (!embeddedEoaAddress) {
    return res.status(409).json({
      success: false,
      error: 'embedded_eoa_missing',
    } satisfies ApiEnvelope<never>)
  }

  let embeddedIsOwner = false
  try {
    embeddedIsOwner = await isCswOwner(embeddedEoaAddress, canonicalCswAddress)
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : 'owner_check_failed'
    return res.status(502).json({
      success: false,
      error: message,
    } satisfies ApiEnvelope<never>)
  }

  if (!embeddedIsOwner) {
    return res.status(403).json({
      success: false,
      error: 'embedded_owner_not_installed',
    } satisfies ApiEnvelope<never>)
  }

  const action = await enqueueKeeprAction({
    vaultAddress: WAITLIST_CHAT_VAULT_ADDRESS as `0x${string}`,
    groupId,
    actionType: 'xmtp.group.add_member',
    action: {
      action: 'xmtp.group.add_member',
      wallet: canonicalCswAddress,
      reason: 'waitlist_owner_gated_auto_join',
    },
    dedupeKey: `waitlist-chat:add:${groupId}:${canonicalCswAddress}`,
  })

  return res.status(200).json({
    success: true,
    data: {
      queued: true,
      actionId: action.id,
      groupId,
      identityAddress: canonicalCswAddress,
    },
  } satisfies ApiEnvelope<WaitlistXmtpJoinResponse>)
}

