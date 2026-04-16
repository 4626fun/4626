type Db = {
  sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }>
}

export const CSW_OWNER_LINK_STATUSES = [
  'linked_ok',
  'linked_mapping_mismatch',
  'owner_link_missing',
  'canonical_wallet_mismatch',
  'canonical_wallet_missing',
  'embedded_eoa_missing',
  'rpc_error',
] as const

export type CswOwnerLinkStatus = (typeof CSW_OWNER_LINK_STATUSES)[number]

export type CswOwnerLinkStatusUpsert = {
  profileId: number
  privyUserId: string | null
  embeddedEoa: string | null
  canonicalSmartWallet: string | null
  ownerLinked: boolean
  status: CswOwnerLinkStatus
  reason: string | null
  suggestedCanonicalSmartWallet: string | null
  metadata: Record<string, unknown> | null
  checkedAtIso?: string | null
}

let schemaEnsured = false

function isAddressLike(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

function normalizeLowerAddress(value: unknown): string | null {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return isAddressLike(raw) ? raw : null
}

function normalizeNullableString(value: unknown): string | null {
  const raw = typeof value === 'string' ? value.trim() : ''
  return raw ? raw : null
}

export async function ensureCswOwnerLinkStatusSchema(db: Db): Promise<void> {
  if (schemaEnsured) return
  try {
    await db.sql`
      CREATE TABLE IF NOT EXISTS csw_owner_link_status (
        profile_id BIGINT PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
        privy_user_id TEXT NULL,
        embedded_eoa TEXT NULL,
        canonical_smart_wallet TEXT NULL,
        owner_linked BOOLEAN NOT NULL DEFAULT false,
        status TEXT NOT NULL,
        reason TEXT NULL,
        suggested_canonical_smart_wallet TEXT NULL,
        metadata JSONB NULL,
        checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `

    await db.sql`ALTER TABLE csw_owner_link_status ADD COLUMN IF NOT EXISTS privy_user_id TEXT NULL;`
    await db.sql`ALTER TABLE csw_owner_link_status ADD COLUMN IF NOT EXISTS embedded_eoa TEXT NULL;`
    await db.sql`ALTER TABLE csw_owner_link_status ADD COLUMN IF NOT EXISTS canonical_smart_wallet TEXT NULL;`
    await db.sql`ALTER TABLE csw_owner_link_status ADD COLUMN IF NOT EXISTS owner_linked BOOLEAN NOT NULL DEFAULT false;`
    await db.sql`ALTER TABLE csw_owner_link_status ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'owner_link_missing';`
    await db.sql`ALTER TABLE csw_owner_link_status ADD COLUMN IF NOT EXISTS reason TEXT NULL;`
    await db.sql`ALTER TABLE csw_owner_link_status ADD COLUMN IF NOT EXISTS suggested_canonical_smart_wallet TEXT NULL;`
    await db.sql`ALTER TABLE csw_owner_link_status ADD COLUMN IF NOT EXISTS metadata JSONB NULL;`
    await db.sql`ALTER TABLE csw_owner_link_status ADD COLUMN IF NOT EXISTS checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW();`
    await db.sql`ALTER TABLE csw_owner_link_status ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();`
    try {
      await db.sql`ALTER TABLE csw_owner_link_status ENABLE ROW LEVEL SECURITY;`
    } catch {
      // Ignore if RLS cannot be enabled in this runtime.
    }
    try {
      await db.sql`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1
            FROM pg_policies
            WHERE schemaname = 'public'
              AND tablename = 'csw_owner_link_status'
              AND policyname = 'csw_owner_link_status_deny_all'
          ) THEN
            CREATE POLICY csw_owner_link_status_deny_all
              ON csw_owner_link_status
              FOR ALL
              TO public
              USING (false)
              WITH CHECK (false);
          END IF;
        END
        $$;
      `
    } catch {
      // Ignore if policy creation is unavailable in this runtime.
    }

    try {
      await db.sql`
        ALTER TABLE csw_owner_link_status
        ADD CONSTRAINT csw_owner_link_status_status_check
        CHECK (
          status IN (
            'linked_ok',
            'linked_mapping_mismatch',
            'owner_link_missing',
            'canonical_wallet_mismatch',
            'canonical_wallet_missing',
            'embedded_eoa_missing',
            'rpc_error'
          )
        );
      `
    } catch {
      // Constraint likely already exists.
    }

    await db.sql`CREATE INDEX IF NOT EXISTS csw_owner_link_status_status_idx ON csw_owner_link_status (status);`
    await db.sql`CREATE INDEX IF NOT EXISTS csw_owner_link_status_checked_idx ON csw_owner_link_status (checked_at DESC);`
    await db.sql`CREATE INDEX IF NOT EXISTS csw_owner_link_status_privy_user_idx ON csw_owner_link_status (privy_user_id);`
    await db.sql`
      CREATE INDEX IF NOT EXISTS csw_owner_link_status_owner_linked_idx
      ON csw_owner_link_status (owner_linked, checked_at DESC);
    `
    schemaEnsured = true
  } catch {
    schemaEnsured = false
    throw new Error('csw_owner_link_status_schema_ensure_failed')
  }
}

export async function upsertCswOwnerLinkStatus(db: Db, input: CswOwnerLinkStatusUpsert): Promise<void> {
  const profileId = Number(input.profileId)
  if (!Number.isFinite(profileId) || profileId <= 0) throw new Error('invalid_profile_id')
  if (!CSW_OWNER_LINK_STATUSES.includes(input.status)) throw new Error('invalid_status')

  const privyUserId = normalizeNullableString(input.privyUserId)
  const embeddedEoa = normalizeLowerAddress(input.embeddedEoa)
  const canonicalSmartWallet = normalizeLowerAddress(input.canonicalSmartWallet)
  const suggestedCanonical = normalizeLowerAddress(input.suggestedCanonicalSmartWallet)
  const reason = normalizeNullableString(input.reason)
  const metadata =
    input.metadata && typeof input.metadata === 'object' && !Array.isArray(input.metadata)
      ? input.metadata
      : null

  await db.sql`
    INSERT INTO csw_owner_link_status (
      profile_id,
      privy_user_id,
      embedded_eoa,
      canonical_smart_wallet,
      owner_linked,
      status,
      reason,
      suggested_canonical_smart_wallet,
      metadata,
      checked_at,
      updated_at
    )
    VALUES (
      ${profileId},
      ${privyUserId},
      ${embeddedEoa},
      ${canonicalSmartWallet},
      ${Boolean(input.ownerLinked)},
      ${input.status},
      ${reason},
      ${suggestedCanonical},
      ${metadata},
      ${input.checkedAtIso ? new Date(input.checkedAtIso) : new Date()},
      NOW()
    )
    ON CONFLICT (profile_id) DO UPDATE
    SET
      privy_user_id = EXCLUDED.privy_user_id,
      embedded_eoa = EXCLUDED.embedded_eoa,
      canonical_smart_wallet = EXCLUDED.canonical_smart_wallet,
      owner_linked = EXCLUDED.owner_linked,
      status = EXCLUDED.status,
      reason = EXCLUDED.reason,
      suggested_canonical_smart_wallet = EXCLUDED.suggested_canonical_smart_wallet,
      metadata = EXCLUDED.metadata,
      checked_at = EXCLUDED.checked_at,
      updated_at = NOW();
  `
}
