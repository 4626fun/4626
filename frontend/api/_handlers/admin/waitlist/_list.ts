import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  setCors,
  setNoStore,
  getDb,
  isDbConfigured,
  getSessionAddress,
  isAdminAddress,
} from '@4626/server-core'



import { getSupabaseAdmin, isSupabaseAdminConfigured } from '../../../../server/_lib/db/supabaseAdmin.js'
import { ensureWaitlistSchema } from '../../../../server/_lib/onboarding/waitlistSchema.js'

type WaitlistListItem = {
  id: number
  email: string
  persona: string | null
  primaryWallet: string | null
  cswAddress: string | null
  solanaWallet: string | null
  embeddedWallet: string | null
  embeddedWalletChain: string | null
  embeddedWalletClientType: string | null
  referralCode: string | null
  contactPreference: string | null
  appAccessStatus: string | null
  appAccessDecidedAt: string | null
  createdAt: string
  updatedAt: string
  // Pre-provisioning status
  preprovisioned: boolean
  preprovZoraHandle: string | null
  preprovCoinSymbol: string | null
}

type ListResponse = {
  admin: string
  items: WaitlistListItem[]
}

function toIso(value: any): string {
  if (!value) return ''
  try {
    return new Date(value).toISOString()
  } catch {
    return ''
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

  const qRaw = typeof (req.query as any)?.q === 'string' ? String((req.query as any).q) : ''
  const q = qRaw.trim()

  const mapItem = (row: any): WaitlistListItem => ({
    id: typeof row.id === 'number' ? row.id : Number(row.id),
    email: typeof row.email === 'string' ? row.email : String(row.email || ''),
    persona: typeof row.persona === 'string' ? row.persona : null,
    primaryWallet: typeof row.primary_wallet === 'string' ? row.primary_wallet : null,
    cswAddress: typeof row.csw_address === 'string' ? row.csw_address : null,
    solanaWallet: typeof row.solana_wallet === 'string' ? row.solana_wallet : null,
    embeddedWallet: typeof row.embedded_wallet === 'string' ? row.embedded_wallet : null,
    embeddedWalletChain: typeof row.embedded_wallet_chain === 'string' ? row.embedded_wallet_chain : null,
    embeddedWalletClientType: typeof row.embedded_wallet_client_type === 'string' ? row.embedded_wallet_client_type : null,
    referralCode: typeof row.referral_code === 'string' ? row.referral_code : null,
    contactPreference: typeof row.contact_preference === 'string' ? row.contact_preference : null,
    appAccessStatus: typeof row.app_access_status === 'string' ? row.app_access_status : null,
    appAccessDecidedAt: toIso(row.app_access_decided_at) || null,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    preprovisioned: Boolean(row.preprovisioned_at),
    preprovZoraHandle: typeof row.preprov_zora_handle === 'string' ? row.preprov_zora_handle : null,
    preprovCoinSymbol: typeof row.preprov_coin_symbol === 'string' ? row.preprov_coin_symbol : null,
  })

  let items: WaitlistListItem[] = []

  const db = isDbConfigured() ? await getDb() : null
  if (db?.query) {
    await ensureWaitlistSchema(db as any)
    const where = q
      ? `WHERE email ILIKE $1
         OR primary_wallet ILIKE $1
         OR solana_wallet ILIKE $1
         OR referral_code ILIKE $1
         OR embedded_wallet ILIKE $1
         OR privy_user_id ILIKE $1`
      : ''
    const params = q ? [`%${q}%`] : []

    const result = await db.query(
      `SELECT
         id,
         email,
         persona,
         primary_wallet,
         csw_address,
         solana_wallet,
         embedded_wallet,
         embedded_wallet_chain,
         embedded_wallet_client_type,
         referral_code,
         contact_preference,
         app_access_status,
         app_access_decided_at,
         created_at,
         updated_at,
         preprovisioned_at,
         preprov_zora_handle,
         preprov_coin_symbol
       FROM profiles
       ${where}
       ORDER BY created_at DESC
       LIMIT 200;`,
      params,
    )
    items = (result.rows ?? []).map(mapItem)
  } else if (isSupabaseAdminConfigured()) {
    const supabase = getSupabaseAdmin()
    let query = supabase
      .from('profiles')
      .select(
        [
          'id',
          'email',
          'persona',
          'primary_wallet',
          'csw_address',
          'solana_wallet',
          'embedded_wallet',
          'embedded_wallet_chain',
          'embedded_wallet_client_type',
          'referral_code',
          'contact_preference',
          'app_access_status',
          'app_access_decided_at',
          'created_at',
          'updated_at',
          'preprovisioned_at',
          'preprov_zora_handle',
          'preprov_coin_symbol',
        ].join(','),
      )
      .order('created_at', { ascending: false })
      .limit(200)
    if (q) {
      const term = q.replace(/,/g, ' ')
      query = query.or(
        [
          `email.ilike.%${term}%`,
          `primary_wallet.ilike.%${term}%`,
          `solana_wallet.ilike.%${term}%`,
          `referral_code.ilike.%${term}%`,
          `embedded_wallet.ilike.%${term}%`,
          `privy_user_id.ilike.%${term}%`,
        ].join(','),
      )
    }
    const { data, error } = await query
    if (error) {
      return res.status(500).json({
        success: false,
        error: `Supabase query failed: ${error.message}`,
      } satisfies ApiEnvelope<never>)
    }
    items = (data ?? []).map(mapItem)
  } else {
    return res.status(500).json({
      success: false,
      error: 'Database not configured (set POSTGRES_URL/DATABASE_URL or Supabase admin env vars).',
    } satisfies ApiEnvelope<never>)
  }

  return res.status(200).json({
    success: true,
    data: { admin, items } satisfies ListResponse,
  } satisfies ApiEnvelope<ListResponse>)
}
