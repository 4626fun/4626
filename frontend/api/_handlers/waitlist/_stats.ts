import {
  type ApiEnvelope,
  handleOptions,
  setCors,
  setNoStore,
  getDb,
} from '@4626/server-core'

import {
  getWaitlistMemberCount,
  getWaitlistLeaderboardData,
} from '../../../server/_lib/onboarding/waitlistLeaderboard.js'
import { ensureWaitlistSchema } from '../../../server/_lib/onboarding/waitlistSchema.js'

/**
 * A recent member shown in the social-proof avatar stack. Exposes only the
 * profile image plus already-public identity (Zora handle / basename / short
 * canonical address) and a profile link — never the Privy embedded EOA.
 */
type WaitlistAvatar = {
  src: string
  /** Display name for hover (e.g. `@handle`, a basename, or a short address). */
  label: string | null
  /** Profile link target (Zora profile for handles, otherwise basescan). */
  href: string | null
}

type WaitlistStatsResponse = {
  signedUpCount: number
  capacity: number
  spotsRemaining: number
  /** A few recent member profile pictures (Zora/basename), for social-proof avatar stacks. */
  avatars: WaitlistAvatar[]
}

function emptyStats(): WaitlistStatsResponse {
  return {
    signedUpCount: 0,
    capacity: 0,
    spotsRemaining: 0,
    avatars: [],
  }
}

// Read a slightly larger leaderboard slice for resilience if some rows have no avatar.
const RECENT_PROFILE_SCAN = 300
const AVATAR_FETCH_LIMIT = 4

/**
 * Top waitlist members by points that also have profile images. Uses the same
 * point-ranking source as `/api/waitlist/leaderboard` and falls back to empty
 * avatars on transient failures.
 */
async function fetchTopMemberAvatarsByPoints(db: any): Promise<WaitlistAvatar[]> {
  try {
    const data = await getWaitlistLeaderboardData({
      db,
      page: 1,
      limit: RECENT_PROFILE_SCAN,
      pointsType: 'total',
      authorizedProfileId: null,
    })
    const topRows = Array.isArray(data?.leaderboard) ? data.leaderboard.slice(0, AVATAR_FETCH_LIMIT) : []
    return topRows
      .map((row) => {
        const src = typeof row.avatarUrl === 'string' ? row.avatarUrl.trim() : ''
        if (!/^https?:\/\//i.test(src)) return null
        const labelHint = typeof row.labelHint === 'string' ? row.labelHint.trim() : ''
        const label = labelHint.length > 0 ? labelHint : null
        const linkAddress = row.cswAddress ?? row.eoaAddress
        const href = linkAddress ? `https://basescan.org/address/${linkAddress}` : null
        return { src, label, href } satisfies WaitlistAvatar
      })
      .filter((avatar): avatar is WaitlistAvatar => avatar !== null)
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

    const signedUpCount = await getWaitlistMemberCount(db as any)
    const capacity = resolveCapacity(signedUpCount)
    const spotsRemaining = Math.max(0, capacity - signedUpCount)
    const avatars = await fetchTopMemberAvatarsByPoints(db)

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
