type Db = { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> }

let waitlistPointsSchemaEnsured = false
let waitlistPointsSchemaEnsurePromise: Promise<void> | null = null

export const WAITLIST_POINTS = {
  // Core actions
  signup: 5,
  linkCsw: 10,

  // Referral points (awarded to referrer)
  referralSignup: 2, // When referred user signs up
  referralCswLink: 4, // When referred user links CSW
  qualifiedReferral: 6, // When referred user completes profile

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
  if (waitlistPointsSchemaEnsurePromise) return waitlistPointsSchemaEnsurePromise
  waitlistPointsSchemaEnsurePromise = (async () => {
    try {
      const preflight = await db.sql`
        SELECT
          to_regclass('public.points') IS NOT NULL AS has_points,
          EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'profiles'
              AND column_name = 'profile_completed_at'
          ) AS has_profile_completed_at,
          EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'referral_conversions'
              AND column_name = 'status'
          ) AS has_referral_status,
          EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'referral_conversions'
              AND column_name = 'qualified_at'
          ) AS has_referral_qualified_at;
      `
      const status = preflight.rows?.[0] ?? {}
      if (
        Boolean(status.has_points) &&
        Boolean(status.has_profile_completed_at) &&
        Boolean(status.has_referral_status) &&
        Boolean(status.has_referral_qualified_at)
      ) {
        waitlistPointsSchemaEnsured = true
        return
      }
      const missing: string[] = []
      if (!Boolean(status.has_points)) missing.push('public.points')
      if (!Boolean(status.has_profile_completed_at)) missing.push('public.profiles.profile_completed_at')
      if (!Boolean(status.has_referral_status)) missing.push('public.referral_conversions.status')
      if (!Boolean(status.has_referral_qualified_at)) missing.push('public.referral_conversions.qualified_at')
      throw new Error(`waitlist_points_schema_migration_required:${missing.join(',')}`)
    } catch (error) {
      waitlistPointsSchemaEnsured = false
      if (
        error instanceof Error &&
        error.message.startsWith('waitlist_points_schema_migration_required:')
      ) {
        throw error
      }
      throw new Error('waitlist_points_schema_ensure_failed')
    } finally {
      waitlistPointsSchemaEnsurePromise = null
    }
  })()
  return waitlistPointsSchemaEnsurePromise
}

export async function awardWaitlistPoints(params: {
  db: Db
  signupId: number
  source: string
  sourceId?: string | null
  amount: number
}): Promise<boolean> {
  const { db, signupId, source, amount } = params
  const normalizedSource = String(source || '').trim()
  if (!isWaitlistPointSource(normalizedSource)) {
    throw new Error('invalid_waitlist_point_source')
  }
  const normalizedAmount = Number(amount)
  if (!Number.isFinite(normalizedAmount) || normalizedAmount < 0) {
    throw new Error('invalid_waitlist_point_amount')
  }
  const normalizedSourceId = params.sourceId == null ? null : String(params.sourceId).trim() || null

  if (normalizedSource === 'csw_link') {
    // Hard cap CSW bonus at one award per signup even if callers rotate sourceId.
    const alreadyAwarded = await db.sql`
      SELECT 1
      FROM points
      WHERE signup_id = ${signupId}
        AND source = 'csw_link'
      LIMIT 1;
    `
    if (alreadyAwarded?.rows?.length) return false
  }

  const sourceIdForInsert = normalizedSource === 'csw_link' ? null : normalizedSourceId

  const inserted = await db.sql`
    INSERT INTO points (signup_id, source, source_id, amount, created_at)
    VALUES (${signupId}, ${normalizedSource}, ${sourceIdForInsert}, ${Math.trunc(normalizedAmount)}, NOW())
    -- points_unique_source is a partial unique index in some envs, so a column-targeted
    -- ON CONFLICT can throw "no unique or exclusion constraint..." in Postgres.
    ON CONFLICT DO NOTHING
    RETURNING id;
  `
  return Boolean(inserted?.rows?.[0]?.id)
}
