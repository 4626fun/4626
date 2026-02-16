import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  setCors,
  setNoStore,
} from '../../../server/auth/_shared.js'
import { getDb } from '../../../server/_lib/postgres.js'
import { readRequestPrincipalAddress } from '../../../server/_lib/requestPrincipal.js'
import { ensureWaitlistSchema } from '../../../server/_lib/waitlistSchema.js'

type ConnectedAccount = {
  address: string
  chain: string | null
  walletType: string | null
  provider: string | null
  source: string
  isPrimary: boolean
  isCanonicalSmartWallet: boolean
  isEmbeddedEoa: boolean
  verifiedAt: string | null
}

type WaitlistMeResponse = {
  profileId: number
  email: string | null
  contactPreference: string | null
  primaryWallet: string | null
  embeddedWallet: string | null
  embeddedWalletChain: string | null
  embeddedWalletClientType: string | null
  cswAddress: string | null
  privyUserId: string | null
  appAccessStatus: string | null
  updatedAt: string | null
  connectedAccounts: ConnectedAccount[]
}

function normalizeAddress(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeLowerAddress(value: unknown): string {
  return normalizeAddress(value).toLowerCase()
}

function isSyntheticEmail(v: unknown): boolean {
  const value = typeof v === 'string' ? v.trim().toLowerCase() : ''
  if (!value) return false
  if (value.endsWith('@noemail.4626.fun')) return true
  return (
    /^solinfer-.*@example\.com$/.test(value) ||
    /^wallet-.*@example\.com$/.test(value) ||
    /^anon-.*@example\.com$/.test(value) ||
    /^0x[0-9a-f]+@example\.com$/.test(value)
  )
}

function upsertAccount(
  map: Map<string, ConnectedAccount>,
  input: Partial<ConnectedAccount> & { address: string },
): void {
  const normalized = normalizeAddress(input.address)
  if (!normalized) return
  const key = normalized.toLowerCase()
  const prev = map.get(key)
  if (!prev) {
    map.set(key, {
      address: normalized,
      chain: input.chain ?? null,
      walletType: input.walletType ?? null,
      provider: input.provider ?? null,
      source: input.source ?? 'profile',
      isPrimary: Boolean(input.isPrimary),
      isCanonicalSmartWallet: Boolean(input.isCanonicalSmartWallet),
      isEmbeddedEoa: Boolean(input.isEmbeddedEoa),
      verifiedAt: input.verifiedAt ?? null,
    })
    return
  }
  map.set(key, {
    address: prev.address,
    chain: prev.chain ?? input.chain ?? null,
    walletType: prev.walletType ?? input.walletType ?? null,
    provider: prev.provider ?? input.provider ?? null,
    source: prev.source === 'profile_wallets' ? prev.source : (input.source ?? prev.source),
    isPrimary: prev.isPrimary || Boolean(input.isPrimary),
    isCanonicalSmartWallet: prev.isCanonicalSmartWallet || Boolean(input.isCanonicalSmartWallet),
    isEmbeddedEoa: prev.isEmbeddedEoa || Boolean(input.isEmbeddedEoa),
    verifiedAt: prev.verifiedAt ?? input.verifiedAt ?? null,
  })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const address = readRequestPrincipalAddress(req)
  if (!address) {
    return res.status(200).json({ success: true, data: null } satisfies ApiEnvelope<WaitlistMeResponse | null>)
  }

  const db = await getDb()
  if (!db) {
    return res.status(503).json({ success: false, error: 'Service unavailable' } satisfies ApiEnvelope<never>)
  }

  await ensureWaitlistSchema(db as any)

  const record = await db.sql`
    SELECT
      id,
      email,
      contact_preference,
      primary_wallet,
      embedded_wallet,
      embedded_wallet_chain,
      embedded_wallet_client_type,
      csw_address,
      primary_smart_wallet,
      primary_embedded_eoa,
      base_sub_account,
      privy_user_id,
      app_access_status,
      updated_at,
      created_at
    FROM profiles
    WHERE LOWER(primary_wallet) = ${address}
       OR LOWER(embedded_wallet) = ${address}
       OR LOWER(csw_address) = ${address}
       OR LOWER(base_sub_account) = ${address}
       OR LOWER(primary_smart_wallet) = ${address}
       OR LOWER(primary_embedded_eoa) = ${address}
       OR EXISTS (
         SELECT 1
         FROM profile_wallets pw
         WHERE pw.profile_id = profiles.id
           AND LOWER(pw.address) = ${address}
       )
    ORDER BY
      CASE
        WHEN email IS NULL THEN 2
        WHEN LOWER(email) LIKE '%@noemail.4626.fun' THEN 1
        WHEN LOWER(email) ~ '^(solinfer-|wallet-|anon-|0x[0-9a-f]+).*@example\\.com$' THEN 1
        ELSE 0
      END ASC,
      updated_at DESC,
      created_at ASC
    LIMIT 1;
  `

  const row = record?.rows?.[0] ?? null
  if (!row) {
    return res.status(200).json({ success: true, data: null } satisfies ApiEnvelope<WaitlistMeResponse | null>)
  }

  const profileId = typeof row.id === 'number' ? row.id : Number(row.id)
  if (!Number.isFinite(profileId) || profileId <= 0) {
    return res.status(200).json({ success: true, data: null } satisfies ApiEnvelope<WaitlistMeResponse | null>)
  }

  const accountMap = new Map<string, ConnectedAccount>()
  upsertAccount(accountMap, {
    address: normalizeAddress(row.primary_wallet),
    chain: 'evm',
    source: 'primary_wallet_column',
    isPrimary: true,
  })
  upsertAccount(accountMap, {
    address: normalizeAddress(row.embedded_wallet),
    chain: typeof row.embedded_wallet_chain === 'string' ? row.embedded_wallet_chain : 'evm',
    walletType: 'embedded_eoa',
    provider: typeof row.embedded_wallet_client_type === 'string' ? row.embedded_wallet_client_type : null,
    source: 'embedded_wallet_column',
    isEmbeddedEoa: true,
  })
  upsertAccount(accountMap, {
    address: normalizeAddress(row.primary_embedded_eoa),
    chain: 'evm',
    walletType: 'embedded_eoa',
    source: 'primary_embedded_eoa_column',
    isEmbeddedEoa: true,
  })
  upsertAccount(accountMap, {
    address: normalizeAddress(row.csw_address),
    chain: 'evm',
    walletType: 'smart_wallet',
    source: 'csw_address_column',
    isCanonicalSmartWallet: true,
  })
  upsertAccount(accountMap, {
    address: normalizeAddress(row.primary_smart_wallet),
    chain: 'evm',
    walletType: 'smart_wallet',
    source: 'primary_smart_wallet_column',
    isCanonicalSmartWallet: true,
  })
  upsertAccount(accountMap, {
    address: normalizeAddress(row.base_sub_account),
    chain: 'evm',
    walletType: 'smart_wallet',
    source: 'base_sub_account_column',
    isCanonicalSmartWallet: true,
  })

  const wallets = await db.sql`
    SELECT
      pw.address,
      pw.is_primary,
      pw.is_canonical_smart_wallet,
      pw.is_embedded_eoa,
      pw.verified_at,
      w.chain,
      w.wallet_type,
      w.provider
    FROM profile_wallets pw
    LEFT JOIN wallets w ON LOWER(w.address) = LOWER(pw.address)
    WHERE pw.profile_id = ${profileId}
    ORDER BY pw.is_primary DESC, pw.is_canonical_smart_wallet DESC, pw.verified_at DESC NULLS LAST, pw.address ASC;
  `
  for (const walletRow of wallets?.rows ?? []) {
    const addressValue = normalizeAddress(walletRow.address)
    if (!addressValue) continue
    upsertAccount(accountMap, {
      address: addressValue,
      chain: typeof walletRow.chain === 'string' ? walletRow.chain : null,
      walletType: typeof walletRow.wallet_type === 'string' ? walletRow.wallet_type : null,
      provider: typeof walletRow.provider === 'string' ? walletRow.provider : null,
      source: 'profile_wallets',
      isPrimary: walletRow.is_primary === true,
      isCanonicalSmartWallet: walletRow.is_canonical_smart_wallet === true,
      isEmbeddedEoa: walletRow.is_embedded_eoa === true,
      verifiedAt: walletRow.verified_at ? new Date(walletRow.verified_at).toISOString() : null,
    })
  }

  const connectedAccounts = Array.from(accountMap.values()).sort((a, b) => {
    const rank = (v: ConnectedAccount): number =>
      (v.isPrimary ? 100 : 0) + (v.isCanonicalSmartWallet ? 10 : 0) + (v.isEmbeddedEoa ? 5 : 0)
    return rank(b) - rank(a) || a.address.localeCompare(b.address)
  })

  const data: WaitlistMeResponse = {
    profileId,
    email: typeof row.email === 'string' ? row.email : null,
    contactPreference: typeof row.contact_preference === 'string' ? row.contact_preference : null,
    primaryWallet: typeof row.primary_wallet === 'string' ? row.primary_wallet : null,
    embeddedWallet: typeof row.embedded_wallet === 'string' ? row.embedded_wallet : null,
    embeddedWalletChain: typeof row.embedded_wallet_chain === 'string' ? row.embedded_wallet_chain : null,
    embeddedWalletClientType: typeof row.embedded_wallet_client_type === 'string' ? row.embedded_wallet_client_type : null,
    cswAddress: typeof row.csw_address === 'string' ? row.csw_address : null,
    privyUserId: typeof row.privy_user_id === 'string' ? row.privy_user_id : null,
    appAccessStatus: typeof row.app_access_status === 'string' ? row.app_access_status : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
    connectedAccounts,
  }

  // If the chosen profile only has a historical synthetic email, surface it as null.
  if (isSyntheticEmail(data.email)) data.email = null

  return res.status(200).json({ success: true, data } satisfies ApiEnvelope<WaitlistMeResponse>)
}
