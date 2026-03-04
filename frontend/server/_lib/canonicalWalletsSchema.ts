type Db = { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> }

let canonicalWalletsSchemaEnsured = false

async function assertNoDuplicatePrivyUserIds(db: Db): Promise<void> {
  const dupes = await db.sql`
    SELECT privy_user_id
    FROM profiles
    WHERE privy_user_id IS NOT NULL
    GROUP BY privy_user_id
    HAVING COUNT(*) > 1
    LIMIT 1;
  `
  if (Array.isArray(dupes.rows) && dupes.rows.length > 0) {
    throw new Error('duplicate_privy_user_id')
  }
}

export async function ensureCanonicalWalletsSchema(db: Db): Promise<void> {
  if (canonicalWalletsSchemaEnsured) return
  try {
    await db.sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS primary_smart_wallet TEXT NULL;`
    await db.sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS primary_embedded_eoa TEXT NULL;`
    await db.sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS display_name TEXT NULL;`
    await db.sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio TEXT NULL;`
    await db.sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS website TEXT NULL;`
    await db.sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT NULL;`
    await db.sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS banner_url TEXT NULL;`
    await db.sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_fields JSONB NULL;`
    await db.sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS canonical_solana_wallet TEXT NULL;`
    await db.sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS operational_solana_wallet TEXT NULL;`

    await db.sql`
      CREATE TABLE IF NOT EXISTS wallets (
        address TEXT PRIMARY KEY,
        chain TEXT NOT NULL DEFAULT 'evm',
        wallet_type TEXT NOT NULL,
        provider TEXT NOT NULL DEFAULT 'unknown',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `

    await db.sql`
      CREATE TABLE IF NOT EXISTS profile_wallets (
        profile_id BIGINT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        address TEXT NOT NULL REFERENCES wallets(address) ON DELETE CASCADE,
        is_primary BOOLEAN NOT NULL DEFAULT false,
        is_canonical_smart_wallet BOOLEAN NOT NULL DEFAULT false,
        is_embedded_eoa BOOLEAN NOT NULL DEFAULT false,
        is_canonical_solana_wallet BOOLEAN NOT NULL DEFAULT false,
        is_operational_solana_wallet BOOLEAN NOT NULL DEFAULT false,
        verified_at TIMESTAMPTZ,
        metadata JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (profile_id, address)
      );
    `
    await db.sql`ALTER TABLE profile_wallets ADD COLUMN IF NOT EXISTS is_canonical_solana_wallet BOOLEAN NOT NULL DEFAULT false;`
    await db.sql`ALTER TABLE profile_wallets ADD COLUMN IF NOT EXISTS is_operational_solana_wallet BOOLEAN NOT NULL DEFAULT false;`

    await db.sql`
      CREATE UNIQUE INDEX IF NOT EXISTS profile_wallets_one_canonical
      ON profile_wallets (profile_id)
      WHERE is_canonical_smart_wallet = true;
    `
    await db.sql`
      CREATE UNIQUE INDEX IF NOT EXISTS profile_wallets_one_embedded_eoa
      ON profile_wallets (profile_id)
      WHERE is_embedded_eoa = true;
    `
    await db.sql`
      CREATE UNIQUE INDEX IF NOT EXISTS profile_wallets_one_canonical_solana
      ON profile_wallets (profile_id)
      WHERE is_canonical_solana_wallet = true;
    `
    await db.sql`
      CREATE UNIQUE INDEX IF NOT EXISTS profile_wallets_one_operational_solana
      ON profile_wallets (profile_id)
      WHERE is_operational_solana_wallet = true;
    `
    await db.sql`
      CREATE UNIQUE INDEX IF NOT EXISTS profile_wallets_one_primary
      ON profile_wallets (profile_id)
      WHERE is_primary = true;
    `

    await db.sql`CREATE INDEX IF NOT EXISTS profile_wallets_address_idx ON profile_wallets (address);`
    await db.sql`CREATE INDEX IF NOT EXISTS profile_wallets_profile_id_idx ON profile_wallets (profile_id);`
    await db.sql`CREATE INDEX IF NOT EXISTS profile_wallets_address_lc_idx ON profile_wallets ((LOWER(address)));`
    await db.sql`CREATE INDEX IF NOT EXISTS wallets_address_lc_idx ON wallets ((LOWER(address)));`
    await db.sql`
      CREATE INDEX IF NOT EXISTS profiles_primary_wallet_lc_idx
      ON profiles ((LOWER(primary_wallet)))
      WHERE primary_wallet IS NOT NULL;
    `
    await db.sql`
      CREATE INDEX IF NOT EXISTS profiles_embedded_wallet_lc_idx
      ON profiles ((LOWER(embedded_wallet)))
      WHERE embedded_wallet IS NOT NULL;
    `
    await db.sql`
      CREATE INDEX IF NOT EXISTS profiles_primary_embedded_eoa_lc_idx
      ON profiles ((LOWER(primary_embedded_eoa)))
      WHERE primary_embedded_eoa IS NOT NULL;
    `
    await db.sql`
      CREATE INDEX IF NOT EXISTS profiles_primary_smart_wallet_lc_idx
      ON profiles ((LOWER(primary_smart_wallet)))
      WHERE primary_smart_wallet IS NOT NULL;
    `
    await db.sql`
      CREATE INDEX IF NOT EXISTS profiles_csw_address_lc_idx
      ON profiles ((LOWER(csw_address)))
      WHERE csw_address IS NOT NULL;
    `
    await db.sql`
      CREATE INDEX IF NOT EXISTS profiles_base_sub_account_lc_idx
      ON profiles ((LOWER(base_sub_account)))
      WHERE base_sub_account IS NOT NULL;
    `
    await db.sql`
      CREATE INDEX IF NOT EXISTS profiles_primary_smart_wallet_idx
      ON profiles (primary_smart_wallet)
      WHERE primary_smart_wallet IS NOT NULL;
    `
    await db.sql`
      CREATE INDEX IF NOT EXISTS profiles_canonical_solana_wallet_idx
      ON profiles (canonical_solana_wallet)
      WHERE canonical_solana_wallet IS NOT NULL;
    `
    await db.sql`
      CREATE INDEX IF NOT EXISTS profiles_operational_solana_wallet_idx
      ON profiles (operational_solana_wallet)
      WHERE operational_solana_wallet IS NOT NULL;
    `

    await assertNoDuplicatePrivyUserIds(db)
    await db.sql`
      CREATE UNIQUE INDEX IF NOT EXISTS profiles_privy_user_id_unique
      ON profiles (privy_user_id)
      WHERE privy_user_id IS NOT NULL;
    `

    canonicalWalletsSchemaEnsured = true
  } catch {
    canonicalWalletsSchemaEnsured = false
    throw new Error('canonical_wallets_schema_ensure_failed')
  }
}
