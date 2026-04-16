import { ensureCanonicalWalletsSchema } from './canonicalWalletsSchema.js'
import { getDb, isDbConfigured } from '../db/postgres.js'
import { readPersistedIdentity } from './walletSync.js'

function normalizeLower(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function isAddressLike(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

function normalizeOptionalString(value: unknown): string | null {
  const normalized = typeof value === 'string' ? value.trim() : ''
  return normalized ? normalized : null
}

function normalizeAddress(value: unknown): string | null {
  const normalized = normalizeLower(value)
  return normalized && isAddressLike(normalized) ? normalized : null
}

type ProfileMatch = {
  id: number
  privyUserId: string | null
}

export type PersistedWalletIdentity = {
  profileId: number
  canonicalSmartWallet: string | null
  embeddedEoa: string | null
  privyUserId: string | null
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

function deriveActiveOwnerWallet(
  row: ProfileWalletAuthorityRow,
  canonicalSmartWalletAddress: string | null,
): string | null {
  const embedded = normalizeLower(row.primary_embedded_eoa)
  if (embedded && isAddressLike(embedded)) return embedded

  const primary = normalizeLower(row.primary_wallet)
  if (!primary || !isAddressLike(primary)) return null
  if (canonicalSmartWalletAddress && primary === canonicalSmartWalletAddress) return null
  return primary
}

async function readProfileWalletAuthorityRow(
  db: { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> },
  profileId: number,
): Promise<ProfileWalletAuthorityRow | null> {
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
       OR LOWER(p.embedded_wallet) = ${input}
       OR LOWER(p.primary_embedded_eoa) = ${input}
       OR LOWER(p.primary_smart_wallet) = ${input}
       OR LOWER(p.csw_address) = ${input}
       OR LOWER(p.base_sub_account) = ${input}
       OR LOWER(canonical.address) = ${input}
       OR p.id IN (
         SELECT pw.profile_id
         FROM profile_wallets pw
         WHERE LOWER(pw.address) = ${input}
           AND (
             pw.is_primary = true
             OR pw.is_embedded_eoa = true
             OR pw.is_canonical_smart_wallet = true
           )
       )
    LIMIT 1;
  `

  const profileId =
    typeof profileResult.rows?.[0]?.id === 'number'
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

  const profileWalletMatchResult = await db.sql`
    SELECT 1
    FROM profile_wallets
    WHERE profile_id = ${Math.floor(profileId)}
      AND LOWER(address) = ${input}
      AND (
        is_primary = true
        OR is_embedded_eoa = true
        OR is_canonical_smart_wallet = true
      )
    LIMIT 1;
  `
  const matchedProfileWallet =
    Array.isArray(profileWalletMatchResult.rows) && profileWalletMatchResult.rows.length > 0

  if (matchedProfileWallet || authority.canonicalSmartWalletAddress === input || authority.activeOwnerWalletAddress === input) {
    return authority
  }

  return null
}

async function findProfilesForAddress(
  db: Awaited<ReturnType<typeof getDb>>,
  input: string,
): Promise<ProfileMatch[]> {
  if (!db) return []

  const profileResult = await db.sql`
    SELECT id, privy_user_id
    FROM profiles
    WHERE LOWER(primary_wallet) = ${input}
       OR LOWER(embedded_wallet) = ${input}
       OR LOWER(primary_embedded_eoa) = ${input}
       OR LOWER(primary_smart_wallet) = ${input}
       OR LOWER(csw_address) = ${input}
       OR LOWER(base_sub_account) = ${input}
       OR id IN (
         SELECT profile_id
         FROM profile_wallets
         WHERE LOWER(address) = ${input}
       )
    LIMIT 10;
  `

  return (profileResult.rows ?? [])
    .map((row) => {
      const id = Number(row?.id ?? 0)
      if (!Number.isFinite(id) || id <= 0) return null
      return {
        id,
        privyUserId: normalizeOptionalString(row?.privy_user_id),
      } satisfies ProfileMatch
    })
    .filter((row): row is ProfileMatch => row !== null)
}

function buildPersistedWalletIdentity(
  profile: ProfileMatch,
  persisted: Awaited<ReturnType<typeof readPersistedIdentity>> | null,
): PersistedWalletIdentity {
  return {
    profileId: profile.id,
    canonicalSmartWallet: normalizeAddress(persisted?.canonicalSmartWallet),
    embeddedEoa: normalizeAddress(persisted?.embeddedEoa),
    privyUserId: profile.privyUserId,
  }
}

async function resolvePersistedIdentityForKnownAddress(address: string): Promise<PersistedWalletIdentity | null> {
  const input = normalizeLower(address)
  if (!input || !isAddressLike(input)) return null
  if (!isDbConfigured()) return null

  const db = await getDb()
  if (!db) return null

  await ensureCanonicalWalletsSchema(db as any)

  const profiles = await findProfilesForAddress(db, input)
  if (profiles.length === 0) return null

  if (profiles.length === 1) {
    const profile = profiles[0]
    const persisted = await readPersistedIdentity(db as any, profile.id)
    return buildPersistedWalletIdentity(profile, persisted)
  }

  const resolved = await Promise.all(
    profiles.map(async (profile) => {
      const persisted = await readPersistedIdentity(db as any, profile.id)
      return buildPersistedWalletIdentity(profile, persisted)
    }),
  )

  const exactMatches = resolved.filter((identity) => {
    const canonical = normalizeAddress(identity.canonicalSmartWallet)
    const embedded = normalizeAddress(identity.embeddedEoa)
    if (!canonical || !embedded) return false
    return canonical === input || embedded === input
  })

  if (exactMatches.length === 1) return exactMatches[0]
  return null
}

export async function resolvePersistedWalletIdentity(address: string): Promise<PersistedWalletIdentity | null> {
  const input = normalizeLower(address)
  if (!input || !isAddressLike(input)) return null

  const identity = await resolvePersistedIdentityForKnownAddress(input)
  if (!identity) return null

  const canonical = normalizeAddress(identity.canonicalSmartWallet)
  const embedded = normalizeAddress(identity.embeddedEoa)
  if (!canonical || !embedded) return null
  if (input !== canonical && input !== embedded) return null

  return {
    ...identity,
    canonicalSmartWallet: canonical,
    embeddedEoa: embedded,
  }
}

export async function resolvePersistedWalletIdentityForProfileId(profileId: number): Promise<PersistedWalletIdentity | null> {
  if (!Number.isFinite(profileId) || profileId <= 0) return null
  if (!isDbConfigured()) return null

  const db = await getDb()
  if (!db) return null

  await ensureCanonicalWalletsSchema(db as any)

  const profileResult = await db.sql`
    SELECT id, privy_user_id
    FROM profiles
    WHERE id = ${Math.floor(profileId)}
    LIMIT 1;
  `

  const profileRow = profileResult.rows?.[0]
  const id = Number(profileRow?.id ?? 0)
  if (!Number.isFinite(id) || id <= 0) return null

  const persisted = await readPersistedIdentity(db as any, id)
  const identity = buildPersistedWalletIdentity(
    {
      id,
      privyUserId: normalizeOptionalString(profileRow?.privy_user_id),
    },
    persisted,
  )
  if (!identity.canonicalSmartWallet || !identity.embeddedEoa) return null
  return identity
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
  const canonical = normalizeAddress(canonicalResult.rows?.[0]?.address)
  if (canonical) return canonical

  return normalizeAddress(profile.primary_smart_wallet || profile.csw_address)
}
