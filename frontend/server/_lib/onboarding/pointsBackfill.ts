/**
 * One-shot points regeneration logic for `POST /api/admin/waitlist/regenerate-points`.
 *
 * Two phases, both strictly append-only and idempotent:
 *
 *   1. Top-up deltas. For `points` rows whose `source` is in the canonical
 *      value map below and whose stored `amount` is below the current value,
 *      insert a new row with `source_id = 'topup:<original_row_id>'` and
 *      `amount = delta`. This leaves history intact and relies on the
 *      `points_unique_source_full` unique index for idempotency.
 *
 *   2. Passthrough backfill. For every non-exempt `points` row whose referee
 *      has a `profiles.referred_by_signup_id`, call `recordReferralPassthrough`
 *      to ensure a matching `referral_passthrough` row exists. The helper is
 *      itself idempotent (`ON CONFLICT DO NOTHING`).
 *
 * Never touches existing rows. Never deletes. Never rewrites amounts.
 * Can be rerun safely after partial failures.
 *
 * The canonical value map must be kept in lockstep with:
 *   - `WAITLIST_POINTS` in `waitlistPoints.ts`
 *   - `LINK_POINTS` in `accountsIdentity.ts`
 *   - `AMOE_CHECKIN_POINTS` in `amoeWaitlistPoints.ts`
 */

import { applyPointEvent } from '../identity/accountsIdentity.js'
import { awardWaitlistPoints, recordReferralPassthrough, WAITLIST_POINTS } from './waitlistPoints.js'

type Db = { sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }> }

/**
 * Authoritative "what each source SHOULD award today" map. Sources not listed
 * here are explicitly excluded from top-up (see `EXCLUDED_FROM_TOPUP` below).
 *
 * All values are even integers by convention — keeps referral passthrough
 * (`floor(amount × 0.5)`) exact. If you bump a value here, update the
 * corresponding registry (`WAITLIST_POINTS` / `LINK_POINTS` / AMOE) to match.
 */
export const CANONICAL_POINT_VALUES: Readonly<Record<string, number>> = {
  // WAITLIST_POINTS (waitlistPoints.ts)
  waitlist_signup: 5,
  csw_link: 50,
  social_base_app: 2,
  social_zora: 2,
  social_x: 2,
  social_discord: 2,
  social_telegram: 2,
  bonus_github: 1,
  bonus_tiktok: 1,
  bonus_instagram: 1,
  bonus_reddit: 1,
  agent_feedback: 1,
  agent_reputation: 8,
  lens_identity: 3,
  grove_proof: 2,

  // LINK_POINTS (accountsIdentity.ts). `source` equals the `eventType` string
  // written by `applyPointEvent`, which is `toEventType(provider)`.
  link_email: 10,
  link_google: 20,
  link_apple: 20,
  link_external_eoa: 10,
  link_twitter: 16,
  link_telegram: 16,
  link_tiktok: 16,
  link_zora: 40,

  // AMOE (amoeWaitlistPoints.ts)
  amoe_checkin: 6,
}

/** Documentation-only: sources intentionally NOT in the top-up map, with
 *  rationale. Keep in sync with the set above. */
export const EXCLUDED_FROM_TOPUP: Readonly<Record<string, string>> = {
  referral_passthrough: 'halved at write time; never topped up',
  referral_signup: 'deprecated legacy source; new awards use referral_passthrough',
  referral_csw_link: 'deprecated legacy source; new awards use referral_passthrough',
  referral_qualified: 'deprecated legacy source; new awards use referral_passthrough',
  task: 'variable per-task amount; no canonical current value',
  resolve_csw: 'milestone event, no canonical point value documented yet',
  has_creator_coin: 'milestone event, no canonical point value documented yet',
  amoe_twitter_daily: 'legacy AMOE source; amounts varied, not safe to top up',
  amoe_entry_spend: 'variable per-entry amount tied to lottery credit spend',
  amoe_entry: 'deprecated — per-submission entry points were removed',
}

/** Exempt set for passthrough backfill. Mirrors `REFERRAL_FAMILY_EXEMPT` in
 *  waitlistPoints.ts — keep in sync. */
export const PASSTHROUGH_EXEMPT_SOURCES: readonly string[] = [
  'referral_passthrough',
  'referral_signup',
  'referral_csw_link',
  'referral_qualified',
]

/** Cap the rows scanned/written per phase. Prevents runaway scans. */
const DEFAULT_MAX_ROWS = 50_000

export type TopupCandidate = {
  originalRowId: number
  signupId: number
  source: string
  currentAmount: number
  targetAmount: number
  delta: number
}

export type PassthroughCandidate = {
  refereeRowId: number
  refereeSignupId: number
  referrerSignupId: number
  source: string
  sourceId: string | null
  amount: number
}

export type MissingBaselineCandidate = {
  signupId: number
}

export type MissingLinkEmailCandidate = {
  signupId: number
  privyUserId: string
  email: string
}

export type BackfillPlan = {
  topups: TopupCandidate[]
  passthroughs: PassthroughCandidate[]
  /** Profiles missing a `waitlist_signup` row entirely. Synthesized via the
   *  same `awardWaitlistPoints` helper the live bootstrap uses. */
  missingBaselines: MissingBaselineCandidate[]
  /** Profiles with a verified email (email + privy_user_id populated) that
   *  are missing their `link_email` award. Synthesized via the same
   *  `applyPointEvent` helper the live email-link writer uses, so passthrough
   *  and eligibility gates stay identical. */
  missingLinkEmails: MissingLinkEmailCandidate[]
  /** Sources observed in the `points` table that are NOT in the canonical
   *  map (and not explicitly excluded). Operators should review this list. */
  unknownSourcesObserved: string[]
  /** Per-source top-up summary for quick review. */
  topupsBySource: Record<string, { count: number; totalDelta: number }>
}

export type BackfillResult = {
  topupsInserted: number
  passthroughsInserted: number
  baselinesInserted: number
  linkEmailsInserted: number
  /** Rows the helper chose not to write (no referrer, self-ref, exempt, or
   *  already exists — all safe no-ops). */
  passthroughsSkipped: number
}

function toInteger(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : null
}

/**
 * Pre-flight: compute what the endpoint *would* do without writing anything.
 * Safe to call at any time; reads only.
 */
export async function planPointsBackfill(
  db: Db,
  options: { limit?: number } = {},
): Promise<BackfillPlan> {
  const limit = Math.max(1, Math.min(options.limit ?? DEFAULT_MAX_ROWS, DEFAULT_MAX_ROWS))

  // Phase A — top-up candidates, per known source. We issue one query per
  // source so that every `${}` interpolation stays a parameterized scalar,
  // matching the `db.sql` tagged-template contract used elsewhere in this
  // codebase. No dynamic SQL fragments.
  const topups: TopupCandidate[] = []
  const topupsBySource: Record<string, { count: number; totalDelta: number }> = {}

  for (const source of Object.keys(CANONICAL_POINT_VALUES)) {
    if (topups.length >= limit) break
    const target = CANONICAL_POINT_VALUES[source] ?? 0
    const remaining = limit - topups.length
    const rows = await db.sql`
      SELECT p.id, p.signup_id, p.amount
      FROM points p
      WHERE p.source = ${source}
        AND p.amount < ${target}
        AND (p.source_id IS NULL OR p.source_id NOT LIKE 'topup:%')
        AND NOT EXISTS (
          SELECT 1 FROM points t
          WHERE t.signup_id = p.signup_id
            AND t.source = p.source
            AND t.source_id = 'topup:' || p.id::text
        )
      ORDER BY p.id ASC
      LIMIT ${remaining};
    `
    for (const row of rows.rows ?? []) {
      const id = toInteger(row.id)
      const sid = toInteger(row.signup_id)
      const amount = toInteger(row.amount) ?? 0
      if (id === null || sid === null || target <= amount) continue
      const delta = target - amount
      topups.push({
        originalRowId: id,
        signupId: sid,
        source,
        currentAmount: amount,
        targetAmount: target,
        delta,
      })
      const bucket = topupsBySource[source] ?? { count: 0, totalDelta: 0 }
      bucket.count += 1
      bucket.totalDelta += delta
      topupsBySource[source] = bucket
    }
  }

  // Phase B — passthrough candidates. One query, using `<> ALL($exempt)` so
  // the exempt list stays parameterized. The NOT EXISTS predicate reproduces
  // `buildPassthroughSourceKey` ONLY for the short-composite path (natural
  // key ≤ 256 chars). For the rare long-composite case we let the row into
  // the plan anyway and rely on `recordReferralPassthrough`'s own
  // `ON CONFLICT DO NOTHING` to absorb the no-op on reruns. A small
  // overcount in the dry-run is an acceptable trade for correctness.
  const exemptArray = [...PASSTHROUGH_EXEMPT_SOURCES]
  const passthroughRows = await db.sql`
    SELECT
      p.id,
      p.signup_id AS referee_signup_id,
      prof.referred_by_signup_id AS referrer_signup_id,
      p.source,
      p.source_id,
      p.amount
    FROM points p
    JOIN profiles prof ON prof.id = p.signup_id
    WHERE p.source <> ALL(${exemptArray})
      AND prof.referred_by_signup_id IS NOT NULL
      AND prof.referred_by_signup_id <> p.signup_id
      AND p.amount > 0
      AND (
        LENGTH(p.signup_id::text || ':' || p.source || ':' || COALESCE(p.source_id, '')) > 256
        OR NOT EXISTS (
          SELECT 1 FROM points pt
          WHERE pt.signup_id = prof.referred_by_signup_id
            AND pt.source = 'referral_passthrough'
            AND pt.source_id = (p.signup_id::text || ':' || p.source || ':' || COALESCE(p.source_id, ''))
        )
      )
    ORDER BY p.id ASC
    LIMIT ${limit};
  `

  const passthroughs: PassthroughCandidate[] = []
  for (const row of passthroughRows.rows ?? []) {
    const rid = toInteger(row.id)
    const referee = toInteger(row.referee_signup_id)
    const referrer = toInteger(row.referrer_signup_id)
    const source = typeof row.source === 'string' ? row.source : ''
    const amount = toInteger(row.amount) ?? 0
    if (rid === null || referee === null || referrer === null || !source || amount <= 0) continue
    passthroughs.push({
      refereeRowId: rid,
      refereeSignupId: referee,
      referrerSignupId: referrer,
      source,
      sourceId: typeof row.source_id === 'string' ? row.source_id : null,
      amount,
    })
  }

  // Phase C — missing baseline `waitlist_signup` rows. Every profile should
  // have exactly one such row; historically the writer wasn't wired, so this
  // reconciles the gap. Synthesized through `awardWaitlistPoints` so it goes
  // through the same idempotency and passthrough path as a live signup.
  const missingBaselineRows = await db.sql`
    SELECT p.id AS signup_id
    FROM profiles p
    WHERE NOT EXISTS (
      SELECT 1 FROM points pt
      WHERE pt.signup_id = p.id AND pt.source = 'waitlist_signup'
    )
    ORDER BY p.id ASC
    LIMIT ${limit};
  `
  const missingBaselines: MissingBaselineCandidate[] = (missingBaselineRows.rows ?? [])
    .map((row): MissingBaselineCandidate | null => {
      const id = toInteger(row.signup_id)
      return id === null ? null : { signupId: id }
    })
    .filter((x): x is MissingBaselineCandidate => x !== null)

  // Phase D — missing `link_email` awards. Only eligible when the profile
  // is Privy-verified (privy_user_id present), because the live writer
  // (`syncEmailIdentity` in accountsIdentity.ts) only fires after Privy
  // confirms the email. Profiles that have `profiles.email` populated
  // WITHOUT a privy_user_id are pre-Privy waitlist entries and must NOT be
  // synthesized — the email has not been verified.
  const missingLinkEmailRows = await db.sql`
    SELECT p.id AS signup_id, p.privy_user_id, p.email
    FROM profiles p
    WHERE p.email IS NOT NULL
      AND p.email <> ''
      AND p.privy_user_id IS NOT NULL
      AND p.privy_user_id <> ''
      AND NOT EXISTS (
        SELECT 1 FROM points pt
        WHERE pt.signup_id = p.id AND pt.source = 'link_email'
      )
    ORDER BY p.id ASC
    LIMIT ${limit};
  `
  const missingLinkEmails: MissingLinkEmailCandidate[] = (missingLinkEmailRows.rows ?? [])
    .map((row): MissingLinkEmailCandidate | null => {
      const id = toInteger(row.signup_id)
      const privy = typeof row.privy_user_id === 'string' ? row.privy_user_id.trim() : ''
      const email = typeof row.email === 'string' ? row.email.trim().toLowerCase() : ''
      if (id === null || !privy || !email) return null
      return { signupId: id, privyUserId: privy, email }
    })
    .filter((x): x is MissingLinkEmailCandidate => x !== null)

  // Observability — surface sources we don't know about so operators can
  // decide whether to expand the canonical map before a future re-run.
  const knownSources = new Set([
    ...Object.keys(CANONICAL_POINT_VALUES),
    ...Object.keys(EXCLUDED_FROM_TOPUP),
  ])
  const observed = await db.sql`
    SELECT DISTINCT source FROM points LIMIT 200;
  `
  const unknownSourcesObserved = (observed.rows ?? [])
    .map((row) => (typeof row.source === 'string' ? row.source : ''))
    .filter((s): s is string => Boolean(s) && !knownSources.has(s))

  return {
    topups,
    passthroughs,
    missingBaselines,
    missingLinkEmails,
    unknownSourcesObserved,
    topupsBySource,
  }
}

/** Insert Phase A top-up rows. Double-idempotent: the `NOT EXISTS` in the
 *  plan skips already-topped rows, and `ON CONFLICT DO NOTHING` catches races. */
export async function applyTopups(db: Db, plan: TopupCandidate[]): Promise<number> {
  let inserted = 0
  for (const candidate of plan) {
    const sourceId = `topup:${candidate.originalRowId}`
    const result = await db.sql`
      INSERT INTO points (signup_id, source, source_id, amount, created_at)
      VALUES (${candidate.signupId}, ${candidate.source}, ${sourceId}, ${candidate.delta}, NOW())
      ON CONFLICT DO NOTHING
      RETURNING id;
    `
    if (Array.isArray(result.rows) && result.rows.length > 0) inserted += 1
  }
  return inserted
}

/** Mirror missing passthrough rows via the canonical helper. */
export async function applyPassthroughs(
  db: Db,
  plan: PassthroughCandidate[],
): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0
  let skipped = 0
  for (const c of plan) {
    const ok = await recordReferralPassthrough({
      db,
      refereeSignupId: c.refereeSignupId,
      originalSource: c.source,
      originalSourceId: c.sourceId,
      amount: c.amount,
    })
    if (ok) inserted += 1
    else skipped += 1
  }
  return { inserted, skipped }
}

/** Synthesize missing `waitlist_signup` rows via the canonical award helper.
 *  Each call flows through `awardWaitlistPoints`, which is idempotent and
 *  fires its own passthrough mirror, so running this multiple times is safe. */
export async function applyMissingBaselines(
  db: Db,
  plan: MissingBaselineCandidate[],
): Promise<number> {
  let inserted = 0
  for (const c of plan) {
    const ok = await awardWaitlistPoints({
      db,
      signupId: c.signupId,
      source: 'waitlist_signup',
      sourceId: 'signup',
      amount: WAITLIST_POINTS.signup,
    })
    if (ok) inserted += 1
  }
  return inserted
}

/** Canonical per-award value for `link_email`. Pinned here rather than
 *  imported from accountsIdentity.ts (where `LINK_POINTS` is private) so
 *  the backfill has a single source of truth. If the live writer ever
 *  bumps this, update here AND in `CANONICAL_POINT_VALUES` above. */
const LINK_EMAIL_POINTS = CANONICAL_POINT_VALUES.link_email

/** Synthesize missing `link_email` awards for Privy-verified profiles.
 *  Uses the same `applyPointEvent` helper the live writer uses — same
 *  canonical profile resolution, same passthrough mirror, same idempotency
 *  via `ON CONFLICT DO NOTHING` on (signup_id, source, source_id). */
export async function applyMissingLinkEmails(
  db: Db,
  plan: MissingLinkEmailCandidate[],
): Promise<number> {
  let inserted = 0
  for (const c of plan) {
    const result = await applyPointEvent({
      db,
      privyUserId: c.privyUserId,
      eventType: 'link_email',
      eventKey: `link_email:${c.email}`,
      points: LINK_EMAIL_POINTS,
    })
    if (result.awarded) inserted += 1
  }
  return inserted
}

/** Run all three phases. Phase A writes top-ups, Phase B mirrors passthroughs
 *  (both for original rows and for the newly-written top-up deltas), Phase C
 *  synthesizes missing baseline `waitlist_signup` rows. */
export async function executePointsBackfill(
  db: Db,
  plan: BackfillPlan,
): Promise<BackfillResult> {
  const topupsInserted = await applyTopups(db, plan.topups)
  // Each top-up needs its own passthrough fired against the delta amount.
  // The helper handles no-op cases (no referrer, etc.) without throwing.
  const topupPassthroughs: PassthroughCandidate[] = plan.topups.map((t) => ({
    refereeRowId: t.originalRowId,
    refereeSignupId: t.signupId,
    referrerSignupId: 0,
    source: t.source,
    sourceId: `topup:${t.originalRowId}`,
    amount: t.delta,
  }))
  const phaseB = await applyPassthroughs(db, plan.passthroughs)
  const phaseC = await applyPassthroughs(db, topupPassthroughs)
  const baselinesInserted = await applyMissingBaselines(db, plan.missingBaselines)
  const linkEmailsInserted = await applyMissingLinkEmails(db, plan.missingLinkEmails)
  return {
    topupsInserted,
    passthroughsInserted: phaseB.inserted + phaseC.inserted,
    passthroughsSkipped: phaseB.skipped + phaseC.skipped,
    baselinesInserted,
    linkEmailsInserted,
  }
}
