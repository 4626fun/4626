import { ensureReferralsSchema } from './referrals.js'
import { ensureWaitlistPointsSchema } from './waitlistPoints.js'
import { ensureCanonicalWalletsSchema } from './canonicalWalletsSchema.js'

type Db = { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> }

let waitlistSchemaEnsured = false

export async function ensureWaitlistSchema(db: Db): Promise<void> {
  if (waitlistSchemaEnsured) return
  try {
    // Create a minimal, durable waitlist schema. Safe to run repeatedly.
    await db.sql`
      CREATE TABLE IF NOT EXISTS profiles (
        id BIGSERIAL PRIMARY KEY,
        email TEXT UNIQUE,
        primary_wallet TEXT NULL,
        solana_wallet TEXT NULL,
        privy_user_id TEXT NULL,
        embedded_wallet TEXT NULL,
        embedded_wallet_chain TEXT NULL,
        embedded_wallet_client_type TEXT NULL,
        base_sub_account TEXT NULL,
        persona TEXT NULL,
        has_creator_coin BOOLEAN NULL,
        farcaster_fid BIGINT NULL,
        contact_preference TEXT NULL,
        border_tier INT NOT NULL DEFAULT 0,
        x_follow_verified_at TIMESTAMPTZ NULL,
        app_access_status TEXT NOT NULL DEFAULT 'pending',
        app_access_decision_note TEXT NULL,
        app_access_decided_at TIMESTAMPTZ NULL,
        app_access_decided_by TEXT NULL,
        verifications JSONB NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `

    // Backfill/migrate older tables that were created without newer columns.
    // `IF NOT EXISTS` is supported on modern Postgres versions; if it throws, we ignore.
    try {
      await db.sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS persona TEXT NULL;`
      await db.sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS has_creator_coin BOOLEAN NULL;`
      await db.sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS farcaster_fid BIGINT NULL;`
      await db.sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS privy_user_id TEXT NULL;`
      await db.sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS embedded_wallet TEXT NULL;`
      await db.sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS embedded_wallet_chain TEXT NULL;`
      await db.sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS embedded_wallet_client_type TEXT NULL;`
      await db.sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS base_sub_account TEXT NULL;`
      await db.sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS primary_wallet TEXT NULL;`
      await db.sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS solana_wallet TEXT NULL;`
      await db.sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS contact_preference TEXT NULL;`
      await db.sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS app_access_status TEXT NOT NULL DEFAULT 'pending';`
      await db.sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS app_access_decision_note TEXT NULL;`
      await db.sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS app_access_decided_at TIMESTAMPTZ NULL;`
      await db.sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS app_access_decided_by TEXT NULL;`
      await db.sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS verifications JSONB NULL;`
      await db.sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();`
      await db.sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();`
      await db.sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS csw_address TEXT NULL;`
      await db.sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS primary_smart_wallet TEXT NULL;`
      await db.sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS primary_embedded_eoa TEXT NULL;`
      await db.sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS border_tier INT NOT NULL DEFAULT 0;`
      await db.sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS x_follow_verified_at TIMESTAMPTZ NULL;`
      await db.sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS display_name TEXT NULL;`
      await db.sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio TEXT NULL;`
      await db.sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS website TEXT NULL;`
      await db.sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT NULL;`
      await db.sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS banner_url TEXT NULL;`
      await db.sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_fields JSONB NULL;`

      // Pre-provisioning columns (quickstart data prepared at waitlist signup)
      await db.sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preprovisioned_at TIMESTAMPTZ NULL;`
      await db.sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preprov_server_wallet_id TEXT NULL;`
      await db.sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preprov_server_wallet_address TEXT NULL;`
      await db.sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preprov_coin_address TEXT NULL;`
      await db.sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preprov_coin_symbol TEXT NULL;`
      await db.sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preprov_farcaster_username TEXT NULL;`
      await db.sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preprov_farcaster_pfp TEXT NULL;`
      await db.sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preprov_zora_handle TEXT NULL;`
      await db.sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS erc8004_agent_id BIGINT NULL;`
      await db.sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS erc8128_agent_id TEXT NULL;`
      await db.sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS lens_handle TEXT NULL;`
      await db.sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS lens_account_address TEXT NULL;`
      await db.sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS lens_owner_address TEXT NULL;`
      await db.sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS lens_grove_uri TEXT NULL;`
      await db.sql`ALTER TABLE profiles ALTER COLUMN email DROP NOT NULL;`
    } catch {
      // ignore (older Postgres or restricted perms)
    }

    await db.sql`CREATE INDEX IF NOT EXISTS profiles_created_at_idx ON profiles (created_at DESC);`
    await db.sql`CREATE INDEX IF NOT EXISTS profiles_csw_idx ON profiles (csw_address) WHERE csw_address IS NOT NULL;`

    // Referral schema depends on profiles existing.
    await ensureReferralsSchema(db)

    // Points + profile completion schema.
    await ensureWaitlistPointsSchema(db)

    // Canonical wallet graph + provenance fields.
    await ensureCanonicalWalletsSchema(db)

    waitlistSchemaEnsured = true
  } catch {
    waitlistSchemaEnsured = false
    throw new Error('waitlist_schema_ensure_failed')
  }
}
