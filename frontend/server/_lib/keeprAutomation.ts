import { ensureKeeprSchema } from './keeprSchema.js'
import { getDb } from './postgres.js'

type JsonMap = Record<string, unknown>

export type KeeprVaultAutomationRow = {
  vaultAddress: `0x${string}`
  profileId: number | null
  canonicalCswAddress: `0x${string}` | null
  embeddedEoaAddress: `0x${string}` | null
  privyWalletId: string | null
  authorizationSource: string | null
  automationEnabled: boolean
  automationScope: string | null
  lastOwnerCheckAt: string | null
  revokedAt: string | null
  metadata: JsonMap
  createdAt: string | null
  updatedAt: string | null
}

function normalizeAddress(value: string, field: string): `0x${string}` {
  const input = String(value ?? '').trim().toLowerCase()
  if (!/^0x[a-f0-9]{40}$/.test(input)) {
    throw new Error(`invalid_${field}`)
  }
  return input as `0x${string}`
}

function normalizeOptionalAddress(value: string | null | undefined, field: string): `0x${string}` | null {
  if (!value) return null
  return normalizeAddress(value, field)
}

function normalizeAddressOrNull(value: unknown, field: string): `0x${string}` | null {
  if (typeof value !== 'string') return null
  const input = value.trim()
  if (!input) return null
  try {
    return normalizeAddress(input, field)
  } catch {
    return null
  }
}

function normalizeOptionalPositiveNumber(value: unknown): number | null {
  const normalized = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(normalized) || normalized <= 0) return null
  return normalized
}

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized ? normalized : null
}

function normalizeBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value === 1
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true' || normalized === '1') return true
    if (normalized === 'false' || normalized === '0') return false
  }
  return false
}

function normalizeMetadata(value: unknown): JsonMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as JsonMap
}

function toIsoString(value: Date | string | null | undefined): string | null {
  if (!value) return null
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

function toOptionalIsoString(value: unknown): string | null {
  if (!value) return null
  const normalized = value instanceof Date ? value : new Date(String(value))
  return Number.isNaN(normalized.getTime()) ? null : normalized.toISOString()
}

function mapAutomationRow(row: any): KeeprVaultAutomationRow | null {
  const vaultAddress = normalizeAddressOrNull(row?.vault_address, 'vault_address')
  if (!vaultAddress) return null

  return {
    vaultAddress,
    profileId: normalizeOptionalPositiveNumber(row?.profile_id),
    canonicalCswAddress: normalizeAddressOrNull(row?.canonical_csw_address, 'canonical_csw_address'),
    embeddedEoaAddress: normalizeAddressOrNull(row?.embedded_eoa_address, 'embedded_eoa_address'),
    privyWalletId: normalizeOptionalString(row?.privy_wallet_id),
    authorizationSource: normalizeOptionalString(row?.authorization_source),
    automationEnabled: normalizeBoolean(row?.automation_enabled),
    automationScope: normalizeOptionalString(row?.automation_scope),
    lastOwnerCheckAt: toOptionalIsoString(row?.last_owner_check_at),
    revokedAt: toOptionalIsoString(row?.revoked_at),
    metadata: normalizeMetadata(row?.metadata),
    createdAt: toOptionalIsoString(row?.created_at),
    updatedAt: toOptionalIsoString(row?.updated_at),
  }
}

export async function upsertKeeprVaultAutomation(params: {
  vaultAddress: `0x${string}`
  profileId: number
  canonicalCswAddress: `0x${string}`
  embeddedEoaAddress?: `0x${string}` | null
  privyWalletId?: string | null
  authorizationSource: string
  automationEnabled?: boolean
  automationScope: string
  lastOwnerCheckAt?: Date | string | null
  revokedAt?: Date | string | null
  metadata?: JsonMap | null
}): Promise<KeeprVaultAutomationRow> {
  const db = await getDb()
  if (!db) throw new Error('db_not_configured')
  await ensureKeeprSchema()

  const vaultAddress = normalizeAddress(params.vaultAddress, 'vault_address')
  const profileId = Number(params.profileId)
  if (!Number.isFinite(profileId) || profileId <= 0) throw new Error('invalid_profile_id')

  const canonicalCswAddress = normalizeAddress(params.canonicalCswAddress, 'canonical_csw_address')
  const embeddedEoaAddress = normalizeOptionalAddress(params.embeddedEoaAddress ?? null, 'embedded_eoa_address')
  const authorizationSource = String(params.authorizationSource ?? '').trim()
  if (!authorizationSource) throw new Error('missing_authorization_source')

  const automationScope = String(params.automationScope ?? '').trim()
  if (!automationScope) throw new Error('missing_automation_scope')

  const privyWalletId = params.privyWalletId ? String(params.privyWalletId).trim() : null
  const lastOwnerCheckAt = toIsoString(params.lastOwnerCheckAt ?? null)
  const revokedAt = toIsoString(params.revokedAt ?? null)
  const metadata = normalizeMetadata(params.metadata ?? {})

  await db.sql`
    INSERT INTO keepr_vault_automation (
      vault_address,
      profile_id,
      canonical_csw_address,
      embedded_eoa_address,
      privy_wallet_id,
      authorization_source,
      automation_enabled,
      automation_scope,
      last_owner_check_at,
      revoked_at,
      metadata,
      updated_at
    ) VALUES (
      ${vaultAddress},
      ${profileId},
      ${canonicalCswAddress},
      ${embeddedEoaAddress},
      ${privyWalletId},
      ${authorizationSource},
      ${params.automationEnabled ?? true},
      ${automationScope},
      ${lastOwnerCheckAt},
      ${revokedAt},
      ${metadata},
      NOW()
    )
    ON CONFLICT (vault_address) DO UPDATE SET
      profile_id = EXCLUDED.profile_id,
      canonical_csw_address = EXCLUDED.canonical_csw_address,
      embedded_eoa_address = EXCLUDED.embedded_eoa_address,
      privy_wallet_id = EXCLUDED.privy_wallet_id,
      authorization_source = EXCLUDED.authorization_source,
      automation_enabled = EXCLUDED.automation_enabled,
      automation_scope = EXCLUDED.automation_scope,
      last_owner_check_at = EXCLUDED.last_owner_check_at,
      revoked_at = EXCLUDED.revoked_at,
      metadata = EXCLUDED.metadata,
      updated_at = NOW();
  `

  const row = await getKeeprVaultAutomationByVaultAddress(vaultAddress)
  if (!row) throw new Error('keepr_vault_automation_upsert_failed')
  return row
}

export async function getKeeprVaultAutomationByVaultAddress(
  vaultAddress: `0x${string}`,
): Promise<KeeprVaultAutomationRow | null> {
  const db = await getDb()
  if (!db) return null
  await ensureKeeprSchema()

  const res = await db.sql`
    SELECT *
    FROM keepr_vault_automation
    WHERE vault_address = ${normalizeAddress(vaultAddress, 'vault_address')}
    LIMIT 1;
  `
  const row = res.rows?.[0] ?? null
  return row ? mapAutomationRow(row) : null
}

export async function listKeeprVaultAutomationByVaultAddresses(
  vaultAddresses: readonly `0x${string}`[],
): Promise<KeeprVaultAutomationRow[]> {
  if (vaultAddresses.length === 0) return []

  const db = await getDb()
  if (!db) return []
  await ensureKeeprSchema()

  const normalizedVaultAddresses = [...new Set(vaultAddresses.map((value) => normalizeAddress(value, 'vault_address')))]
  const res = await db.sql`
    SELECT *
    FROM keepr_vault_automation
    WHERE vault_address = ANY(${normalizedVaultAddresses})
    ORDER BY created_at ASC;
  `

  return (res.rows ?? []).flatMap((row) => {
    const mapped = mapAutomationRow(row)
    return mapped ? [mapped] : []
  })
}

export async function disableKeeprVaultAutomation(params: {
  vaultAddress: `0x${string}`
  revokedAt?: Date | string | null
}): Promise<KeeprVaultAutomationRow | null> {
  const db = await getDb()
  if (!db) throw new Error('db_not_configured')
  await ensureKeeprSchema()

  const revokedAt = toIsoString(params.revokedAt ?? new Date())
  await db.sql`
    UPDATE keepr_vault_automation
    SET automation_enabled = FALSE,
        revoked_at = ${revokedAt},
        updated_at = NOW()
    WHERE vault_address = ${normalizeAddress(params.vaultAddress, 'vault_address')};
  `

  return getKeeprVaultAutomationByVaultAddress(params.vaultAddress)
}
