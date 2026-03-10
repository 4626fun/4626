import { ensureCanonicalWalletsSchema } from './canonicalWalletsSchema.js'
import { getDb, isDbConfigured } from './postgres.js'

function normalizeLower(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function isAddressLike(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

export type ProfileWalletAuthority = {
  profileId: number
  canonicalSmartWalletAddress: string | null
  activeOwnerWalletAddress: string | null
}

type ProfileWalletAuthorityRow = {
  id?: unknown
  primary_wallet?: unknown
  primary_embedded_eoa?: unknown
  primary_smart_wallet?: unknown
  csw_address?: unknown
  base_sub_account?: unknown
  canonical_wallet?: unknown
}

function deriveCanonicalSmartWallet(row: ProfileWalletAuthorityRow): string | null {
  const canonical = normalizeLower(row.canonical_wallet)
  if (canonical && isAddressLike(canonical)) return canonical

  const fallback = normalizeLower(row.primary_smart_wallet || row.csw_address || row.base_sub_account)
  return fallback && isAddressLike(fallback) ? fallback : null
}

function deriveActiveOwnerWallet(row: ProfileWalletAuthorityRow, canonicalSmartWalletAddress: string | null): string | null {
  const embedded = normalizeLower(row.primary_embedded_eoa)
  if (embedded && isAddressLike(embedded)) return embedded

  const primary = normalizeLower(row.primary_wallet)
  if (!primary || !isAddressLike(primary)) return null
  if (canonicalSmartWalletAddress && primary === canonicalSmartWalletAddress) return null
  return primary
}

async function readProfileWalletAuthorityRow(db: { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> }, profileId: number): Promise<ProfileWalletAuthorityRow | null> {
  const result = await db.sql`
    SELECT
      p.id,
      p.primary_wallet,
      p.primary_embedded_eoa,
      p.primary_smart_wallet,
      p.csw_address,
      p.base_sub_account,
      canonical.address AS canonical_wallet
    FROM profiles p
    LEFT JOIN LATERAL (
      SELECT pw.address
      FROM profile_wallets pw
      WHERE pw.profile_id = p.id
        AND pw.is_canonical_smart_wallet = true
      LIMIT 1
    ) canonical ON true
    WHERE p.id = ${profileId}
    LIMIT 1;
  `
  return (result.rows?.[0] as ProfileWalletAuthorityRow | undefined) ?? null
}

export async function readProfileWalletAuthority(params: {
  db: { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> }
  profileId: number
}): Promise<ProfileWalletAuthority | null> {
  await ensureCanonicalWalletsSchema(params.db as any)

  const row = await readProfileWalletAuthorityRow(params.db, params.profileId)
  const profileId = typeof row?.id === 'number' ? row.id : row?.id ? Number(row.id) : NaN
  if (!row || !Number.isFinite(profileId)) return null

  const canonicalSmartWalletAddress = deriveCanonicalSmartWallet(row)
  const activeOwnerWalletAddress = deriveActiveOwnerWallet(row, canonicalSmartWalletAddress)

  return {
    profileId: Math.floor(profileId),
    canonicalSmartWalletAddress,
    activeOwnerWalletAddress,
  }
}

export async function isAuthorizedWalletForProfile(params: {
  db: { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> }
  profileId: number
  address: string
  allowCanonical?: boolean
  allowActiveOwner?: boolean
}): Promise<boolean> {
  const normalized = normalizeLower(params.address)
  if (!normalized || !isAddressLike(normalized)) return false

  const authority = await readProfileWalletAuthority({
    db: params.db,
    profileId: params.profileId,
  })
  if (!authority) return false

  if (params.allowCanonical !== false && authority.canonicalSmartWalletAddress === normalized) return true
  if (params.allowActiveOwner !== false && authority.activeOwnerWalletAddress === normalized) return true
  return false
}

export async function resolveAuthorizedWalletProfile(address: string): Promise<ProfileWalletAuthority | null> {
  const input = normalizeLower(address)
  if (!input || !isAddressLike(input)) return null
  if (!isDbConfigured()) return null

  const db = await getDb()
  if (!db) return null

  await ensureCanonicalWalletsSchema(db as any)

  const profileResult = await db.sql`
    SELECT p.id
    FROM profiles p
    LEFT JOIN LATERAL (
      SELECT pw.address
      FROM profile_wallets pw
      WHERE pw.profile_id = p.id
        AND pw.is_canonical_smart_wallet = true
      LIMIT 1
    ) canonical ON true
    WHERE LOWER(p.primary_wallet) = ${input}
       OR LOWER(p.primary_embedded_eoa) = ${input}
       OR LOWER(p.primary_smart_wallet) = ${input}
       OR LOWER(p.csw_address) = ${input}
       OR LOWER(p.base_sub_account) = ${input}
       OR LOWER(canonical.address) = ${input}
    LIMIT 1;
  `

  const profileId = typeof profileResult.rows?.[0]?.id === 'number'
    ? Number(profileResult.rows?.[0]?.id)
    : profileResult.rows?.[0]?.id
      ? Number(profileResult.rows?.[0]?.id)
      : NaN
  if (!Number.isFinite(profileId)) return null

  const authority = await readProfileWalletAuthority({
    db: db as any,
    profileId: Math.floor(profileId),
  })
  if (!authority) return null

  if (authority.canonicalSmartWalletAddress === input || authority.activeOwnerWalletAddress === input) {
    return authority
  }

  return null
}

export async function resolveCanonicalSmartWalletAddress(address: string): Promise<string | null> {
  const input = normalizeLower(address)
  if (!input || !isAddressLike(input)) return null
  if (!isDbConfigured()) return null

  const db = await getDb()
  if (!db) return null

  await ensureCanonicalWalletsSchema(db as any)

  const profileResult = await db.sql`
    SELECT id, primary_smart_wallet, csw_address
    FROM profiles
    WHERE LOWER(primary_smart_wallet) = ${input}
       OR LOWER(csw_address) = ${input}
       OR id IN (
         SELECT profile_id
         FROM profile_wallets
         WHERE LOWER(address) = ${input}
       )
    LIMIT 1;
  `

  const profile = profileResult.rows?.[0]
  if (!profile) return null

  const canonicalResult = await db.sql`
    SELECT address
    FROM profile_wallets
    WHERE profile_id = ${profile.id}
      AND is_canonical_smart_wallet = true
    LIMIT 1;
  `
  const canonical = normalizeLower(canonicalResult.rows?.[0]?.address)
  if (canonical && isAddressLike(canonical)) return canonical

  const fallback = normalizeLower(profile.primary_smart_wallet || profile.csw_address)
  return fallback && isAddressLike(fallback) ? fallback : null
}
