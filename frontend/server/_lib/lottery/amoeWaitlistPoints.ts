import { ensureWaitlistSchema } from '../onboarding/waitlistSchema.js'
import { recordReferralPassthrough } from '../onboarding/waitlistPoints.js'
import { resolveAmoePointsProfileId } from './amoeProfileResolve.js'

/**
 * AMOE ↔ waitlist points bridge.
 *
 * Lottery credit rows (`amoe_twitter_daily`, `amoe_xmtp_daily`, `amoe_entry_spend`)
 * are resolved via `resolveAmoePointsProfile` in `amoeProfileResolve.ts`.
 *
 * This module adds a separate waitlist-facing award: when a linked wallet
 * completes an AMOE daily action, we also write `amoe_checkin` on the
 * canonical Privy profile so tier/leaderboard surfaces can count it.
 */

type Db = {
  sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }>
}

export const AMOE_CHECKIN_POINTS = 6
export const AMOE_CHECKIN_SOURCE = 'amoe_checkin' as const

export type AmoeWaitlistAwardResult = {
  awarded: boolean
  profileId: number | null
}

function normalizeWallet(wallet: string): string {
  return wallet.trim().toLowerCase()
}

function normalizeKey(value: string): string {
  return value.trim().slice(0, 256)
}

/** @deprecated Use `resolveAmoePointsProfile(..., 'privy_linked')` directly. */
export async function resolveWaitlistProfileIdForWallet(
  db: Db,
  wallet: string,
): Promise<number | null> {
  return resolveAmoePointsProfileId(db, wallet, 'privy_linked')
}

export async function awardAmoeCheckinPoints(params: {
  db: Db
  wallet: string
  dayKey: string
}): Promise<AmoeWaitlistAwardResult> {
  const { db, wallet, dayKey } = params
  const profileId = await resolveAmoePointsProfileId(db, wallet, 'privy_linked')
  if (profileId === null) return { awarded: false, profileId: null }

  await ensureWaitlistSchema(db)

  const eventKey = normalizeKey(`${normalizeWallet(wallet)}:${dayKey}`)
  if (!eventKey) return { awarded: false, profileId }

  const inserted = await db.sql`
    INSERT INTO points (signup_id, source, source_id, amount, created_at)
    VALUES (${profileId}, ${AMOE_CHECKIN_SOURCE}, ${eventKey}, ${AMOE_CHECKIN_POINTS}, NOW())
    ON CONFLICT DO NOTHING
    RETURNING id;
  `
  const awarded = Array.isArray(inserted.rows) && inserted.rows.length > 0
  if (awarded) {
    try {
      await recordReferralPassthrough({
        db,
        refereeSignupId: profileId,
        originalSource: AMOE_CHECKIN_SOURCE,
        originalSourceId: eventKey,
        amount: AMOE_CHECKIN_POINTS,
      })
    } catch (err) {
      console.warn('waitlist_points.passthrough_failed', {
        refereeSignupId: profileId,
        source: AMOE_CHECKIN_SOURCE,
        message: err instanceof Error ? err.message : String(err),
      })
    }
  }
  return { awarded, profileId }
}
