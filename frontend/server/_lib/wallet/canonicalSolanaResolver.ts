import { ensureCanonicalWalletsSchema } from './canonicalWalletsSchema.js'
import { getDb, isDbConfigured } from '../db/postgres.js'

type Db = { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> }

function isValidSolanaAddress(value: unknown): value is string {
  const s = typeof value === 'string' ? value.trim() : ''
  if (!s) return false
  if (s.length < 32 || s.length > 44) return false
  return /^[1-9A-HJ-NP-Za-km-z]+$/.test(s)
}

export async function resolveCanonicalSolanaWalletByProfileId(db: Db, profileId: number): Promise<string | null> {
  if (!Number.isFinite(profileId) || profileId <= 0) return null
  await ensureCanonicalWalletsSchema(db)

  const canonicalByRole = await db.sql`
    SELECT pw.address
    FROM profile_wallets pw
    LEFT JOIN wallets w ON LOWER(w.address) = LOWER(pw.address)
    WHERE pw.profile_id = ${profileId}
      AND pw.is_canonical_solana_wallet = true
      AND (LOWER(COALESCE(w.chain, '')) = 'solana' OR w.chain IS NULL)
    LIMIT 1;
  `
  const canonicalRoleAddress = canonicalByRole?.rows?.[0]?.address
  if (isValidSolanaAddress(canonicalRoleAddress)) return canonicalRoleAddress.trim()

  const profileFallback = await db.sql`
    SELECT canonical_solana_wallet, solana_wallet
    FROM profiles
    WHERE id = ${profileId}
    LIMIT 1;
  `
  const canonicalColumn = profileFallback?.rows?.[0]?.canonical_solana_wallet
  if (isValidSolanaAddress(canonicalColumn)) return canonicalColumn.trim()
  const compatibilityColumn = profileFallback?.rows?.[0]?.solana_wallet
  if (isValidSolanaAddress(compatibilityColumn)) return compatibilityColumn.trim()
  return null
}

export async function resolveCanonicalSolanaWalletByPrincipalAddress(address: string): Promise<string | null> {
  const principal = typeof address === 'string' ? address.trim().toLowerCase() : ''
  if (!/^0x[a-f0-9]{40}$/.test(principal)) return null
  if (!isDbConfigured()) return null
  const db = (await getDb()) as Db | null
  if (!db) return null
  await ensureCanonicalWalletsSchema(db)

  const profile = await db.sql`
    SELECT p.id
    FROM profiles p
    WHERE LOWER(p.primary_wallet) = ${principal}
       OR LOWER(p.embedded_wallet) = ${principal}
       OR LOWER(p.csw_address) = ${principal}
       OR LOWER(p.base_sub_account) = ${principal}
       OR LOWER(p.primary_smart_wallet) = ${principal}
       OR LOWER(p.primary_embedded_eoa) = ${principal}
       OR p.id IN (
         SELECT pw.profile_id
         FROM profile_wallets pw
         WHERE LOWER(pw.address) = ${principal}
       )
    ORDER BY
      CASE
        WHEN EXISTS (
          SELECT 1
          FROM profile_wallets pw
          WHERE pw.profile_id = p.id
            AND LOWER(pw.address) = ${principal}
        ) THEN 0
        ELSE 1
      END ASC,
      CASE
        WHEN EXISTS (
          SELECT 1
          FROM profile_wallets pw
          LEFT JOIN wallets w ON LOWER(w.address) = LOWER(pw.address)
          WHERE pw.profile_id = p.id
            AND pw.is_canonical_solana_wallet = true
            AND (LOWER(COALESCE(w.chain, '')) = 'solana' OR w.chain IS NULL)
        ) THEN 0
        WHEN p.canonical_solana_wallet IS NOT NULL AND LENGTH(TRIM(p.canonical_solana_wallet)) > 0 THEN 0
        WHEN p.solana_wallet IS NOT NULL AND LENGTH(TRIM(p.solana_wallet)) > 0 THEN 0
        ELSE 1
      END ASC,
      p.updated_at DESC NULLS LAST,
      p.id ASC
    LIMIT 1;
  `
  const profileIdRaw = profile?.rows?.[0]?.id
  const profileId = typeof profileIdRaw === 'number' ? profileIdRaw : Number(profileIdRaw)
  if (!Number.isFinite(profileId) || profileId <= 0) return null
  return resolveCanonicalSolanaWalletByProfileId(db, profileId)
}

