import { createHash } from 'node:crypto'

type Db = { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> }

let waitlistPointsSchemaEnsured = false
let waitlistPointsSchemaEnsurePromise: Promise<void> | null = null

/** Upper bound on a single award amount. Anything above this is treated as a
 *  caller bug and rejected — keeps economy integrity / integer math safe. */
const MAX_AWARD_AMOUNT = 10_000

/** Max length for the `points.source_id` column we reliably support. Anything
 *  longer gets suffix-hashed instead of truncated, so two distinct awards
 *  can't accidentally dedupe to the same key under `ON CONFLICT DO NOTHING`. */
const MAX_SOURCE_KEY_LEN = 256

export const WAITLIST_POINTS = {
  // Core actions
  signup: 5,
  // Sub-account registration (highest single-action reward). Awarded once
  // per profile by `POST /api/onboarding/register-sub-account`. Source
  // name remains `csw_link` for schema / query stability — the award is
  // conceptually "user enabled 4626 signing on their canonical CSW via a
  // sub-account", per docs/4626-connection-methods.md.
  linkCsw: 50,

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
  /** @deprecated Use `referral_passthrough` — the new model pays referrers
   *  50% of every point their referee scores, rather than milestone
   *  bonuses. Legacy rows keep their 0.60× scoring weight for backfill
   *  compat, but no new `referral_*` rows are written. */
  | 'referral_signup'
  /** @deprecated See `referral_signup`. */
  | 'referral_csw_link'
  /** @deprecated See `referral_signup`. */
  | 'referral_qualified'
  /** Mirrors 50% of a referee's scored point into the referrer's ledger.
   *  Written by `recordReferralPassthrough` when any of the three
   *  points-write helpers credit a referee. Weighted 1.00× in scoring
   *  (the halving happens at insert time). */
  | 'referral_passthrough'
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
  'referral_passthrough',
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

/** Fraction of a referee's earned points that mirrors to the referrer. */
export const REFERRAL_PASSTHROUGH_FRACTION = 0.5 as const

/** Compile-time exhaustiveness: every `referral_*` source in the union must
 *  have a truthy entry here. If a new `referral_*` source lands in the type
 *  union without being listed, TypeScript refuses to compile this file —
 *  forcing an explicit cascade-vs-one-hop decision. */
const REFERRAL_FAMILY_EXEMPT: Record<
  Extract<WaitlistPointSource, `referral_${string}`>,
  true
> = {
  referral_passthrough: true,
  referral_signup: true,
  referral_csw_link: true,
  referral_qualified: true,
}

/** Sources that must NOT trigger another passthrough mirror. Derived from
 *  the exhaustive map above so it can never drift out of sync. */
const PASSTHROUGH_EXEMPT_SOURCES: ReadonlySet<string> = new Set(
  Object.keys(REFERRAL_FAMILY_EXEMPT),
)

function isPassthroughExempt(source: string): boolean {
  return PASSTHROUGH_EXEMPT_SOURCES.has(source)
}

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
  if (!Number.isInteger(signupId) || signupId <= 0) {
    throw new Error('invalid_waitlist_point_signup_id')
  }
  const normalizedAmount = Number(amount)
  if (
    !Number.isFinite(normalizedAmount) ||
    normalizedAmount < 0 ||
    normalizedAmount > MAX_AWARD_AMOUNT
  ) {
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
  const didInsert = Boolean(inserted?.rows?.[0]?.id)

  // Mirror a fraction to the referrer (best-effort; never blocks the
  // referee's award). See `recordReferralPassthrough` for the guarantees.
  if (didInsert) {
    try {
      await recordReferralPassthrough({
        db,
        refereeSignupId: signupId,
        originalSource: normalizedSource,
        originalSourceId: normalizedSourceId,
        amount: Math.trunc(normalizedAmount),
      })
    } catch (err) {
      // Never block the referee's award. But don't swallow silently —
      // a persistent failure here drains the referral economy, so
      // surface it in logs with enough structure to alert on.
      console.warn('waitlist_points.passthrough_failed', {
        refereeSignupId: signupId,
        source: normalizedSource,
        message: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return didInsert
}

/** Build a collision-safe `source_id` for a passthrough row. If the natural
 *  composite key fits in the column, use it verbatim. Otherwise keep a
 *  readable prefix and append a sha256 suffix so two distinct awards can't
 *  accidentally dedupe to the same row under `ON CONFLICT DO NOTHING`. */
export function buildPassthroughSourceKey(
  refereeSignupId: number,
  originalSource: string,
  originalSourceId: string | null,
): string {
  const raw = `${refereeSignupId}:${originalSource}:${originalSourceId ?? ''}`
  if (raw.length <= MAX_SOURCE_KEY_LEN) return raw
  // Hash suffix is 64 hex chars; leave room for a prefix + separator.
  const hash = createHash('sha256').update(raw).digest('hex')
  const prefix = raw.slice(0, MAX_SOURCE_KEY_LEN - 1 - hash.length)
  return `${prefix}#${hash}`
}

/**
 * Credit a referrer with 50% of the points a referee just earned.
 *
 * Reads `profiles.referred_by_signup_id` to find the referrer; writes a
 * single `referral_passthrough` row whose `source_id` uniquely encodes
 * the triggering award via `buildPassthroughSourceKey`. Idempotent via
 * `ON CONFLICT DO NOTHING` on the `points` unique index.
 *
 * Safety rails (all enforced, not advisory):
 *   - No-ops when `refereeSignupId` is not a positive integer.
 *   - No-ops when `amount <= 0` (insert floors to 0 and isn't worth a row).
 *   - No-ops when `amount > MAX_AWARD_AMOUNT` (treats it as caller bug).
 *   - No-ops when `originalSource` is a referral-family source
 *     (`referral_passthrough`, `referral_signup`, etc., enforced by the
 *     compile-time exhaustive `REFERRAL_FAMILY_EXEMPT` map) — prevents
 *     pyramids / cascades beyond one hop.
 *   - No-ops when `referrerId` is not a positive integer, which also
 *     covers the no-referrer and self-referral edges.
 *   - Source key is collision-safe: natural composite if it fits, else
 *     prefix + sha256 suffix. Plain `slice()` is forbidden here because
 *     two distinct awards could dedupe to the same row.
 *
 * This is the only code path that writes `referral_passthrough` rows.
 * The scoring query treats them at weight 1.00× since the halving
 * already happened here at insert time.
 *
 * Reciprocal referrals (A refers B, B refers A) are ALLOWED by design:
 * each direction pays out independently on the other's organic earns,
 * but never on the other's `referral_passthrough` rows (exempt above),
 * so there is no compounding. If product wants to block reciprocals,
 * the hook point is at referral-code claim time, not here.
 */
export async function recordReferralPassthrough(params: {
  db: Db
  refereeSignupId: number
  originalSource: string
  originalSourceId: string | null
  amount: number
}): Promise<boolean> {
  const { db, refereeSignupId, originalSource, originalSourceId } = params

  if (!Number.isInteger(refereeSignupId) || refereeSignupId <= 0) return false
  if (isPassthroughExempt(originalSource)) return false

  const baseAmount = Number(params.amount)
  if (!Number.isFinite(baseAmount) || baseAmount <= 0) return false
  if (baseAmount > MAX_AWARD_AMOUNT) return false

  const passthroughAmount = Math.floor(baseAmount * REFERRAL_PASSTHROUGH_FRACTION)
  if (passthroughAmount <= 0) return false

  // Find the referrer for this referee (if any).
  const referrerResult = await db.sql`
    SELECT referred_by_signup_id
    FROM profiles
    WHERE id = ${refereeSignupId}
    LIMIT 1;
  `
  const referrerRaw = referrerResult?.rows?.[0]?.referred_by_signup_id
  const referrerId = typeof referrerRaw === 'number' ? referrerRaw : Number(referrerRaw)
  if (!Number.isInteger(referrerId) || referrerId <= 0 || referrerId === refereeSignupId) {
    return false
  }

  const sourceKey = buildPassthroughSourceKey(refereeSignupId, originalSource, originalSourceId)

  const inserted = await db.sql`
    INSERT INTO points (signup_id, source, source_id, amount, created_at)
    VALUES (${referrerId}, 'referral_passthrough', ${sourceKey}, ${passthroughAmount}, NOW())
    ON CONFLICT DO NOTHING
    RETURNING id;
  `
  return Boolean(inserted?.rows?.[0]?.id)
}
