import { ensureCanonicalWalletsSchema } from './canonicalWalletsSchema.js'
import { getDb, isDbConfigured } from './postgres.js'

function normalizeLower(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function isAddressLike(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
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
