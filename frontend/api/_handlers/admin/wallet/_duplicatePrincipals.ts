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
} from '../../../../packages/server-core/src/index.js'



import { getSupabaseAdmin, isSupabaseAdminConfigured } from '../../../../server/_lib/supabaseAdmin.js'

type ProfileRow = {
  id: number
  email: string | null
  privy_user_id: string | null
  primary_wallet: string | null
  embedded_wallet: string | null
  primary_embedded_eoa: string | null
  primary_smart_wallet: string | null
  csw_address: string | null
  base_sub_account: string | null
  created_at: string | null
  updated_at: string | null
}

type ProfileWalletRow = {
  profile_id: number
  address: string | null
  is_canonical_smart_wallet: boolean
}

type DuplicatePrincipalProfile = {
  id: number
  email: string | null
  privyUserId: string | null
  canonicalSmartWallet: string | null
  sourceHits: string[]
}

type DuplicatePrincipalItem = {
  address: string
  profileCount: number
  profileIds: number[]
  sourceColumns: string[]
  profiles: DuplicatePrincipalProfile[]
}

type DuplicatePrincipalsResponse = {
  admin: string
  source: 'db' | 'supabase'
  scanLimit: number
  scannedProfiles: number
  scannedProfileWalletRows: number
  truncated: boolean
  totalDuplicateAddresses: number
  returnedCount: number
  items: DuplicatePrincipalItem[]
}

const PROFILE_SIGNAL_FIELDS = [
  { key: 'primary_wallet', source: 'profiles.primary_wallet' },
  { key: 'embedded_wallet', source: 'profiles.embedded_wallet' },
  { key: 'primary_embedded_eoa', source: 'profiles.primary_embedded_eoa' },
  { key: 'primary_smart_wallet', source: 'profiles.primary_smart_wallet' },
  { key: 'csw_address', source: 'profiles.csw_address' },
  { key: 'base_sub_account', source: 'profiles.base_sub_account' },
] as const

function parseIntParam(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  const floored = Math.floor(parsed)
  if (floored < min) return min
  if (floored > max) return max
  return floored
}

function normalizeAddress(value: unknown): string | null {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return /^0x[a-f0-9]{40}$/.test(raw) ? raw : null
}

function toIso(value: unknown): string | null {
  if (!value) return null
  try {
    return new Date(String(value)).toISOString()
  } catch {
    return null
  }
}

function hasAnySignalAddress(row: ProfileRow): boolean {
  for (const field of PROFILE_SIGNAL_FIELDS) {
    if (normalizeAddress(row[field.key])) return true
  }
  return false
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size))
  }
  return out
}

async function loadRowsFromDb(db: any, scanLimit: number): Promise<{ profiles: ProfileRow[]; profileWallets: ProfileWalletRow[] }> {
  const profilesResult = await db.query(
    `SELECT
       id,
       email,
       privy_user_id,
       primary_wallet,
       embedded_wallet,
       primary_embedded_eoa,
       primary_smart_wallet,
       csw_address,
       base_sub_account,
       created_at,
       updated_at
     FROM profiles
     WHERE primary_wallet IS NOT NULL
        OR embedded_wallet IS NOT NULL
        OR primary_embedded_eoa IS NOT NULL
        OR primary_smart_wallet IS NOT NULL
        OR csw_address IS NOT NULL
        OR base_sub_account IS NOT NULL
     ORDER BY updated_at DESC NULLS LAST, id DESC
     LIMIT $1;`,
    [scanLimit],
  )
  const profiles: ProfileRow[] = (profilesResult.rows ?? []).map((row: any) => ({
    id: Number(row.id),
    email: typeof row.email === 'string' ? row.email : null,
    privy_user_id: typeof row.privy_user_id === 'string' ? row.privy_user_id : null,
    primary_wallet: typeof row.primary_wallet === 'string' ? row.primary_wallet : null,
    embedded_wallet: typeof row.embedded_wallet === 'string' ? row.embedded_wallet : null,
    primary_embedded_eoa: typeof row.primary_embedded_eoa === 'string' ? row.primary_embedded_eoa : null,
    primary_smart_wallet: typeof row.primary_smart_wallet === 'string' ? row.primary_smart_wallet : null,
    csw_address: typeof row.csw_address === 'string' ? row.csw_address : null,
    base_sub_account: typeof row.base_sub_account === 'string' ? row.base_sub_account : null,
    created_at: typeof row.created_at === 'string' ? row.created_at : toIso(row.created_at),
    updated_at: typeof row.updated_at === 'string' ? row.updated_at : toIso(row.updated_at),
  }))
  const profileIds = profiles.map((row) => row.id).filter((id) => Number.isFinite(id) && id > 0)
  if (profileIds.length === 0) return { profiles: [], profileWallets: [] }

  const profileWalletsResult = await db.query(
    `SELECT profile_id, address, is_canonical_smart_wallet
     FROM profile_wallets
     WHERE profile_id = ANY($1::bigint[])
       AND address IS NOT NULL;`,
    [profileIds],
  )
  const profileWallets: ProfileWalletRow[] = (profileWalletsResult.rows ?? []).map((row: any) => ({
    profile_id: Number(row.profile_id),
    address: typeof row.address === 'string' ? row.address : null,
    is_canonical_smart_wallet: Boolean(row.is_canonical_smart_wallet),
  }))
  return { profiles, profileWallets }
}

async function loadRowsFromSupabase(supabase: any, scanLimit: number): Promise<{ profiles: ProfileRow[]; profileWallets: ProfileWalletRow[] }> {
  const pageSize = Math.min(1000, scanLimit)
  const profileRows: ProfileRow[] = []
  let offset = 0

  while (profileRows.length < scanLimit) {
    const remaining = scanLimit - profileRows.length
    const take = Math.min(pageSize, remaining)
    const { data, error } = await supabase
      .from('profiles')
      .select(
        [
          'id',
          'email',
          'privy_user_id',
          'primary_wallet',
          'embedded_wallet',
          'primary_embedded_eoa',
          'primary_smart_wallet',
          'csw_address',
          'base_sub_account',
          'created_at',
          'updated_at',
        ].join(','),
      )
      .order('updated_at', { ascending: false })
      .range(offset, offset + take - 1)
    if (error) throw new Error(`supabase_profiles_query_failed:${error.message}`)
    const rows = (data ?? []) as any[]
    if (rows.length === 0) break
    for (const row of rows) {
      profileRows.push({
        id: Number(row.id),
        email: typeof row.email === 'string' ? row.email : null,
        privy_user_id: typeof row.privy_user_id === 'string' ? row.privy_user_id : null,
        primary_wallet: typeof row.primary_wallet === 'string' ? row.primary_wallet : null,
        embedded_wallet: typeof row.embedded_wallet === 'string' ? row.embedded_wallet : null,
        primary_embedded_eoa: typeof row.primary_embedded_eoa === 'string' ? row.primary_embedded_eoa : null,
        primary_smart_wallet: typeof row.primary_smart_wallet === 'string' ? row.primary_smart_wallet : null,
        csw_address: typeof row.csw_address === 'string' ? row.csw_address : null,
        base_sub_account: typeof row.base_sub_account === 'string' ? row.base_sub_account : null,
        created_at: typeof row.created_at === 'string' ? row.created_at : toIso(row.created_at),
        updated_at: typeof row.updated_at === 'string' ? row.updated_at : toIso(row.updated_at),
      })
      if (profileRows.length >= scanLimit) break
    }
    if (rows.length < take) break
    offset += take
  }

  const profiles = profileRows.filter(hasAnySignalAddress)
  const profileIds = profiles.map((row) => row.id).filter((id) => Number.isFinite(id) && id > 0)
  if (profileIds.length === 0) return { profiles: [], profileWallets: [] }

  const profileWallets: ProfileWalletRow[] = []
  for (const idChunk of chunkArray(profileIds, 200)) {
    const { data, error } = await supabase
      .from('profile_wallets')
      .select('profile_id,address,is_canonical_smart_wallet')
      .in('profile_id', idChunk)
    if (error) throw new Error(`supabase_profile_wallets_query_failed:${error.message}`)
    for (const row of (data ?? []) as any[]) {
      profileWallets.push({
        profile_id: Number(row.profile_id),
        address: typeof row.address === 'string' ? row.address : null,
        is_canonical_smart_wallet: Boolean(row.is_canonical_smart_wallet),
      })
    }
  }

  return { profiles, profileWallets }
}

function buildDuplicateDiagnostics(params: {
  profiles: ProfileRow[]
  profileWallets: ProfileWalletRow[]
  query: string
  limit: number
  offset: number
}): { total: number; items: DuplicatePrincipalItem[] } {
  const profileById = new Map<number, ProfileRow>()
  for (const profile of params.profiles) {
    if (!Number.isFinite(profile.id) || profile.id <= 0) continue
    profileById.set(profile.id, profile)
  }

  const canonicalByProfile = new Map<number, string>()
  for (const row of params.profileWallets) {
    if (!row.is_canonical_smart_wallet) continue
    const address = normalizeAddress(row.address)
    if (!address) continue
    if (!canonicalByProfile.has(row.profile_id)) canonicalByProfile.set(row.profile_id, address)
  }

  const addressGroups = new Map<string, { profileIds: Set<number>; sourceColumns: Set<string> }>()
  const sourcesByAddressProfile = new Map<string, Set<string>>()
  const addLink = (addressRaw: unknown, profileId: number, source: string): void => {
    const address = normalizeAddress(addressRaw)
    if (!address) return
    if (!profileById.has(profileId)) return

    const group = addressGroups.get(address) ?? { profileIds: new Set<number>(), sourceColumns: new Set<string>() }
    group.profileIds.add(profileId)
    group.sourceColumns.add(source)
    addressGroups.set(address, group)

    const key = `${address}:${String(profileId)}`
    const sourceSet = sourcesByAddressProfile.get(key) ?? new Set<string>()
    sourceSet.add(source)
    sourcesByAddressProfile.set(key, sourceSet)
  }

  for (const profile of params.profiles) {
    for (const signalField of PROFILE_SIGNAL_FIELDS) {
      addLink(profile[signalField.key], profile.id, signalField.source)
    }
  }
  for (const wallet of params.profileWallets) {
    addLink(wallet.address, wallet.profile_id, 'profile_wallets.address')
  }

  const q = params.query.trim().toLowerCase()
  const allItems: DuplicatePrincipalItem[] = []
  for (const [address, group] of addressGroups.entries()) {
    if (group.profileIds.size <= 1) continue
    const profileIds = Array.from(group.profileIds).sort((a, b) => a - b)
    const profiles: DuplicatePrincipalProfile[] = profileIds
      .map((profileId) => {
        const row = profileById.get(profileId)
        if (!row) return null
        const fallbackCanonical =
          normalizeAddress(row.primary_smart_wallet) ??
          normalizeAddress(row.csw_address) ??
          normalizeAddress(row.base_sub_account) ??
          null
        const sourceHits = Array.from(sourcesByAddressProfile.get(`${address}:${String(profileId)}`) ?? []).sort()
        return {
          id: profileId,
          email: row.email,
          privyUserId: row.privy_user_id,
          canonicalSmartWallet: canonicalByProfile.get(profileId) ?? fallbackCanonical,
          sourceHits,
        } satisfies DuplicatePrincipalProfile
      })
      .filter(Boolean) as DuplicatePrincipalProfile[]

    const item: DuplicatePrincipalItem = {
      address,
      profileCount: profileIds.length,
      profileIds,
      sourceColumns: Array.from(group.sourceColumns).sort(),
      profiles,
    }

    if (q) {
      const profileIdMatch = item.profileIds.some((id) => String(id).includes(q))
      const sourceMatch = item.sourceColumns.some((source) => source.toLowerCase().includes(q))
      const emailMatch = item.profiles.some((profile) => String(profile.email ?? '').toLowerCase().includes(q))
      if (!item.address.includes(q) && !profileIdMatch && !sourceMatch && !emailMatch) continue
    }
    allItems.push(item)
  }

  allItems.sort((a, b) => b.profileCount - a.profileCount || a.address.localeCompare(b.address))
  const total = allItems.length
  const items = allItems.slice(params.offset, params.offset + params.limit)
  return { total, items }
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

  const limit = parseIntParam((req.query as any)?.limit, 100, 1, 500)
  const offset = parseIntParam((req.query as any)?.offset, 0, 0, 10_000)
  const scanLimit = parseIntParam((req.query as any)?.scan, 2000, 100, 10_000)
  const q = typeof (req.query as any)?.q === 'string' ? String((req.query as any).q) : ''

  const db = isDbConfigured() ? await getDb() : null
  const source: 'db' | 'supabase' =
    db?.query ? 'db' : isSupabaseAdminConfigured() ? 'supabase' : 'db'

  let profiles: ProfileRow[] = []
  let profileWallets: ProfileWalletRow[] = []
  try {
    if (db?.query) {
      const rows = await loadRowsFromDb(db, scanLimit)
      profiles = rows.profiles
      profileWallets = rows.profileWallets
    } else if (isSupabaseAdminConfigured()) {
      const supabase = getSupabaseAdmin()
      const rows = await loadRowsFromSupabase(supabase, scanLimit)
      profiles = rows.profiles
      profileWallets = rows.profileWallets
    } else {
      return res.status(500).json({
        success: false,
        error: 'Database not configured (set POSTGRES_URL/DATABASE_URL or Supabase admin env vars).',
      } satisfies ApiEnvelope<never>)
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error ?? 'query_failed')
    return res.status(500).json({
      success: false,
      error: `Duplicate-principals query failed: ${msg}`,
    } satisfies ApiEnvelope<never>)
  }

  const diagnostics = buildDuplicateDiagnostics({
    profiles,
    profileWallets,
    query: q,
    limit,
    offset,
  })

  const data: DuplicatePrincipalsResponse = {
    admin,
    source,
    scanLimit,
    scannedProfiles: profiles.length,
    scannedProfileWalletRows: profileWallets.length,
    truncated: profiles.length >= scanLimit,
    totalDuplicateAddresses: diagnostics.total,
    returnedCount: diagnostics.items.length,
    items: diagnostics.items,
  }

  return res.status(200).json({
    success: true,
    data,
  } satisfies ApiEnvelope<DuplicatePrincipalsResponse>)
}
