import { type ClassifiedLinkedAccounts, classifyLinkedAccounts, type MappedWallet, type PrivyUserLike } from './walletMapping.js'
import { ensureCanonicalWalletsSchema } from './canonicalWalletsSchema.js'
import { fetchZoraProfile } from './zoraProfile.js'

type Db = { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> }

type ExistingProfile = { id: number; email: string | null }

export type SyncUserWalletsResult = {
  profileId: number
  canonicalSmartWallet: { address: string; provider: string } | null
  activeOwnerWallet: { address: string; provider: string; walletType: string } | null
  canonicalSolanaWallet: { address: string; provider: string } | null
  operationalSolanaWallet: { address: string; provider: string } | null
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

function normalizeSolanaAddress(value: unknown): string | null {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) return null
  if (raw.length < 32 || raw.length > 44) return null
  if (!/^[1-9A-HJ-NP-Za-km-z]+$/.test(raw)) return null
  return raw
}

function walletAddressEquals(a: unknown, b: unknown): boolean {
  const aa = typeof a === 'string' ? a.trim() : ''
  const bb = typeof b === 'string' ? b.trim() : ''
  if (!aa || !bb) return false
  const aIsEvm = /^0x[a-fA-F0-9]{40}$/.test(aa)
  const bIsEvm = /^0x[a-fA-F0-9]{40}$/.test(bb)
  if (aIsEvm && bIsEvm) return aa.toLowerCase() === bb.toLowerCase()
  return aa === bb
}

function getPrivyUserId(user: PrivyUserLike): string | null {
  const id = typeof user?.id === 'string' ? user.id.trim() : ''
  return id.length > 0 ? id : null
}

function normalizeEmail(value: unknown): string | null {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (!raw) return null
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) return null
  return raw
}

function isPrivyUserIdUniqueViolation(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '')
  const lower = message.toLowerCase()
  return (
    lower.includes('profiles_privy_user_id_unique') ||
    (lower.includes('duplicate key value') && lower.includes('privy_user_id'))
  )
}

function extractPrivyEmail(user: PrivyUserLike): string | null {
  const direct = normalizeEmail((user as any)?.email?.address)
  if (direct) return direct
  const linked = [
    ...(Array.isArray((user as any)?.linkedAccounts) ? (user as any).linkedAccounts : []),
    ...(Array.isArray((user as any)?.linked_accounts) ? (user as any).linked_accounts : []),
  ]
  for (const account of linked) {
    const type = normalizeLower((account as any)?.type)
    if (!type.includes('email')) continue
    const value =
      normalizeEmail((account as any)?.address) ??
      normalizeEmail((account as any)?.emailAddress) ??
      normalizeEmail((account as any)?.email_address) ??
      normalizeEmail((account as any)?.email)
    if (value) return value
  }
  return null
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
       OR solana_wallet = ${address}
       OR canonical_solana_wallet = ${address}
       OR operational_solana_wallet = ${address}
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

export type PersistedIdentity = {
  primaryWallet: string | null
  activeOwnerWallet: string | null
  canonicalSmartWallet: string | null
  canonicalSolanaWallet: string | null
  operationalSolanaWallet: string | null
  embeddedEoa: string | null
  preprovZoraHandle: string | null
}

export async function readPersistedIdentity(db: Db, profileId: number): Promise<PersistedIdentity | null> {
  const canonicalWalletResult = await db.sql`
    SELECT address
    FROM profile_wallets
    WHERE profile_id = ${profileId}
      AND is_canonical_smart_wallet = true
    LIMIT 1;
  `
  const canonicalFromWallets = normalizeAddress(canonicalWalletResult.rows?.[0]?.address)

  const result = await db.sql`
    SELECT
      primary_wallet,
      primary_smart_wallet,
      csw_address,
      base_sub_account,
      canonical_solana_wallet,
      operational_solana_wallet,
      solana_wallet,
      primary_embedded_eoa,
      embedded_wallet,
      preprov_zora_handle
    FROM profiles
    WHERE id = ${profileId}
    LIMIT 1;
  `
  const row = result.rows?.[0] as any
  if (!row) return null
  const canonicalSmartWallet =
    canonicalFromWallets ??
    normalizeAddress(row.primary_smart_wallet) ??
    normalizeAddress(row.csw_address) ??
    normalizeAddress(row.base_sub_account)
  const embeddedEoa =
    normalizeAddress(row.primary_embedded_eoa) ??
    normalizeAddress(row.embedded_wallet)
  const primaryWallet = normalizeAddress(row.primary_wallet)
  return {
    primaryWallet,
    activeOwnerWallet:
      embeddedEoa ??
      (primaryWallet && (!canonicalSmartWallet || !walletAddressEquals(primaryWallet, canonicalSmartWallet)) ? primaryWallet : null),
    canonicalSmartWallet,
    canonicalSolanaWallet:
      normalizeSolanaAddress(row.canonical_solana_wallet) ??
      normalizeSolanaAddress(row.solana_wallet),
    operationalSolanaWallet: normalizeSolanaAddress(row.operational_solana_wallet),
    embeddedEoa,
    preprovZoraHandle: typeof row.preprov_zora_handle === 'string' && row.preprov_zora_handle.trim() ? row.preprov_zora_handle.trim() : null,
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

function isCanonicalSmartWalletCandidateAddress(classification: ClassifiedLinkedAccounts, address: string): boolean {
  const target = normalizeLower(address)
  if (!target) return false
  return classification.allWallets.some((wallet) => {
    if (normalizeLower(wallet.address) !== target) return false
    if (wallet.walletType !== 'smart_wallet') return false
    if (wallet.provider === 'privy') return false
    return true
  })
}

function isSolanaWalletAddressInClassification(classification: ClassifiedLinkedAccounts, address: string): boolean {
  const target = normalizeSolanaAddress(address)
  if (!target) return false
  return classification.allWallets.some((wallet) => wallet.chain === 'solana' && walletAddressEquals(wallet.address, target))
}

function isSmartWalletCandidate(wallet: MappedWallet): boolean {
  if (wallet.chain !== 'evm') return false
  if (wallet.walletType !== 'smart_wallet') return false
  if (wallet.provider === 'privy') return false
  return true
}

function normalizeHandle(value: unknown): string | null {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) return null
  return raw.startsWith('@') ? raw.slice(1) : raw
}

function pickZoraSeedIdentifier(params: { classification: ClassifiedLinkedAccounts; persisted: PersistedIdentity | null }): string | null {
  const { classification, persisted } = params
  const handle = normalizeHandle(persisted?.preprovZoraHandle)
  if (handle) return handle

  // Prefer an EOA seed; Zora can also resolve by CSW address,
  // but EOAs are the most stable identity anchor.
  const externalEoa = classification.allWallets.find((w) => w.chain === 'evm' && w.walletType === 'external_eoa')?.address ?? null
  if (externalEoa) return externalEoa

  const embedded = classification.embeddedEoa?.address ?? null
  if (embedded) return embedded

  return classification.primaryWalletAddress ?? null
}

async function resolveCanonicalSmartWalletFromZora(params: {
  classification: ClassifiedLinkedAccounts
  persisted: PersistedIdentity | null
}): Promise<string | null> {
  const { classification, persisted } = params
  const candidates = classification.allWallets.filter(isSmartWalletCandidate).map((w) => normalizeLower(w.address)).filter(Boolean)
  if (candidates.length < 2) return null

  const seed = pickZoraSeedIdentifier({ classification, persisted })
  if (!seed) return null

  const profile = await fetchZoraProfile(seed).catch(() => null)
  if (!profile) return null

  const candidateSet = new Set(candidates)
  const zoraCandidates = [
    profile?.publicWallet?.walletAddress,
    ...((profile?.linkedWallets?.edges ?? []).map((edge: any) => edge?.node?.walletAddress ?? null)),
  ]
  for (const candidate of zoraCandidates) {
    const normalized = normalizeAddress(candidate)
    if (!normalized) continue
    if (candidateSet.has(normalizeLower(normalized))) return normalizeLower(normalized)
  }

  return null
}

function applyPersistedIdentity(params: {
  classification: ClassifiedLinkedAccounts
  persisted: PersistedIdentity | null
}): ClassifiedLinkedAccounts {
  const { classification, persisted } = params
  if (!persisted) return classification

  // Treat persisted canonical as durable source of truth even if the current
  // Privy payload omits it (canonical drift protection).
  const persistedCanonical = persisted?.canonicalSmartWallet ?? null
  const persistedCanonicalSolana =
    persisted?.canonicalSolanaWallet &&
    isSolanaWalletAddressInClassification(classification, persisted.canonicalSolanaWallet)
      ? persisted.canonicalSolanaWallet
      : null
  const persistedOperationalSolana =
    persisted?.operationalSolanaWallet &&
    isSolanaWalletAddressInClassification(classification, persisted.operationalSolanaWallet)
      ? persisted.operationalSolanaWallet
      : null

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
    persistedCanonicalSolana
      ? {
          address: persistedCanonicalSolana,
          walletType: 'external_eoa',
          provider: 'unknown',
          chain: 'solana',
          clientType: null,
        }
      : null,
  )
  allWallets = withWalletIfMissing(
    allWallets,
    persistedOperationalSolana
      ? {
          address: persistedOperationalSolana,
          walletType: 'embedded_eoa',
          provider: 'privy',
          chain: 'solana',
          clientType: null,
        }
      : null,
  )
  allWallets = withWalletIfMissing(
    allWallets,
    persistedCanonical
      ? {
          address: persistedCanonical,
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
    persistedCanonical
      ? { address: persistedCanonical, provider: classification.canonicalSmartWallet?.provider ?? 'unknown' }
      : classification.canonicalSmartWallet
  const classificationActiveOwnerRecord =
    classification.activeOwnerWallet
      ? allWallets.find((wallet) => walletAddressEquals(wallet.address, classification.activeOwnerWallet?.address))
      : null
  const persistedActiveOwnerRecord =
    persisted?.activeOwnerWallet
      ? allWallets.find((wallet) => walletAddressEquals(wallet.address, persisted.activeOwnerWallet))
      : null
  const activeOwnerWallet = classificationActiveOwnerRecord
    ? {
        address: classificationActiveOwnerRecord.address,
        provider: classificationActiveOwnerRecord.provider,
        walletType: classificationActiveOwnerRecord.walletType,
      }
    : persistedActiveOwnerRecord && persistedActiveOwnerRecord.chain === 'evm' && persistedActiveOwnerRecord.walletType !== 'smart_wallet'
      ? {
          address: persistedActiveOwnerRecord.address,
          provider: persistedActiveOwnerRecord.provider,
          walletType: persistedActiveOwnerRecord.walletType,
        }
      : null
  const embeddedEoa =
    persisted.embeddedEoa
      ? {
          address: persisted.embeddedEoa,
          chainType: classification.embeddedEoa?.chainType ?? 'evm',
          clientType: classification.embeddedEoa?.clientType ?? null,
        }
      : classification.embeddedEoa
  const classificationCanonicalSolanaRecord =
    classification.canonicalSolanaWallet
      ? allWallets.find((wallet) => walletAddressEquals(wallet.address, classification.canonicalSolanaWallet?.address))
      : null
  const classificationCanonicalSolanaIsExternal = classificationCanonicalSolanaRecord?.chain === 'solana' && classificationCanonicalSolanaRecord.walletType === 'external_eoa'
  const persistedCanonicalSolanaRecord =
    persistedCanonicalSolana
      ? allWallets.find((wallet) => walletAddressEquals(wallet.address, persistedCanonicalSolana))
      : null
  const canonicalSolanaWallet = classificationCanonicalSolanaIsExternal
    ? classification.canonicalSolanaWallet
    : persistedCanonicalSolanaRecord
      ? { address: persistedCanonicalSolanaRecord.address, provider: persistedCanonicalSolanaRecord.provider }
      : classification.canonicalSolanaWallet
  const operationalSolanaFromPersisted =
    persistedOperationalSolana &&
    (!canonicalSolanaWallet || !walletAddressEquals(persistedOperationalSolana, canonicalSolanaWallet.address))
      ? allWallets.find((wallet) => walletAddressEquals(wallet.address, persistedOperationalSolana))
      : null
  const operationalSolanaFromClassification =
    classification.operationalSolanaWallet &&
    (!canonicalSolanaWallet ||
      !walletAddressEquals(classification.operationalSolanaWallet.address, canonicalSolanaWallet.address))
      ? classification.operationalSolanaWallet
      : null
  const operationalSolanaWallet = operationalSolanaFromPersisted
    ? { address: operationalSolanaFromPersisted.address, provider: operationalSolanaFromPersisted.provider }
    : operationalSolanaFromClassification

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
    activeOwnerWallet,
    canonicalSmartWallet,
    canonicalSolanaWallet,
    operationalSolanaWallet,
    allWallets,
    primaryWalletAddress,
  }
}

async function clearRoleFlags(db: Db, profileId: number, classification: ClassifiedLinkedAccounts): Promise<void> {
  const canonical = classification.canonicalSmartWallet?.address ?? null
  const canonicalSolana = classification.canonicalSolanaWallet?.address ?? null
  const operationalSolana = classification.operationalSolanaWallet?.address ?? null
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

  if (canonicalSolana) {
    await db.sql`
      UPDATE profile_wallets
      SET is_canonical_solana_wallet = false, updated_at = NOW()
      WHERE profile_id = ${profileId} AND address <> ${canonicalSolana} AND is_canonical_solana_wallet = true;
    `
  } else {
    await db.sql`
      UPDATE profile_wallets
      SET is_canonical_solana_wallet = false, updated_at = NOW()
      WHERE profile_id = ${profileId} AND is_canonical_solana_wallet = true;
    `
  }

  if (operationalSolana) {
    await db.sql`
      UPDATE profile_wallets
      SET is_operational_solana_wallet = false, updated_at = NOW()
      WHERE profile_id = ${profileId} AND address <> ${operationalSolana} AND is_operational_solana_wallet = true;
    `
  } else {
    await db.sql`
      UPDATE profile_wallets
      SET is_operational_solana_wallet = false, updated_at = NOW()
      WHERE profile_id = ${profileId} AND is_operational_solana_wallet = true;
    `
  }
}

async function insertOrUpdateProfile(params: {
  db: Db
  existing: ExistingProfile | null
  privyUserId: string | null
  email: string | null
  classification: ClassifiedLinkedAccounts
}): Promise<number> {
  const { db, existing, privyUserId, email, classification } = params
  const canonical = classification.canonicalSmartWallet?.address ?? null
  const activeOwner = classification.activeOwnerWallet?.address ?? null
  const canonicalSolana = classification.canonicalSolanaWallet?.address ?? null
  const operationalSolana = classification.operationalSolanaWallet?.address ?? null
  const embedded = classification.embeddedEoa?.address ?? null
  const primary = activeOwner ?? canonical ?? classification.primaryWalletAddress ?? null

  if (existing?.id) {
    await db.sql`
      UPDATE profiles
      SET
        email = COALESCE(profiles.email, ${email}),
        privy_user_id = COALESCE(${privyUserId}, privy_user_id),
        primary_smart_wallet = COALESCE(${canonical}, primary_smart_wallet),
        primary_embedded_eoa = ${embedded},
        primary_wallet = COALESCE(${primary}, primary_wallet),
        embedded_wallet = ${embedded},
        embedded_wallet_chain = ${classification.embeddedEoa?.chainType ?? null},
        embedded_wallet_client_type = ${classification.embeddedEoa?.clientType ?? null},
        canonical_solana_wallet = COALESCE(${canonicalSolana}, canonical_solana_wallet),
        operational_solana_wallet = COALESCE(${operationalSolana}, operational_solana_wallet),
        solana_wallet = COALESCE(${canonicalSolana}, solana_wallet),
        csw_address = COALESCE(${canonical}, csw_address),
        base_sub_account = COALESCE(${canonical}, base_sub_account),
        updated_at = NOW()
      WHERE id = ${existing.id};
    `
    return existing.id
  }

  const updateByPrivyUserId = async () => {
    if (!privyUserId) return null
    const updated = await db.sql`
      UPDATE profiles
      SET
        email = COALESCE(profiles.email, ${email}),
        primary_smart_wallet = COALESCE(${canonical}, primary_smart_wallet),
        primary_embedded_eoa = ${embedded},
        primary_wallet = COALESCE(${primary}, primary_wallet),
        embedded_wallet = ${embedded},
        embedded_wallet_chain = ${classification.embeddedEoa?.chainType ?? null},
        embedded_wallet_client_type = ${classification.embeddedEoa?.clientType ?? null},
        canonical_solana_wallet = COALESCE(${canonicalSolana}, canonical_solana_wallet),
        operational_solana_wallet = COALESCE(${operationalSolana}, operational_solana_wallet),
        solana_wallet = COALESCE(${canonicalSolana}, solana_wallet),
        csw_address = COALESCE(${canonical}, csw_address),
        base_sub_account = COALESCE(${canonical}, base_sub_account),
        updated_at = NOW()
      WHERE privy_user_id = ${privyUserId}
      RETURNING id;
    `
    const id = updated.rows?.[0]?.id
    if (!id) return null
    return Number(id)
  }

  let inserted: { rows: any[] }
  try {
    inserted = await db.sql`
      INSERT INTO profiles (
        email,
        privy_user_id,
        primary_smart_wallet,
        primary_embedded_eoa,
        primary_wallet,
        embedded_wallet,
        embedded_wallet_chain,
        embedded_wallet_client_type,
        canonical_solana_wallet,
        operational_solana_wallet,
        solana_wallet,
        csw_address,
        base_sub_account,
        updated_at
      )
      VALUES (
        ${email},
        ${privyUserId},
        ${canonical},
        ${embedded},
        ${primary},
        ${embedded},
        ${classification.embeddedEoa?.chainType ?? null},
        ${classification.embeddedEoa?.clientType ?? null},
        ${canonicalSolana},
        ${operationalSolana},
        ${canonicalSolana},
        ${canonical},
        ${canonical},
        NOW()
      )
      ON CONFLICT (email) DO UPDATE
      SET
        email = COALESCE(profiles.email, EXCLUDED.email),
        privy_user_id = COALESCE(EXCLUDED.privy_user_id, profiles.privy_user_id),
        primary_smart_wallet = COALESCE(EXCLUDED.primary_smart_wallet, profiles.primary_smart_wallet),
        primary_embedded_eoa = EXCLUDED.primary_embedded_eoa,
        primary_wallet = COALESCE(EXCLUDED.primary_wallet, profiles.primary_wallet),
        embedded_wallet = EXCLUDED.embedded_wallet,
        embedded_wallet_chain = EXCLUDED.embedded_wallet_chain,
        embedded_wallet_client_type = EXCLUDED.embedded_wallet_client_type,
        canonical_solana_wallet = COALESCE(EXCLUDED.canonical_solana_wallet, profiles.canonical_solana_wallet),
        operational_solana_wallet = COALESCE(EXCLUDED.operational_solana_wallet, profiles.operational_solana_wallet),
        solana_wallet = COALESCE(EXCLUDED.solana_wallet, profiles.solana_wallet),
        csw_address = COALESCE(EXCLUDED.csw_address, profiles.csw_address),
        base_sub_account = COALESCE(EXCLUDED.base_sub_account, profiles.base_sub_account),
        updated_at = NOW()
      RETURNING id;
    `
  } catch (error) {
    if (!isPrivyUserIdUniqueViolation(error)) throw error
    const recoveredId = await updateByPrivyUserId()
    if (recoveredId) return recoveredId
    throw error
  }
  const insertedId = inserted.rows?.[0]?.id
  if (insertedId) return Number(insertedId)

  let selectedId: unknown = null
  if (email) {
    const selectedByEmail = await db.sql`
      SELECT id FROM profiles WHERE email = ${email} LIMIT 1;
    `
    selectedId = selectedByEmail.rows?.[0]?.id ?? null
  }
  if (!selectedId && privyUserId) {
    const selectedByPrivy = await db.sql`
      SELECT id FROM profiles WHERE privy_user_id = ${privyUserId} LIMIT 1;
    `
    selectedId = selectedByPrivy.rows?.[0]?.id ?? null
  }
  if (!selectedId) throw new Error('wallet_sync_profile_upsert_failed')
  return Number(selectedId)
}

export async function syncUserWallets(db: Db, privyUser: PrivyUserLike): Promise<SyncUserWalletsResult> {
  await ensureCanonicalWalletsSchema(db)

  const classification = classifyLinkedAccounts(privyUser)
  const privyUserId = getPrivyUserId(privyUser)
  const email = extractPrivyEmail(privyUser)
  const existing = await findExistingProfile(db, privyUserId, classification.allWallets)
  const persisted = existing?.id ? await readPersistedIdentity(db, existing.id) : null

  const zoraCanonical = await resolveCanonicalSmartWalletFromZora({ classification, persisted })
  const persistedWithZora: PersistedIdentity | null = zoraCanonical
    ? {
        primaryWallet: persisted?.primaryWallet ?? null,
        activeOwnerWallet: persisted?.activeOwnerWallet ?? null,
        canonicalSmartWallet: zoraCanonical,
        canonicalSolanaWallet: persisted?.canonicalSolanaWallet ?? null,
        operationalSolanaWallet: persisted?.operationalSolanaWallet ?? null,
        embeddedEoa: persisted?.embeddedEoa ?? null,
        preprovZoraHandle: persisted?.preprovZoraHandle ?? null,
      }
    : persisted

  const effectiveClassification = applyPersistedIdentity({ classification, persisted: persistedWithZora })
  const profileId = await insertOrUpdateProfile({ db, existing, privyUserId, email, classification: effectiveClassification })

  await clearRoleFlags(db, profileId, effectiveClassification)

  const canonicalAddress = effectiveClassification.canonicalSmartWallet?.address ?? null
  const canonicalSolanaAddress = effectiveClassification.canonicalSolanaWallet?.address ?? null
  const operationalSolanaAddress = effectiveClassification.operationalSolanaWallet?.address ?? null
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
        is_canonical_solana_wallet,
        is_operational_solana_wallet,
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
        ${Boolean(canonicalSolanaAddress && walletAddressEquals(wallet.address, canonicalSolanaAddress))},
        ${Boolean(operationalSolanaAddress && walletAddressEquals(wallet.address, operationalSolanaAddress))},
        NOW(),
        ${metadata},
        NOW()
      )
      ON CONFLICT (profile_id, address) DO UPDATE
      SET
        is_primary = EXCLUDED.is_primary,
        is_canonical_smart_wallet = EXCLUDED.is_canonical_smart_wallet,
        is_embedded_eoa = EXCLUDED.is_embedded_eoa,
        is_canonical_solana_wallet = EXCLUDED.is_canonical_solana_wallet,
        is_operational_solana_wallet = EXCLUDED.is_operational_solana_wallet,
        verified_at = NOW(),
        metadata = EXCLUDED.metadata,
        updated_at = NOW();
    `
  }

  return {
    profileId,
    canonicalSmartWallet: effectiveClassification.canonicalSmartWallet,
    activeOwnerWallet: effectiveClassification.activeOwnerWallet,
    canonicalSolanaWallet: effectiveClassification.canonicalSolanaWallet,
    operationalSolanaWallet: effectiveClassification.operationalSolanaWallet,
    embeddedEoa: effectiveClassification.embeddedEoa,
    connectedWallets: effectiveClassification.allWallets.map((wallet) => ({
      address: wallet.address,
      walletType: wallet.walletType,
      provider: wallet.provider,
    })),
    primaryWalletAddress: effectiveClassification.primaryWalletAddress,
  }
}
