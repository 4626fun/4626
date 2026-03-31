type Db = { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> }

let waitlistPointsSchemaEnsured = false

export const WAITLIST_POINTS = {
  // Core actions
  signup: 5,
  linkCsw: 10,
  
  // Referral points (awarded to referrer)
  referralSignup: 2,         // When referred user signs up
  referralCswLink: 4,        // When referred user links CSW
  qualifiedReferral: 6,      // When referred user completes profile
  
  // Social actions - verified
  baseApp: 2,
  zora: 2,
  x: 2,
  discord: 2,
  telegram: 2,
  
  // Bonus actions - honor system
  github: 1,
  tiktok: 1,
  instagram: 1,
  reddit: 1,

  // Agent gamification
  agentFeedback: 1,
  agentReputation: 8,

  // Lens + Grove identity/proof
  lensIdentity: 3,
  groveProof: 2,
} as const

export type WaitlistPointSource = 
  | 'waitlist_signup'
  | 'csw_link'
  | 'referral_signup'
  | 'referral_csw_link'
  | 'referral_qualified'
  | 'social_base_app'
  | 'social_zora'
  | 'social_x'
  | 'social_discord'
  | 'social_telegram'
  | 'bonus_github'
  | 'bonus_tiktok'
  | 'bonus_instagram'
  | 'bonus_reddit'
  | 'agent_feedback'
  | 'agent_reputation'
  | 'lens_identity'
  | 'grove_proof'
  | 'task' // Compatibility

const WAITLIST_POINT_SOURCE_SET: ReadonlySet<WaitlistPointSource> = new Set<WaitlistPointSource>([
  'waitlist_signup',
  'csw_link',
  'referral_signup',
  'referral_csw_link',
  'referral_qualified',
  'social_base_app',
  'social_zora',
  'social_x',
  'social_discord',
  'social_telegram',
  'bonus_github',
  'bonus_tiktok',
  'bonus_instagram',
  'bonus_reddit',
  'agent_feedback',
  'agent_reputation',
  'lens_identity',
  'grove_proof',
  'task',
])

export function isWaitlistPointSource(value: string): value is WaitlistPointSource {
  return WAITLIST_POINT_SOURCE_SET.has(value as WaitlistPointSource)
}

export async function ensureWaitlistPointsSchema(db: Db): Promise<void> {
  if (waitlistPointsSchemaEnsured) return
  try {
    // Profile completion (used to qualify referrals).
    try {
      await db.sql`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_completed_at TIMESTAMPTZ NULL;`
    } catch {
      // ignore (older Postgres or restricted perms)
    }

    // Referral conversion qualification state (backwards-compatible: NULL status treated as compatibility-qualified by queries).
    try {
      await db.sql`ALTER TABLE referral_conversions ADD COLUMN IF NOT EXISTS status TEXT NULL;`
      await db.sql`ALTER TABLE referral_conversions ADD COLUMN IF NOT EXISTS qualified_at TIMESTAMPTZ NULL;`
    } catch {
      // ignore
    }

    // Append-only points ledger (idempotent via unique key).
    await db.sql`
      CREATE TABLE IF NOT EXISTS points (
        id BIGSERIAL PRIMARY KEY,
        signup_id BIGINT NOT NULL,
        source TEXT NOT NULL,
        source_id TEXT NULL,
        amount INT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `
    await db.sql`
      CREATE UNIQUE INDEX IF NOT EXISTS points_unique_source
        ON points (signup_id, source, source_id)
        WHERE source_id IS NOT NULL;
    `
    await db.sql`CREATE INDEX IF NOT EXISTS points_signup_idx ON points (signup_id, created_at DESC);`

    waitlistPointsSchemaEnsured = true
  } catch {
    waitlistPointsSchemaEnsured = false
    throw new Error('waitlist_points_schema_ensure_failed')
  }
}

export async function awardWaitlistPoints(params: {
  db: Db
  signupId: number
  source: string
  sourceId: string
  amount: number
}): Promise<boolean> {
  const { db, signupId, source, sourceId, amount } = params
  const normalizedSource = String(source || '').trim()
  if (!isWaitlistPointSource(normalizedSource)) {
    throw new Error('invalid_waitlist_point_source')
  }
  const normalizedAmount = Number(amount)
  if (!Number.isFinite(normalizedAmount) || normalizedAmount < 0) {
    throw new Error('invalid_waitlist_point_amount')
  }

  const inserted = await db.sql`
    INSERT INTO points (signup_id, source, source_id, amount, created_at)
    VALUES (${signupId}, ${normalizedSource}, ${sourceId}, ${Math.trunc(normalizedAmount)}, NOW())
    -- points_unique_source is a partial unique index in some envs, so a column-targeted
    -- ON CONFLICT can throw "no unique or exclusion constraint..." in Postgres.
    ON CONFLICT DO NOTHING
    RETURNING id;
  `
  return Boolean(inserted?.rows?.[0]?.id)
}
