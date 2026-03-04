type Db = { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> }

let creatorWalletsEnsured = false

export async function ensureCreatorWalletsSchema(db: Db): Promise<void> {
  if (creatorWalletsEnsured) return
  try {
    await db.sql`
      CREATE TABLE IF NOT EXISTS creator_wallets (
        id BIGSERIAL PRIMARY KEY,
        coin_address TEXT NOT NULL,
        wallet_address TEXT NOT NULL,
        wallet_role TEXT NOT NULL,
        verified_via TEXT NOT NULL DEFAULT 'siwe',
        privy_user_id TEXT NULL,
        verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `
    try {
      await db.sql`ALTER TABLE creator_wallets ENABLE ROW LEVEL SECURITY;`
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
              AND tablename = 'creator_wallets'
              AND policyname = 'creator_wallets_deny_all'
          ) THEN
            CREATE POLICY creator_wallets_deny_all
              ON creator_wallets
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

    await db.sql`
      CREATE UNIQUE INDEX IF NOT EXISTS creator_wallets_coin_wallet_unique
        ON creator_wallets (coin_address, wallet_address);
    `
    await db.sql`
      CREATE INDEX IF NOT EXISTS creator_wallets_wallet_lc_idx
        ON creator_wallets ((LOWER(wallet_address)));
    `
    creatorWalletsEnsured = true
  } catch (err) {
    // Don't permanently lock out future attempts if a migration fails transiently.
    creatorWalletsEnsured = false
    throw err
  }
}
