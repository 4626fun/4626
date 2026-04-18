import { ensureWaitlistSchema } from '../onboarding/waitlistSchema.js'

/**
 * AMOE ↔ waitlist points bridge.
 *
 * The AMOE lottery already tracks an off-chain credit pool per wallet (daily
 * Twitter check-in adds credits, entry submission spends credits). Those
 * rows live in the `points` table against a *wallet-synthetic* profile so
 * the credit math can ignore whether the wallet is linked to a real user.
 *
 * This module layers a second, additive award on top: when a wallet that
 * IS linked to a Privy user submits an entry or claims a check-in, we
 * also credit the user's *canonical waitlist profile* so the activity
 * counts toward their tier progression and leaderboard rank. The two
 * bookkeeping paths are intentionally decoupled:
 *
 *   - `amoe_entry_spend` / `amoe_twitter_daily` → wallet-synthetic profile.
 *     Used only by `consumeAmoeCreditsForEntry` / check-in math. NEVER
 *     surfaced as "waitlist points".
 *
 *   - `amoe_entry` / `amoe_checkin`              → canonical Privy profile.
 *     Drives the `/api/waitlist/me` score, tier progress bar, and
 *     leaderboard rows. Idempotent via `(source, source_id)` unique key.
 *
 * Award helpers silently no-op when the wallet isn't yet linked to a
 * Privy profile (lots of AMOE check-ins happen before a user joins the
 * waitlist). That keeps the lottery path usable by anonymous signers
 * without forcing an onboarding step.
 */

type Db = {
  sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<{ rows: any[] }>
}

export const AMOE_ENTRY_POINTS = 10
export const AMOE_CHECKIN_POINTS = 5
/** Max `amoe_entry` awards credited to a single profile per UTC day. */
export const AMOE_ENTRY_DAILY_CAP = 5

export const AMOE_ENTRY_SOURCE = 'amoe_entry' as const
export const AMOE_CHECKIN_SOURCE = 'amoe_checkin' as const

export type AmoeWaitlistAwardResult = {
  awarded: boolean
  /** `null` when the wallet isn't linked to a Privy-backed waitlist profile. */
  profileId: number | null
  /** Non-null only on cap-limited paths; undefined when unknown. */
  awardedToday?: number
}

function normalizeWallet(wallet: string): string {
  return wallet.trim().toLowerCase()
}

function normalizeKey(value: string): string {
  return value.trim().slice(0, 256)
}

/**
 * Resolve a canonical waitlist profile id for a wallet address, or `null`
 * when the wallet hasn't been linked via onboarding. Uses `profile_wallets`
 * so any linked wallet (canonical CSW, embedded EOA, or secondary EOA
 * owner) attributes back to the correct profile.
 */
export async function resolveWaitlistProfileIdForWallet(
  db: Db,
  wallet: string,
): Promise<number | null> {
  const address = normalizeWallet(wallet)
  if (!/^0x[a-f0-9]{40}$/.test(address)) return null

  const result = await db.sql`
    SELECT pw.profile_id
    FROM profile_wallets pw
    JOIN profiles p ON p.id = pw.profile_id
    WHERE LOWER(pw.address) = ${address}
      AND p.privy_user_id IS NOT NULL
    ORDER BY pw.is_canonical_smart_wallet DESC NULLS LAST, pw.is_primary DESC NULLS LAST, pw.profile_id ASC
    LIMIT 1;
  `
  const row = result.rows?.[0] ?? null
  const raw = row?.profile_id
  const id = typeof raw === 'number' ? raw : Number(raw)
  return Number.isFinite(id) && id > 0 ? Math.floor(id) : null
}

/**
 * Award `amoe_entry` points to the profile that owns `wallet`, idempotent
 * per (creatorCoin, nonce) and capped to `AMOE_ENTRY_DAILY_CAP` credited
 * entries per UTC day per profile. Rows beyond the cap still succeed on
 * the AMOE side (the wallet-synthetic credit spend is independent) — they
 * just don't grow the waitlist score further that day.
 */
export async function awardAmoeEntryPoints(params: {
  db: Db
  wallet: string
  creatorCoin: string
  nonce: string
}): Promise<AmoeWaitlistAwardResult> {
  const { db, wallet, creatorCoin, nonce } = params
  const profileId = await resolveWaitlistProfileIdForWallet(db, wallet)
  if (profileId === null) return { awarded: false, profileId: null }

  await ensureWaitlistSchema(db)

  const eventKey = normalizeKey(`${creatorCoin.toLowerCase()}:${nonce.toLowerCase()}`)
  if (!eventKey) return { awarded: false, profileId }

  // Count today's (UTC) awards for this profile so we can respect the
  // daily cap without adding a new table. `amount > 0` filters out the
  // `amoe_entry_spend` rows which could also live against the same
  // profile id when the wallet is the canonical profile's own wallet.
  const todayResult = await db.sql`
    SELECT COUNT(*)::INT AS awarded_today
    FROM points
    WHERE signup_id = ${profileId}
      AND source = ${AMOE_ENTRY_SOURCE}
      AND amount > 0
      AND created_at >= (now() AT TIME ZONE 'UTC')::date;
  `
  const awardedTodayRaw = Number(todayResult.rows?.[0]?.awarded_today ?? 0)
  const awardedToday = Number.isFinite(awardedTodayRaw) ? Math.max(0, awardedTodayRaw) : 0
  if (awardedToday >= AMOE_ENTRY_DAILY_CAP) {
    return { awarded: false, profileId, awardedToday }
  }

  const inserted = await db.sql`
    INSERT INTO points (signup_id, source, source_id, amount, created_at)
    VALUES (${profileId}, ${AMOE_ENTRY_SOURCE}, ${eventKey}, ${AMOE_ENTRY_POINTS}, NOW())
    ON CONFLICT DO NOTHING
    RETURNING id;
  `
  const awarded = Array.isArray(inserted.rows) && inserted.rows.length > 0
  return { awarded, profileId, awardedToday: awardedToday + (awarded ? 1 : 0) }
}

/**
 * Award `amoe_checkin` points to the profile that owns `wallet`, idempotent
 * per (wallet, dayKey). No explicit cap: the AMOE daily check-in itself is
 * already 1-per-day per wallet, so the natural ceiling is
 * `AMOE_CHECKIN_POINTS` per profile per day.
 */
export async function awardAmoeCheckinPoints(params: {
  db: Db
  wallet: string
  dayKey: string
}): Promise<AmoeWaitlistAwardResult> {
  const { db, wallet, dayKey } = params
  const profileId = await resolveWaitlistProfileIdForWallet(db, wallet)
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
  return { awarded, profileId }
}
