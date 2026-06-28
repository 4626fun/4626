import {
  type ApiEnvelope,
  handleOptions,
  setCors,
  setNoStore,
  getDb,
} from '@4626/server-core'

import { ensureWaitlistSchema } from '../../../server/_lib/onboarding/waitlistSchema.js'

type WaitlistStatsResponse = {
  signedUpCount: number
  capacity: number
  spotsRemaining: number
  /** A few recent member profile pictures (Zora/basename), for social-proof avatar stacks. */
  avatars: string[]
}

function emptyStats(): WaitlistStatsResponse {
  return {
    signedUpCount: 0,
    capacity: 0,
    spotsRemaining: 0,
    avatars: [],
  }
}

// How many recent profiles to scan for usable avatars, and how many to surface.
const RECENT_PROFILE_SCAN = 300
const AVATAR_FETCH_LIMIT = 6

/**
 * Recent waitlist members that have a real profile image. Mirrors the
 * leaderboard avatar resolution (Zora basename avatar → Zora avatar →
 * profile avatar → preprov Farcaster pfp) but exposes the image URL only —
 * no address, handle, or identity. Fails open (returns []) so a missing
 * `zora_profiles` table or transient error never breaks the count.
 */
async function fetchRecentMemberAvatars(db: any): Promise<string[]> {
  try {
    const result = await db.sql`
      WITH recent AS (
        SELECT
          p.id,
          COALESCE(
            NULLIF(TRIM(zp_av.basename_avatar), ''),
            NULLIF(TRIM(zp_av.avatar_image_url), ''),
            NULLIF(TRIM(p.avatar_url), ''),
            NULLIF(TRIM(p.preprov_farcaster_pfp), '')
          ) AS avatar_url
        FROM profiles p
        LEFT JOIN LATERAL (
          SELECT zp.basename_avatar, zp.avatar_image_url
          FROM zora_profiles zp
          WHERE (
            NULLIF(TRIM(p.primary_embedded_eoa), '') IS NOT NULL
            AND (
              lower(zp.privy_wallet_address) = lower(TRIM(p.primary_embedded_eoa))
              OR lower(zp.signing_eoa) = lower(TRIM(p.primary_embedded_eoa))
            )
          )
          OR (
            NULLIF(TRIM(p.primary_wallet), '') IS NOT NULL
            AND lower(zp.primary_wallet) = lower(TRIM(p.primary_wallet))
          )
          OR (
            NULLIF(TRIM(p.csw_address), '') IS NOT NULL
            AND lower(zp.smart_wallet_address) = lower(TRIM(p.csw_address))
          )
          ORDER BY zp.last_refreshed_at DESC NULLS LAST
          LIMIT 1
        ) zp_av ON true
        WHERE p.email IS NOT NULL
          AND p.merged_into_profile_id IS NULL
        ORDER BY p.id DESC
        LIMIT ${RECENT_PROFILE_SCAN}
      )
      SELECT avatar_url
      FROM recent
      WHERE avatar_url IS NOT NULL
      LIMIT ${AVATAR_FETCH_LIMIT};
    `
    const rows = Array.isArray(result?.rows) ? result.rows : []
    return rows
      .map((row: any) => (typeof row?.avatar_url === 'string' ? row.avatar_url.trim() : ''))
      .filter((url: string) => /^https?:\/\//i.test(url))
  } catch {
    return []
  }
}

function shouldFailOpenForStats(): boolean {
  // Keep dry-run behavior, and also avoid surfacing transient DB outages as 500s
  // on public waitlist urgency telemetry.
  return true
}

function shouldFailOpenForDryRun(): boolean {
  if (String(process.env.DEPLOY_DRY_RUN_PORT ?? '').trim()) return true
  const deploymentVersion = String(process.env.VITE_DEPLOYMENT_VERSION ?? '').toLowerCase()
  return deploymentVersion.includes('dryrun')
}

function parsePositiveInt(value: string | undefined): number | null {
  if (!value) return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  const normalized = Math.floor(parsed)
  return normalized > 0 ? normalized : null
}

function resolveCapacity(signedUpCount: number): number {
  const override = parsePositiveInt(process.env.WAITLIST_CAPACITY_OVERRIDE)
  if (override) return override

  const blockSize = parsePositiveInt(process.env.WAITLIST_CAPACITY_BLOCK_SIZE) ?? 100
  if (signedUpCount <= 0) return blockSize

  return Math.ceil(signedUpCount / blockSize) * blockSize
}

export default async function handler(req: any, res: any) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  try {
    const db = await getDb()
    if (!db) {
      if (shouldFailOpenForStats() || shouldFailOpenForDryRun()) {
        return res.status(200).json({ success: true, data: emptyStats() } satisfies ApiEnvelope<WaitlistStatsResponse>)
      }
      return res.status(500).json({ success: false, error: 'DB unavailable' } satisfies ApiEnvelope<never>)
    }

    await ensureWaitlistSchema(db as any)

    const countResult = await db.sql`
      SELECT COUNT(*)::int AS count
      FROM profiles
      WHERE email IS NOT NULL;
    `
    const signedUpCountRaw = Number(countResult?.rows?.[0]?.count ?? 0)
    const signedUpCount = Number.isFinite(signedUpCountRaw) ? Math.max(0, Math.floor(signedUpCountRaw)) : 0
    const capacity = resolveCapacity(signedUpCount)
    const spotsRemaining = Math.max(0, capacity - signedUpCount)
    const avatars = await fetchRecentMemberAvatars(db)

    const data: WaitlistStatsResponse = {
      signedUpCount,
      capacity,
      spotsRemaining,
      avatars,
    }

    return res.status(200).json({ success: true, data } satisfies ApiEnvelope<WaitlistStatsResponse>)
  } catch (error) {
    if (shouldFailOpenForStats() || shouldFailOpenForDryRun()) {
      return res.status(200).json({ success: true, data: emptyStats() } satisfies ApiEnvelope<WaitlistStatsResponse>)
    }
    const message = error instanceof Error && error.message ? error.message : 'waitlist_stats_failed'
    return res.status(500).json({ success: false, error: message } satisfies ApiEnvelope<never>)
  }
}
