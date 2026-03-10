import { ensureCanonicalWalletsSchema } from './canonicalWalletsSchema.js'
import { getDb, isDbConfigured } from './postgres.js'
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
    LIMIT 2;
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

async function resolvePersistedIdentityForKnownAddress(address: string): Promise<PersistedWalletIdentity | null> {
  const input = normalizeLower(address)
  if (!input || !isAddressLike(input)) return null
  if (!isDbConfigured()) return null

  const db = await getDb()
  if (!db) return null

  await ensureCanonicalWalletsSchema(db as any)

  const profiles = await findProfilesForAddress(db, input)
  if (profiles.length !== 1) return null

  const profile = profiles[0]
  const persisted = await readPersistedIdentity(db as any, profile.id)
  return {
    profileId: profile.id,
    canonicalSmartWallet: normalizeAddress(persisted?.canonicalSmartWallet),
    embeddedEoa: normalizeAddress(persisted?.embeddedEoa),
    privyUserId: profile.privyUserId,
  }
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
