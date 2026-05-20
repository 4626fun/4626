/**
 * Canonical waitlist score from Supabase `public.points` (see `waitlistPoints.ts`).
 * Used by leaderboard, `/api/waitlist/position`, and referrer lookups.
 *
 * Not tied to Airtable — that sync is an optional ops mirror when configured.
 * AMOE lottery bookkeeping (`amoe_entry_spend`, `amoe_twitter_daily`, …) is
 * excluded from waitlist surfaces per `amoeWaitlistPoints.ts`; only `amoe_checkin`
 * counts toward waitlist rank when written on a canonical profile.
 */

export function safeInt(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? Math.floor(n) : 0
}

/** Weighted credits for one `points` row on waitlist surfaces. */
export function weightedWaitlistPoints(source: unknown, amount: unknown): number {
  const normalizedSource = String(source ?? '').trim()
  const normalizedAmount = safeInt(amount)

  if (
    normalizedSource === 'amoe_entry_spend' ||
    normalizedSource === 'amoe_twitter_daily' ||
    normalizedSource === 'amoe_xmtp_daily' ||
    normalizedSource === 'amoe_entry_refund'
  ) {
    return 0
  }

  if (
    normalizedSource === 'waitlist_signup' ||
    normalizedSource === 'referral_passthrough' ||
    normalizedSource === 'csw_link' ||
    normalizedSource === 'amoe_checkin'
  ) {
    return normalizedAmount
  }
  if (
    normalizedSource === 'referral_signup' ||
    normalizedSource === 'referral_csw_link' ||
    normalizedSource === 'referral_qualified'
  ) {
    return Math.round(normalizedAmount * 0.6)
  }
  if (normalizedSource.startsWith('social_')) return Math.round(normalizedAmount * 0.5)
  if (normalizedSource.startsWith('bonus_') || normalizedSource === 'task') return Math.round(normalizedAmount * 0.3)
  if (
    normalizedSource === 'agent_feedback' ||
    normalizedSource === 'agent_reputation' ||
    normalizedSource === 'lens_identity' ||
    normalizedSource === 'grove_proof'
  ) {
    return Math.round(normalizedAmount * 0.4)
  }
  if (
    normalizedSource === 'link_email' ||
    normalizedSource === 'link_google' ||
    normalizedSource === 'link_apple' ||
    normalizedSource === 'link_twitter' ||
    normalizedSource === 'link_telegram' ||
    normalizedSource === 'link_tiktok' ||
    normalizedSource === 'link_external_eoa' ||
    normalizedSource === 'link_zora' ||
    normalizedSource === 'resolve_csw' ||
    normalizedSource === 'has_creator_coin'
  ) {
    return Math.round(normalizedAmount * 0.6)
  }
  return 0
}

/** SQL `CASE` for `SUM(...)` over `points.source` / `points.amount`. Mirrors `weightedWaitlistPoints`. */
export const WAITLIST_POINTS_WEIGHT_CASE_SQL = `
  CASE
    WHEN source IN ('amoe_entry_spend', 'amoe_twitter_daily', 'amoe_xmtp_daily', 'amoe_entry_refund') THEN 0
    WHEN source IN ('waitlist_signup', 'referral_passthrough', 'csw_link', 'amoe_checkin') THEN amount * 1.00
    WHEN source IN ('referral_signup', 'referral_csw_link', 'referral_qualified') THEN amount * 0.60
    WHEN source LIKE 'social_%' THEN amount * 0.50
    WHEN source LIKE 'bonus_%' OR source = 'task' THEN amount * 0.30
    WHEN source IN ('agent_feedback', 'agent_reputation', 'lens_identity', 'grove_proof') THEN amount * 0.40
    WHEN source IN (
      'link_email', 'link_google', 'link_apple', 'link_twitter', 'link_telegram',
      'link_tiktok', 'link_external_eoa', 'link_zora', 'resolve_csw', 'has_creator_coin'
    ) THEN amount * 0.60
    ELSE 0
  END
`.trim()
