import type { Db } from './walletSync.js'

export type RepointCanonicalCswResult = {
  profileId: number
  previousCswAddress: string | null
  canonicalCswAddress: string
  previousEmbeddedEoa: string | null
  nextEmbeddedEoa: string | null
  clearedBaseSubAccount: string | null
}

function normalizeAddress(value: unknown): string | null {
  const out = String(value ?? '').trim().toLowerCase()
  if (!/^0x[a-f0-9]{40}$/.test(out)) return null
  return out
}

async function upsertProfileWalletRow(
  db: Db,
  params: {
    profileId: number
    address: string
    chain: string
    walletType: string
    provider: string
    isPrimary: boolean
    isCanonicalSmartWallet: boolean
    isEmbeddedEoa: boolean
  },
): Promise<void> {
  await db.sql`
    INSERT INTO profile_wallets (
      profile_id,
      address,
      chain,
      wallet_type,
      provider,
      is_primary,
      is_canonical_smart_wallet,
      is_embedded_eoa,
      verified_at,
      updated_at
    )
    VALUES (
      ${params.profileId},
      ${params.address},
      ${params.chain},
      ${params.walletType},
      ${params.provider},
      ${params.isPrimary},
      ${params.isCanonicalSmartWallet},
      ${params.isEmbeddedEoa},
      NOW(),
      NOW()
    )
    ON CONFLICT (profile_id, address) DO UPDATE
    SET
      chain = EXCLUDED.chain,
      wallet_type = EXCLUDED.wallet_type,
      provider = EXCLUDED.provider,
      is_primary = EXCLUDED.is_primary,
      is_canonical_smart_wallet = EXCLUDED.is_canonical_smart_wallet,
      is_embedded_eoa = EXCLUDED.is_embedded_eoa,
      verified_at = NOW(),
      updated_at = NOW();
  `
}

/**
 * Operator/server repair when `profiles.csw_address` was pinned to a non-canonical
 * wallet (for example a Zora readonly smart-wallet candidate or an undeployed EOA).
 */
export async function repointCanonicalCswOnProfile(params: {
  db: Db
  profileId: number
  canonicalCswAddress: string
  embeddedEoaAddress?: string | null
  clearBaseSubAccount?: boolean
}): Promise<RepointCanonicalCswResult> {
  const canonical = normalizeAddress(params.canonicalCswAddress)
  if (!canonical) throw new Error('invalid_canonical_csw_address')

  const embedded = normalizeAddress(params.embeddedEoaAddress ?? null)

  const before = await params.db.sql`
    SELECT id, csw_address, primary_embedded_eoa, embedded_wallet, base_sub_account
    FROM profiles
    WHERE id = ${params.profileId}
    LIMIT 1;
  `
  const row = before.rows?.[0]
  if (!row) throw new Error('profile_not_found')

  const previousCswAddress = normalizeAddress(row.csw_address)
  const previousEmbeddedEoa =
    normalizeAddress(row.primary_embedded_eoa) ?? normalizeAddress(row.embedded_wallet)
  const clearedBaseSubAccount =
    params.clearBaseSubAccount === true ? normalizeAddress(row.base_sub_account) : null

  await params.db.sql`
    UPDATE profile_wallets
    SET is_canonical_smart_wallet = false, updated_at = NOW()
    WHERE profile_id = ${params.profileId};
  `

  await upsertProfileWalletRow(params.db, {
    profileId: params.profileId,
    address: canonical,
    chain: 'evm',
    walletType: 'smart_wallet',
    provider: 'unknown',
    isPrimary: false,
    isCanonicalSmartWallet: true,
    isEmbeddedEoa: false,
  })

  if (embedded) {
    await params.db.sql`
      UPDATE profile_wallets
      SET is_embedded_eoa = false, is_primary = false, updated_at = NOW()
      WHERE profile_id = ${params.profileId}
        AND lower(address) <> ${embedded};
    `
    await upsertProfileWalletRow(params.db, {
      profileId: params.profileId,
      address: embedded,
      chain: 'evm',
      walletType: 'embedded_eoa',
      provider: 'privy',
      isPrimary: true,
      isCanonicalSmartWallet: false,
      isEmbeddedEoa: true,
    })
  }

  await params.db.sql`
    UPDATE profiles
    SET
      csw_address = ${canonical},
      primary_embedded_eoa = ${embedded ?? row.primary_embedded_eoa ?? row.embedded_wallet ?? null},
      embedded_wallet = ${embedded ?? row.embedded_wallet ?? row.primary_embedded_eoa ?? null},
      primary_wallet = ${embedded ?? row.primary_embedded_eoa ?? row.embedded_wallet ?? canonical},
      base_sub_account = CASE
        WHEN ${params.clearBaseSubAccount === true} THEN NULL
        ELSE base_sub_account
      END,
      updated_at = NOW()
    WHERE id = ${params.profileId};
  `

  return {
    profileId: params.profileId,
    previousCswAddress,
    canonicalCswAddress: canonical,
    previousEmbeddedEoa,
    nextEmbeddedEoa: embedded ?? previousEmbeddedEoa,
    clearedBaseSubAccount,
  }
}
