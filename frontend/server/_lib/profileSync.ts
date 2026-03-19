import { assertNoEmailPrivyCollision } from './identityRecovery.js'
import { normalizeEmail } from './trust.js'

type Db = { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> }

function isValidEvmAddress(v: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(v)
}

function normalizeWallet(value: string | null | undefined): string | null {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw || !isValidEvmAddress(raw)) return null
  return raw.toLowerCase()
}

function isPrivyUserIdUniqueViolation(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '')
  const lower = message.toLowerCase()
  return (
    lower.includes('profiles_privy_user_id_unique') ||
    (lower.includes('duplicate key value') && lower.includes('privy_user_id'))
  )
}

export type ProfileWalletUpsertInput = {
  email?: string | null
  primaryWallet?: string | null
  embeddedWallet?: string | null
  embeddedWalletChain?: string | null
  embeddedWalletClientType?: string | null
  privyUserId?: string | null
  cswAddress?: string | null
  baseSubAccount?: string | null
}

export async function upsertProfileByWallet(db: Db, input: ProfileWalletUpsertInput): Promise<void> {
  const email = normalizeEmail(input.email ?? null)
  const primaryWallet = normalizeWallet(input.primaryWallet ?? null)
  const embeddedWallet = normalizeWallet(input.embeddedWallet ?? null)
  const cswAddress = normalizeWallet(input.cswAddress ?? null)
  const baseSubAccount = normalizeWallet(input.baseSubAccount ?? null)

  const walletSeed = primaryWallet || embeddedWallet || cswAddress || baseSubAccount
  if (!walletSeed) return
  const privyUserId = input.privyUserId ?? null
  await assertNoEmailPrivyCollision({ db, email, privyUserId })

  let existing: { id: number; email?: string | null } | null = null
  // Check privy_user_id first — it's the strongest identity signal.
  if (!existing && privyUserId) {
    const res = await db.sql`
      SELECT id, email
      FROM profiles
      WHERE privy_user_id = ${privyUserId}
      LIMIT 1;
    `
    existing = (res?.rows?.[0] as { id: number; email?: string | null } | undefined) ?? null
  }
  if (!existing && primaryWallet) {
    const res = await db.sql`
      SELECT id, email
      FROM profiles
      WHERE LOWER(primary_wallet) = ${primaryWallet}
      LIMIT 1;
    `
    existing = (res?.rows?.[0] as { id: number; email?: string | null } | undefined) ?? null
  }
  if (!existing && embeddedWallet) {
    const res = await db.sql`
      SELECT id, email
      FROM profiles
      WHERE LOWER(embedded_wallet) = ${embeddedWallet}
      LIMIT 1;
    `
    existing = (res?.rows?.[0] as { id: number; email?: string | null } | undefined) ?? null
  }
  if (!existing && cswAddress) {
    const res = await db.sql`
      SELECT id, email
      FROM profiles
      WHERE LOWER(csw_address) = ${cswAddress}
         OR LOWER(primary_smart_wallet) = ${cswAddress}
      LIMIT 1;
    `
    existing = (res?.rows?.[0] as { id: number; email?: string | null } | undefined) ?? null
  }
  if (!existing && embeddedWallet) {
    const res = await db.sql`
      SELECT id, email
      FROM profiles
      WHERE LOWER(primary_embedded_eoa) = ${embeddedWallet}
      LIMIT 1;
    `
    existing = (res?.rows?.[0] as { id: number; email?: string | null } | undefined) ?? null
  }
  if (!existing && baseSubAccount) {
    const res = await db.sql`
      SELECT id, email
      FROM profiles
      WHERE LOWER(base_sub_account) = ${baseSubAccount}
      LIMIT 1;
    `
    existing = (res?.rows?.[0] as { id: number; email?: string | null } | undefined) ?? null
  }

  const embeddedWalletChain = input.embeddedWalletChain ?? null
  const embeddedWalletClientType = input.embeddedWalletClientType ?? null

  if (existing?.id) {
    await db.sql`
      UPDATE profiles
      SET
        email = COALESCE(profiles.email, ${email}),
        primary_wallet = COALESCE(${primaryWallet}, primary_wallet),
        embedded_wallet = COALESCE(${embeddedWallet}, embedded_wallet),
        embedded_wallet_chain = COALESCE(${embeddedWalletChain}, embedded_wallet_chain),
        embedded_wallet_client_type = COALESCE(${embeddedWalletClientType}, embedded_wallet_client_type),
        privy_user_id = COALESCE(privy_user_id, ${privyUserId}),
        csw_address = COALESCE(${cswAddress}, csw_address),
        base_sub_account = COALESCE(${baseSubAccount}, base_sub_account),
        primary_smart_wallet = COALESCE(${cswAddress}, primary_smart_wallet),
        primary_embedded_eoa = COALESCE(${embeddedWallet}, primary_embedded_eoa),
        updated_at = NOW()
      WHERE id = ${existing.id};
    `
    return
  }

  const updateByPrivyUserId = async () => {
    if (!privyUserId) return false
    const updated = await db.sql`
      UPDATE profiles
      SET
        email = COALESCE(profiles.email, ${email}),
        primary_wallet = COALESCE(${primaryWallet}, primary_wallet),
        embedded_wallet = COALESCE(${embeddedWallet}, embedded_wallet),
        embedded_wallet_chain = COALESCE(${embeddedWalletChain}, embedded_wallet_chain),
        embedded_wallet_client_type = COALESCE(${embeddedWalletClientType}, embedded_wallet_client_type),
        csw_address = COALESCE(${cswAddress}, csw_address),
        base_sub_account = COALESCE(${baseSubAccount}, base_sub_account),
        primary_smart_wallet = COALESCE(${cswAddress}, primary_smart_wallet),
        primary_embedded_eoa = COALESCE(${embeddedWallet}, primary_embedded_eoa),
        updated_at = NOW()
      WHERE privy_user_id = ${privyUserId}
      RETURNING id;
    `
    return Array.isArray(updated.rows) && updated.rows.length > 0
  }

  try {
    await db.sql`
      INSERT INTO profiles (
        email,
        primary_wallet,
        embedded_wallet,
        embedded_wallet_chain,
        embedded_wallet_client_type,
        privy_user_id,
        csw_address,
        base_sub_account,
        primary_smart_wallet,
        primary_embedded_eoa,
        updated_at
      )
      VALUES (
        ${email},
        ${primaryWallet},
        ${embeddedWallet},
        ${embeddedWalletChain},
        ${embeddedWalletClientType},
        ${privyUserId},
        ${cswAddress},
        ${baseSubAccount},
        ${cswAddress},
        ${embeddedWallet},
        NOW()
      )
      ON CONFLICT (email) DO UPDATE
      SET
        email = COALESCE(profiles.email, EXCLUDED.email),
        primary_wallet = COALESCE(EXCLUDED.primary_wallet, profiles.primary_wallet),
        embedded_wallet = COALESCE(EXCLUDED.embedded_wallet, profiles.embedded_wallet),
        embedded_wallet_chain = COALESCE(EXCLUDED.embedded_wallet_chain, profiles.embedded_wallet_chain),
        embedded_wallet_client_type = COALESCE(EXCLUDED.embedded_wallet_client_type, profiles.embedded_wallet_client_type),
        privy_user_id = COALESCE(profiles.privy_user_id, EXCLUDED.privy_user_id),
        csw_address = COALESCE(EXCLUDED.csw_address, profiles.csw_address),
        base_sub_account = COALESCE(EXCLUDED.base_sub_account, profiles.base_sub_account),
        primary_smart_wallet = COALESCE(EXCLUDED.primary_smart_wallet, profiles.primary_smart_wallet),
        primary_embedded_eoa = COALESCE(EXCLUDED.primary_embedded_eoa, profiles.primary_embedded_eoa),
        updated_at = NOW();
    `
  } catch (error) {
    if (!isPrivyUserIdUniqueViolation(error)) throw error
    const recovered = await updateByPrivyUserId()
    if (recovered) return
    throw error
  }
}
