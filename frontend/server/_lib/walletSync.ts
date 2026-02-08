import { buildDeterministicSyntheticEmail } from './profileSync.js'
import { type ClassifiedLinkedAccounts, classifyLinkedAccounts, type MappedWallet, type PrivyUserLike } from './walletMapping.js'
import { ensureCanonicalWalletsSchema } from './canonicalWalletsSchema.js'

type Db = { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> }

type ExistingProfile = { id: number; email: string | null }

export type SyncUserWalletsResult = {
  profileId: number
  canonicalSmartWallet: { address: string; provider: string } | null
  embeddedEoa: { address: string; chainType: string; clientType: string | null } | null
  connectedWallets: Array<{ address: string; walletType: string; provider: string }>
  primaryWalletAddress: string | null
}

function normalizeLower(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function normalizeAddress(value: unknown): string | null {
  const raw = normalizeLower(value)
  if (!/^0x[a-f0-9]{40}$/.test(raw)) return null
  return raw
}

function getPrivyUserId(user: PrivyUserLike): string | null {
  const id = typeof user?.id === 'string' ? user.id.trim() : ''
  return id.length > 0 ? id : null
}

async function findProfileByLegacyWallet(db: Db, address: string): Promise<ExistingProfile | null> {
  const result = await db.sql`
    SELECT id, email
    FROM profiles
    WHERE LOWER(primary_wallet) = ${address}
       OR LOWER(embedded_wallet) = ${address}
       OR LOWER(csw_address) = ${address}
       OR LOWER(base_sub_account) = ${address}
       OR LOWER(primary_smart_wallet) = ${address}
       OR LOWER(primary_embedded_eoa) = ${address}
    LIMIT 1;
  `
  const row = result.rows?.[0] as { id?: number; email?: string | null } | undefined
  if (!row?.id) return null
  return { id: Number(row.id), email: row.email ?? null }
}

async function findExistingProfile(db: Db, privyUserId: string | null, wallets: MappedWallet[]): Promise<ExistingProfile | null> {
  if (privyUserId) {
    const byPrivy = await db.sql`
      SELECT id, email
      FROM profiles
      WHERE privy_user_id = ${privyUserId}
      LIMIT 1;
    `
    const row = byPrivy.rows?.[0] as { id?: number; email?: string | null } | undefined
    if (row?.id) return { id: Number(row.id), email: row.email ?? null }
  }

  for (const wallet of wallets) {
    const byWalletJoin = await db.sql`
      SELECT p.id, p.email
      FROM profile_wallets pw
      JOIN profiles p ON p.id = pw.profile_id
      WHERE LOWER(pw.address) = ${wallet.address}
      LIMIT 1;
    `
    const row = byWalletJoin.rows?.[0] as { id?: number; email?: string | null } | undefined
    if (row?.id) return { id: Number(row.id), email: row.email ?? null }
  }

  for (const wallet of wallets) {
    const legacy = await findProfileByLegacyWallet(db, wallet.address)
    if (legacy) return legacy
  }

  return null
}

type PersistedIdentity = {
  primaryWallet: string | null
  canonicalSmartWallet: string | null
  embeddedEoa: string | null
}

async function readPersistedIdentity(db: Db, profileId: number): Promise<PersistedIdentity | null> {
  const result = await db.sql`
    SELECT
      primary_wallet,
      primary_smart_wallet,
      csw_address,
      base_sub_account,
      primary_embedded_eoa,
      embedded_wallet
    FROM profiles
    WHERE id = ${profileId}
    LIMIT 1;
  `
  const row = result.rows?.[0] as any
  if (!row) return null
  return {
    primaryWallet: normalizeAddress(row.primary_wallet),
    canonicalSmartWallet:
      normalizeAddress(row.primary_smart_wallet) ??
      normalizeAddress(row.csw_address) ??
      normalizeAddress(row.base_sub_account),
    embeddedEoa:
      normalizeAddress(row.primary_embedded_eoa) ??
      normalizeAddress(row.embedded_wallet),
  }
}

function withWalletIfMissing(
  wallets: MappedWallet[],
  wallet: MappedWallet | null,
): MappedWallet[] {
  if (!wallet) return wallets
  if (wallets.some((w) => normalizeLower(w.address) === normalizeLower(wallet.address))) return wallets
  return [...wallets, wallet]
}

function applyPersistedIdentity(params: {
  classification: ClassifiedLinkedAccounts
  persisted: PersistedIdentity | null
}): ClassifiedLinkedAccounts {
  const { classification, persisted } = params
  if (!persisted) return classification

  let allWallets = [...classification.allWallets]
  allWallets = withWalletIfMissing(
    allWallets,
    persisted.primaryWallet
      ? {
          address: persisted.primaryWallet,
          walletType: 'external_eoa',
          provider: 'unknown',
          chain: 'evm',
          clientType: null,
        }
      : null,
  )
  allWallets = withWalletIfMissing(
    allWallets,
    persisted.canonicalSmartWallet
      ? {
          address: persisted.canonicalSmartWallet,
          walletType: 'smart_wallet',
          provider: 'unknown',
          chain: 'evm',
          clientType: null,
        }
      : null,
  )
  allWallets = withWalletIfMissing(
    allWallets,
    persisted.embeddedEoa
      ? {
          address: persisted.embeddedEoa,
          walletType: 'embedded_eoa',
          provider: 'privy',
          chain: 'evm',
          clientType: null,
        }
      : null,
  )

  const canonicalSmartWallet =
    persisted.canonicalSmartWallet
      ? { address: persisted.canonicalSmartWallet, provider: classification.canonicalSmartWallet?.provider ?? 'unknown' }
      : classification.canonicalSmartWallet
  const embeddedEoa =
    persisted.embeddedEoa
      ? {
          address: persisted.embeddedEoa,
          chainType: classification.embeddedEoa?.chainType ?? 'evm',
          clientType: classification.embeddedEoa?.clientType ?? null,
        }
      : classification.embeddedEoa

  const primaryWalletAddress =
    persisted.primaryWallet ??
    classification.primaryWalletAddress ??
    embeddedEoa?.address ??
    canonicalSmartWallet?.address ??
    null

  allWallets = withWalletIfMissing(
    allWallets,
    primaryWalletAddress
      ? {
          address: primaryWalletAddress,
          walletType: 'external_eoa',
          provider: 'unknown',
          chain: 'evm',
          clientType: null,
        }
      : null,
  )

  return {
    embeddedEoa,
    canonicalSmartWallet,
    allWallets,
    primaryWalletAddress,
  }
}

async function clearRoleFlags(db: Db, profileId: number, classification: ClassifiedLinkedAccounts): Promise<void> {
  const canonical = classification.canonicalSmartWallet?.address ?? null
  const embedded = classification.embeddedEoa?.address ?? null
  const primary = classification.primaryWalletAddress ?? null

  if (canonical) {
    await db.sql`
      UPDATE profile_wallets
      SET is_canonical_smart_wallet = false, updated_at = NOW()
      WHERE profile_id = ${profileId} AND LOWER(address) <> ${canonical} AND is_canonical_smart_wallet = true;
    `
  } else {
    await db.sql`
      UPDATE profile_wallets
      SET is_canonical_smart_wallet = false, updated_at = NOW()
      WHERE profile_id = ${profileId} AND is_canonical_smart_wallet = true;
    `
  }

  if (embedded) {
    await db.sql`
      UPDATE profile_wallets
      SET is_embedded_eoa = false, updated_at = NOW()
      WHERE profile_id = ${profileId} AND LOWER(address) <> ${embedded} AND is_embedded_eoa = true;
    `
  } else {
    await db.sql`
      UPDATE profile_wallets
      SET is_embedded_eoa = false, updated_at = NOW()
      WHERE profile_id = ${profileId} AND is_embedded_eoa = true;
    `
  }

  if (primary) {
    await db.sql`
      UPDATE profile_wallets
      SET is_primary = false, updated_at = NOW()
      WHERE profile_id = ${profileId} AND LOWER(address) <> ${primary} AND is_primary = true;
    `
  } else {
    await db.sql`
      UPDATE profile_wallets
      SET is_primary = false, updated_at = NOW()
      WHERE profile_id = ${profileId} AND is_primary = true;
    `
  }
}

async function insertOrUpdateProfile(params: {
  db: Db
  existing: ExistingProfile | null
  privyUserId: string | null
  classification: ClassifiedLinkedAccounts
}): Promise<number> {
  const { db, existing, privyUserId, classification } = params
  const canonical = classification.canonicalSmartWallet?.address ?? null
  const embedded = classification.embeddedEoa?.address ?? null
  const primary = classification.primaryWalletAddress ?? embedded ?? canonical ?? null

  if (existing?.id) {
    await db.sql`
      UPDATE profiles
      SET
        privy_user_id = COALESCE(${privyUserId}, privy_user_id),
        primary_smart_wallet = COALESCE(${canonical}, primary_smart_wallet),
        primary_embedded_eoa = COALESCE(${embedded}, primary_embedded_eoa),
        primary_wallet = COALESCE(${primary}, primary_wallet),
        embedded_wallet = COALESCE(${embedded}, embedded_wallet),
        embedded_wallet_chain = COALESCE(${classification.embeddedEoa?.chainType ?? null}, embedded_wallet_chain),
        embedded_wallet_client_type = COALESCE(${classification.embeddedEoa?.clientType ?? null}, embedded_wallet_client_type),
        csw_address = COALESCE(${canonical}, csw_address),
        base_sub_account = COALESCE(${canonical}, base_sub_account),
        updated_at = NOW()
      WHERE id = ${existing.id};
    `
    return existing.id
  }

  const seed = primary ?? canonical ?? embedded ?? privyUserId ?? 'anon'
  const syntheticEmail = buildDeterministicSyntheticEmail(seed)
  const inserted = await db.sql`
    INSERT INTO profiles (
      email,
      privy_user_id,
      primary_smart_wallet,
      primary_embedded_eoa,
      primary_wallet,
      embedded_wallet,
      embedded_wallet_chain,
      embedded_wallet_client_type,
      csw_address,
      base_sub_account,
      updated_at
    )
    VALUES (
      ${syntheticEmail},
      ${privyUserId},
      ${canonical},
      ${embedded},
      ${primary},
      ${embedded},
      ${classification.embeddedEoa?.chainType ?? null},
      ${classification.embeddedEoa?.clientType ?? null},
      ${canonical},
      ${canonical},
      NOW()
    )
    ON CONFLICT (email) DO UPDATE
    SET
      privy_user_id = COALESCE(EXCLUDED.privy_user_id, profiles.privy_user_id),
      primary_smart_wallet = COALESCE(EXCLUDED.primary_smart_wallet, profiles.primary_smart_wallet),
      primary_embedded_eoa = COALESCE(EXCLUDED.primary_embedded_eoa, profiles.primary_embedded_eoa),
      primary_wallet = COALESCE(EXCLUDED.primary_wallet, profiles.primary_wallet),
      embedded_wallet = COALESCE(EXCLUDED.embedded_wallet, profiles.embedded_wallet),
      embedded_wallet_chain = COALESCE(EXCLUDED.embedded_wallet_chain, profiles.embedded_wallet_chain),
      embedded_wallet_client_type = COALESCE(EXCLUDED.embedded_wallet_client_type, profiles.embedded_wallet_client_type),
      csw_address = COALESCE(EXCLUDED.csw_address, profiles.csw_address),
      base_sub_account = COALESCE(EXCLUDED.base_sub_account, profiles.base_sub_account),
      updated_at = NOW()
    RETURNING id;
  `
  const insertedId = inserted.rows?.[0]?.id
  if (insertedId) return Number(insertedId)

  const selected = await db.sql`
    SELECT id FROM profiles WHERE email = ${syntheticEmail} LIMIT 1;
  `
  const selectedId = selected.rows?.[0]?.id
  if (!selectedId) throw new Error('wallet_sync_profile_upsert_failed')
  return Number(selectedId)
}

export async function syncUserWallets(db: Db, privyUser: PrivyUserLike): Promise<SyncUserWalletsResult> {
  await ensureCanonicalWalletsSchema(db)

  const classification = classifyLinkedAccounts(privyUser)
  const privyUserId = getPrivyUserId(privyUser)
  const existing = await findExistingProfile(db, privyUserId, classification.allWallets)
  const persisted = existing?.id ? await readPersistedIdentity(db, existing.id) : null
  const effectiveClassification = applyPersistedIdentity({ classification, persisted })
  const profileId = await insertOrUpdateProfile({ db, existing, privyUserId, classification: effectiveClassification })

  await clearRoleFlags(db, profileId, effectiveClassification)

  const canonicalAddress = effectiveClassification.canonicalSmartWallet?.address ?? null
  const embeddedAddress = effectiveClassification.embeddedEoa?.address ?? null
  const primaryAddress = effectiveClassification.primaryWalletAddress ?? null

  for (const wallet of effectiveClassification.allWallets) {
    await db.sql`
      INSERT INTO wallets (address, chain, wallet_type, provider)
      VALUES (${wallet.address}, ${wallet.chain}, ${wallet.walletType}, ${wallet.provider})
      ON CONFLICT (address) DO UPDATE
      SET
        chain = COALESCE(EXCLUDED.chain, wallets.chain),
        wallet_type = COALESCE(EXCLUDED.wallet_type, wallets.wallet_type),
        provider = CASE
          WHEN wallets.provider = 'unknown' THEN EXCLUDED.provider
          ELSE wallets.provider
        END;
    `

    const metadata = {
      clientType: wallet.clientType,
      syncedFrom: 'privy',
      syncedAt: new Date().toISOString(),
    }
    await db.sql`
      INSERT INTO profile_wallets (
        profile_id,
        address,
        is_primary,
        is_canonical_smart_wallet,
        is_embedded_eoa,
        verified_at,
        metadata,
        updated_at
      )
      VALUES (
        ${profileId},
        ${wallet.address},
        ${Boolean(primaryAddress && normalizeLower(wallet.address) === normalizeLower(primaryAddress))},
        ${Boolean(canonicalAddress && normalizeLower(wallet.address) === normalizeLower(canonicalAddress))},
        ${Boolean(embeddedAddress && normalizeLower(wallet.address) === normalizeLower(embeddedAddress))},
        NOW(),
        ${metadata},
        NOW()
      )
      ON CONFLICT (profile_id, address) DO UPDATE
      SET
        is_primary = EXCLUDED.is_primary,
        is_canonical_smart_wallet = EXCLUDED.is_canonical_smart_wallet,
        is_embedded_eoa = EXCLUDED.is_embedded_eoa,
        verified_at = NOW(),
        metadata = EXCLUDED.metadata,
        updated_at = NOW();
    `
  }

  return {
    profileId,
    canonicalSmartWallet: effectiveClassification.canonicalSmartWallet,
    embeddedEoa: effectiveClassification.embeddedEoa,
    connectedWallets: effectiveClassification.allWallets.map((wallet) => ({
      address: wallet.address,
      walletType: wallet.walletType,
      provider: wallet.provider,
    })),
    primaryWalletAddress: effectiveClassification.primaryWalletAddress,
  }
}
