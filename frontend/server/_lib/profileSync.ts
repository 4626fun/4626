type Db = { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> }

const SYNTHETIC_EMAIL_DOMAIN = 'noemail.4626.fun'

function isValidEvmAddress(v: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(v)
}

function normalizeWallet(value: string | null | undefined): string | null {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw || !isValidEvmAddress(raw)) return null
  return raw.toLowerCase()
}

function fnv1a32(input: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

export function buildDeterministicSyntheticEmail(seed?: string | null): string {
  const safeSeed = typeof seed === 'string' ? seed.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8) : ''
  const seedNorm = typeof seed === 'string' ? seed.trim().toLowerCase() : ''
  const token = fnv1a32(seedNorm || 'anon').toString(36).padStart(7, '0').slice(0, 12)
  const prefix = safeSeed.length > 0 ? safeSeed.toLowerCase() : 'anon'
  return `${prefix}+${token}@${SYNTHETIC_EMAIL_DOMAIN}`
}

export type ProfileWalletUpsertInput = {
  primaryWallet?: string | null
  embeddedWallet?: string | null
  embeddedWalletChain?: string | null
  embeddedWalletClientType?: string | null
  privyUserId?: string | null
  cswAddress?: string | null
  baseSubAccount?: string | null
}

export async function upsertProfileByWallet(db: Db, input: ProfileWalletUpsertInput): Promise<void> {
  const primaryWallet = normalizeWallet(input.primaryWallet ?? null)
  const embeddedWallet = normalizeWallet(input.embeddedWallet ?? null)
  const cswAddress = normalizeWallet(input.cswAddress ?? null)
  const baseSubAccount = normalizeWallet(input.baseSubAccount ?? null)

  const walletSeed = primaryWallet || embeddedWallet || cswAddress || baseSubAccount
  if (!walletSeed) return
  const privyUserId = input.privyUserId ?? null

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
        primary_wallet = COALESCE(${primaryWallet}, primary_wallet),
        embedded_wallet = COALESCE(${embeddedWallet}, embedded_wallet),
        embedded_wallet_chain = COALESCE(${embeddedWalletChain}, embedded_wallet_chain),
        embedded_wallet_client_type = COALESCE(${embeddedWalletClientType}, embedded_wallet_client_type),
        privy_user_id = COALESCE(${privyUserId}, privy_user_id),
        csw_address = COALESCE(${cswAddress}, csw_address),
        base_sub_account = COALESCE(${baseSubAccount}, base_sub_account),
        primary_smart_wallet = COALESCE(${cswAddress}, primary_smart_wallet),
        primary_embedded_eoa = COALESCE(${embeddedWallet}, primary_embedded_eoa),
        updated_at = NOW()
      WHERE id = ${existing.id};
    `
    return
  }

  const email = buildDeterministicSyntheticEmail(walletSeed)
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
      primary_wallet = COALESCE(EXCLUDED.primary_wallet, profiles.primary_wallet),
      embedded_wallet = COALESCE(EXCLUDED.embedded_wallet, profiles.embedded_wallet),
      embedded_wallet_chain = COALESCE(EXCLUDED.embedded_wallet_chain, profiles.embedded_wallet_chain),
      embedded_wallet_client_type = COALESCE(EXCLUDED.embedded_wallet_client_type, profiles.embedded_wallet_client_type),
      privy_user_id = COALESCE(EXCLUDED.privy_user_id, profiles.privy_user_id),
      csw_address = COALESCE(EXCLUDED.csw_address, profiles.csw_address),
      base_sub_account = COALESCE(EXCLUDED.base_sub_account, profiles.base_sub_account),
      primary_smart_wallet = COALESCE(EXCLUDED.primary_smart_wallet, profiles.primary_smart_wallet),
      primary_embedded_eoa = COALESCE(EXCLUDED.primary_embedded_eoa, profiles.primary_embedded_eoa),
      updated_at = NOW();
  `
}
