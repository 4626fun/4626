import type { Db } from './walletSync.js'

export type DisconnectExternalWalletResult = {
  profileId: number
  clearedPrimaryWallet: boolean
  clearedProfileWalletRows: number
  nextPrimaryWallet: string | null
}

function normalizeAddress(value: unknown): string | null {
  const out = String(value ?? '').trim().toLowerCase()
  if (!/^0x[a-f0-9]{40}$/.test(out)) return null
  return out
}

function addressEquals(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = normalizeAddress(a)
  const right = normalizeAddress(b)
  if (!left || !right) return false
  return left === right
}

export function resolveProfilesPrimaryWalletColumn(input: {
  embedded: string | null
  canonical: string | null
  activeOwner: string | null
  classificationPrimary: string | null
}): string | null {
  // WALLET-004: Embedded EOA should always win over activeOwner, even when
  // canonical is absent. The column tracks the embedded signer (or CSW when
  // embedded is absent) — not a transient wagmi extension. Previously, embedded
  // only won when canonical was also present, contradicting the comment and
  // disconnect logic.
  if (input.embedded) return input.embedded
  if (input.canonical) return input.canonical
  return input.activeOwner ?? input.classificationPrimary ?? null
}

export async function disconnectExternalWalletFromProfile(params: {
  db: Db
  profileId: number
  externalAddress: string
}): Promise<DisconnectExternalWalletResult> {
  const external = normalizeAddress(params.externalAddress)
  if (!external) throw new Error('invalid_external_address')

  const profileRow = await params.db.sql`
    SELECT
      id,
      primary_wallet,
      primary_embedded_eoa,
      embedded_wallet,
      csw_address,
      primary_smart_wallet
    FROM profiles
    WHERE id = ${params.profileId}
    LIMIT 1;
  `
  const profile = profileRow.rows?.[0]
  if (!profile) throw new Error('profile_not_found')

  const embedded =
    normalizeAddress(profile.primary_embedded_eoa) ??
    normalizeAddress(profile.embedded_wallet)
  const canonical =
    normalizeAddress(profile.csw_address) ??
    normalizeAddress(profile.primary_smart_wallet)

  if (embedded && addressEquals(external, embedded)) {
    throw new Error('cannot_disconnect_embedded_signer')
  }
  if (canonical && addressEquals(external, canonical)) {
    throw new Error('cannot_disconnect_canonical_csw')
  }

  const currentPrimary = normalizeAddress(profile.primary_wallet)
  const nextPrimary =
    embedded ??
    canonical ??
    (currentPrimary && !addressEquals(currentPrimary, external) ? currentPrimary : null)

  let clearedPrimaryWallet = false
  if (currentPrimary && addressEquals(currentPrimary, external)) {
    await params.db.sql`
      UPDATE profiles
      SET
        primary_wallet = ${nextPrimary},
        updated_at = NOW()
      WHERE id = ${params.profileId};
    `
    clearedPrimaryWallet = true
  }

  const clearedRows = await params.db.sql`
    UPDATE profile_wallets
    SET
      is_primary = false,
      updated_at = NOW()
    WHERE profile_id = ${params.profileId}
      AND lower(address) = ${external}
      AND is_canonical_smart_wallet = false
      AND is_embedded_eoa = false;
  `

  return {
    profileId: params.profileId,
    clearedPrimaryWallet,
    clearedProfileWalletRows: Number(clearedRows.rowCount ?? 0),
    nextPrimaryWallet: nextPrimary,
  }
}
