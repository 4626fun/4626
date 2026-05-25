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

async function upsertWalletRow(db: Db, address: string): Promise<void> {
  await db.sql`
    INSERT INTO wallets (address, chain, wallet_type, provider)
    VALUES (${address}, ${'evm'}, ${'smart_wallet'}, ${'unknown'})
    ON CONFLICT (address) DO UPDATE
    SET
      chain = COALESCE(EXCLUDED.chain, wallets.chain),
      wallet_type = COALESCE(EXCLUDED.wallet_type, wallets.wallet_type),
      provider = CASE
        WHEN wallets.provider = ${'unknown'} THEN EXCLUDED.provider
        ELSE wallets.provider
      END;
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
    SELECT id, csw_address, primary_smart_wallet, primary_embedded_eoa, embedded_wallet, base_sub_account
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

  await upsertWalletRow(params.db, canonical)
  if (embedded) {
    await params.db.sql`
      INSERT INTO wallets (address, chain, wallet_type, provider)
      VALUES (${embedded}, ${'evm'}, ${'embedded_eoa'}, ${'privy'})
      ON CONFLICT (address) DO NOTHING;
    `
  }

  await params.db.sql`
    UPDATE profile_wallets
    SET is_canonical_smart_wallet = false, updated_at = NOW()
    WHERE profile_id = ${params.profileId};
  `

  await params.db.sql`
    INSERT INTO profile_wallets (
      profile_id,
      address,
      is_primary,
      is_canonical_smart_wallet,
      is_embedded_eoa,
      verified_at,
      updated_at
    )
    VALUES (${params.profileId}, ${canonical}, false, true, false, NOW(), NOW())
    ON CONFLICT (profile_id, address) DO UPDATE
    SET
      is_canonical_smart_wallet = true,
      verified_at = NOW(),
      updated_at = NOW();
  `

  if (embedded) {
    await params.db.sql`
      UPDATE profile_wallets
      SET is_embedded_eoa = false, is_primary = false, updated_at = NOW()
      WHERE profile_id = ${params.profileId}
        AND lower(address) <> ${embedded};
    `
    await params.db.sql`
      INSERT INTO profile_wallets (
        profile_id,
        address,
        is_primary,
        is_canonical_smart_wallet,
        is_embedded_eoa,
        verified_at,
        updated_at
      )
      VALUES (${params.profileId}, ${embedded}, true, false, true, NOW(), NOW())
      ON CONFLICT (profile_id, address) DO UPDATE
      SET
        is_primary = true,
        is_embedded_eoa = true,
        verified_at = NOW(),
        updated_at = NOW();
    `
  }

  await params.db.sql`
    UPDATE profiles
    SET
      csw_address = ${canonical},
      primary_smart_wallet = ${canonical},
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
