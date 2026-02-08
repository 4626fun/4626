import type { VercelRequest, VercelResponse } from '@vercel/node'

import { type ApiEnvelope, handleOptions, setCors, setNoStore } from '../../../../server/auth/_shared.js'
import { getDb, isDbConfigured } from '../../../../server/_lib/postgres.js'
import { getSessionAddress, isAdminAddress } from '../../../../server/_lib/session.js'
import { normalizeReferralCode } from '../../../../server/_lib/referrals.js'
import { ensureWaitlistSchema } from '../../../../server/_lib/waitlistSchema.js'

type WaitlistDetail = {
  id: number
  email: string
  persona: string | null
  primaryWallet: string | null
  solanaWallet: string | null
  privyUserId: string | null
  embeddedWallet: string | null
  embeddedWalletChain: string | null
  embeddedWalletClientType: string | null
  baseSubAccount: string | null
  hasCreatorCoin: boolean | null
  farcasterFid: number | null
  contactPreference: string | null
  verifications: unknown | null
  appAccessStatus: string | null
  appAccessDecisionNote: string | null
  appAccessDecidedAt: string | null
  appAccessDecidedBy: string | null
  referralCode: string | null
  referredByCode: string | null
  referredBySignupId: number | null
  referralClaimedAt: string | null
  profileCompletedAt: string | null
  cswAddress: string | null
  createdAt: string
  updatedAt: string
  // Pre-provisioning data
  preprovisionedAt: string | null
  preprovServerWalletId: string | null
  preprovServerWalletAddress: string | null
  preprovCoinAddress: string | null
  preprovCoinSymbol: string | null
  preprovFarcasterUsername: string | null
  preprovZoraHandle: string | null
}

type DetailResponse = {
  admin: string
  signup: WaitlistDetail | null
}

function toIso(value: any): string | null {
  if (!value) return null
  try {
    return new Date(value).toISOString()
  } catch {
    return null
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const admin = getSessionAddress(req)
  if (!admin) {
    return res.status(401).json({ success: false, error: 'Sign in required' } satisfies ApiEnvelope<never>)
  }
  if (!isAdminAddress(admin)) {
    return res.status(403).json({ success: false, error: 'Admin only' } satisfies ApiEnvelope<never>)
  }

  const idRaw = typeof (req.query as any)?.id === 'string' ? String((req.query as any).id) : ''
  const emailRaw = typeof (req.query as any)?.email === 'string' ? String((req.query as any).email) : ''
  const refRaw = typeof (req.query as any)?.ref === 'string' ? String((req.query as any).ref) : ''

  const id = idRaw ? Number(idRaw) : NaN
  const email = emailRaw.trim()
  const referral = refRaw ? normalizeReferralCode(refRaw) : ''

  if (!Number.isFinite(id) && !email && !referral) {
    return res.status(400).json({ success: false, error: 'Missing id, email, or ref' } satisfies ApiEnvelope<never>)
  }

  const db = isDbConfigured() ? await getDb() : null
  if (!db) {
    return res.status(500).json({ success: false, error: 'Database not configured' } satisfies ApiEnvelope<never>)
  }

  await ensureWaitlistSchema(db as any)

  if (!db.query) {
    return res.status(500).json({ success: false, error: 'Database driver missing query()' } satisfies ApiEnvelope<never>)
  }

  let row: any | null = null

  if (Number.isFinite(id)) {
    const q = await db.query(
      `SELECT *
       FROM profiles
       WHERE id = $1
       LIMIT 1;`,
      [Math.floor(id)],
    )
    row = q.rows?.[0] ?? null
  } else if (email) {
    const q = await db.query(
      `SELECT *
       FROM profiles
       WHERE LOWER(email) = LOWER($1)
       LIMIT 1;`,
      [email],
    )
    row = q.rows?.[0] ?? null
  } else if (referral) {
    const q = await db.query(
      `SELECT *
       FROM profiles
       WHERE referral_code = $1
       LIMIT 1;`,
      [referral],
    )
    row = q.rows?.[0] ?? null
  }

  if (!row) {
    return res.status(200).json({ success: true, data: { admin, signup: null } satisfies DetailResponse } satisfies ApiEnvelope<DetailResponse>)
  }

  const detail: WaitlistDetail = {
    id: typeof row.id === 'number' ? row.id : Number(row.id),
    email: typeof row.email === 'string' ? row.email : String(row.email || ''),
    persona: typeof row.persona === 'string' ? row.persona : null,
    primaryWallet: typeof row.primary_wallet === 'string' ? row.primary_wallet : null,
    solanaWallet: typeof row.solana_wallet === 'string' ? row.solana_wallet : null,
    privyUserId: typeof row.privy_user_id === 'string' ? row.privy_user_id : null,
    embeddedWallet: typeof row.embedded_wallet === 'string' ? row.embedded_wallet : null,
    embeddedWalletChain: typeof row.embedded_wallet_chain === 'string' ? row.embedded_wallet_chain : null,
    embeddedWalletClientType: typeof row.embedded_wallet_client_type === 'string' ? row.embedded_wallet_client_type : null,
    baseSubAccount: typeof row.base_sub_account === 'string' ? row.base_sub_account : null,
    hasCreatorCoin: typeof row.has_creator_coin === 'boolean' ? row.has_creator_coin : row.has_creator_coin === null ? null : Boolean(row.has_creator_coin),
    farcasterFid: typeof row.farcaster_fid === 'number' ? row.farcaster_fid : row.farcaster_fid ? Number(row.farcaster_fid) : null,
    contactPreference: typeof row.contact_preference === 'string' ? row.contact_preference : null,
    verifications: row.verifications ?? null,
    appAccessStatus: typeof row.app_access_status === 'string' ? row.app_access_status : null,
    appAccessDecisionNote: typeof row.app_access_decision_note === 'string' ? row.app_access_decision_note : null,
    appAccessDecidedAt: toIso(row.app_access_decided_at),
    appAccessDecidedBy: typeof row.app_access_decided_by === 'string' ? row.app_access_decided_by : null,
    referralCode: typeof row.referral_code === 'string' ? row.referral_code : null,
    referredByCode: typeof row.referred_by_code === 'string' ? row.referred_by_code : null,
    referredBySignupId:
      typeof row.referred_by_signup_id === 'number'
        ? row.referred_by_signup_id
        : row.referred_by_signup_id
          ? Number(row.referred_by_signup_id)
          : null,
    referralClaimedAt: toIso(row.referral_claimed_at),
    profileCompletedAt: toIso(row.profile_completed_at),
    cswAddress: typeof row.csw_address === 'string' ? row.csw_address : null,
    createdAt: toIso(row.created_at) ?? '',
    updatedAt: toIso(row.updated_at) ?? '',
    // Pre-provisioning data
    preprovisionedAt: toIso(row.preprovisioned_at),
    preprovServerWalletId: typeof row.preprov_server_wallet_id === 'string' ? row.preprov_server_wallet_id : null,
    preprovServerWalletAddress: typeof row.preprov_server_wallet_address === 'string' ? row.preprov_server_wallet_address : null,
    preprovCoinAddress: typeof row.preprov_coin_address === 'string' ? row.preprov_coin_address : null,
    preprovCoinSymbol: typeof row.preprov_coin_symbol === 'string' ? row.preprov_coin_symbol : null,
    preprovFarcasterUsername: typeof row.preprov_farcaster_username === 'string' ? row.preprov_farcaster_username : null,
    preprovZoraHandle: typeof row.preprov_zora_handle === 'string' ? row.preprov_zora_handle : null,
  }

  return res.status(200).json({
    success: true,
    data: { admin, signup: detail } satisfies DetailResponse,
  } satisfies ApiEnvelope<DetailResponse>)
}
