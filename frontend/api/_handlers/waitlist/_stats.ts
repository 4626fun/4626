import {
  type ApiEnvelope,
  RATE_LIMITS,
  checkDurableRateLimit,
  getClientIp,
  handleOptions,
  setCors,
  setNoStore,
  getDb,
  rateLimitKey,
} from '@4626/server-core'

import {
  getWaitlistMemberCount,
  getWaitlistLeaderboardData,
} from '../../../server/_lib/onboarding/waitlistLeaderboard.js'
import { ensureWaitlistSchema } from '../../../server/_lib/onboarding/waitlistSchema.js'
import { withChartQuery } from '../../../server/_lib/db/withChartQuery.js'

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

// Read a larger leaderboard slice so the top-points lane can still surface enough
// PFPs even when some high-rank users have no avatar configured.
const TOP_POINTS_PROFILE_SCAN = 300
const AVATAR_FETCH_LIMIT = 12
const DEFAULT_IPFS_GATEWAY = 'https://ipfs.decentralized-content.com/ipfs/'
const DEFAULT_ARWEAVE_GATEWAY = 'https://arweave.net/'
/** In-process TTL — keeps warm serverless instances from re-hitting DB every poll. */
const STATS_CACHE_TTL_MS = 60_000

type StatsCacheEntry = {
  expiresAt: number
  data: WaitlistStatsResponse
}

let statsCache: StatsCacheEntry | null = null

function wantsFreshStats(req: { query?: Record<string, unknown> }): boolean {
  const raw = String(req.query?.fresh ?? req.query?.nocache ?? '').trim().toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes'
}

function toIpfsPath(raw: string): string {
  const value = String(raw || '').trim()
  if (!value) return ''
  if (value.startsWith('ipfs://')) {
    const noProto = value.slice('ipfs://'.length)
    return noProto.replace(/^ipfs\//, '').replace(/^\/+/, '')
  }
  return value.startsWith('Qm') || value.startsWith('bafy') ? value : ''
}

function normalizeAvatarSource(raw: unknown): string | null {
  const value = typeof raw === 'string' ? raw.trim() : ''
  if (!value) return null
  if (value.startsWith('//')) return `https:${value}`
  if (value.startsWith('ipfs://')) {
    const path = toIpfsPath(value)
    return path ? `${DEFAULT_IPFS_GATEWAY}${path}` : null
  }
  if (value.startsWith('ar://')) {
    const id = value.slice('ar://'.length).replace(/^\/+/, '')
    return id ? `${DEFAULT_ARWEAVE_GATEWAY}${id}` : null
  }
  if (value.startsWith('data:image/')) return value
  return /^https?:\/\//i.test(value) ? value : null
}

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
      limit: TOP_POINTS_PROFILE_SCAN,
      pointsType: 'total',
      authorizedProfileId: null,
    })
    const topRows = Array.isArray(data?.leaderboard) ? data.leaderboard.slice(0, AVATAR_FETCH_LIMIT) : []
    return topRows
      .map((row) => {
        const src = normalizeAvatarSource(row.avatarUrl)
        if (!src) return null
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

async function fetchSocialProofAvatars(db: any): Promise<WaitlistAvatar[]> {
  // Public social proof is restricted to identities users have already
  // published through the public leaderboard. Never fall back to recent
  // verified-email signups.
  return (await fetchTopMemberAvatarsByPoints(db)).slice(0, AVATAR_FETCH_LIMIT)
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
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    setNoStore(res)
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const limiter = await checkDurableRateLimit(
    rateLimitKey('waitlist:stats', getClientIp(req)),
    RATE_LIMITS.general,
    { failClosed: false },
  )
  if (!limiter.allowed) {
    setNoStore(res)
    res.setHeader('Retry-After', Math.ceil((limiter.resetAt - Date.now()) / 1000).toString())
    return res.status(429).json({ success: false, error: 'Too many requests' } satisfies ApiEnvelope<never>)
  }

  const fresh = wantsFreshStats(req)
  const now = Date.now()
  if (!fresh && statsCache && statsCache.expiresAt > now) {
    // Short CDN TTL so the dock count can move within a minute of new signups.
    res.setHeader('Cache-Control', 'public, max-age=15, stale-while-revalidate=45')
    return res.status(200).json({ success: true, data: statsCache.data } satisfies ApiEnvelope<WaitlistStatsResponse>)
  }

  try {
    const rawDb = await getDb()
    if (!rawDb) {
      setNoStore(res)
      if (shouldFailOpenForStats() || shouldFailOpenForDryRun()) {
        return res.status(200).json({ success: true, data: emptyStats() } satisfies ApiEnvelope<WaitlistStatsResponse>)
      }
      return res.status(500).json({ success: false, error: 'DB unavailable' } satisfies ApiEnvelope<never>)
    }

    const db = withChartQuery(rawDb, 'waitlist-social-proof')
    await ensureWaitlistSchema(db as any)

    const signedUpCount = await getWaitlistMemberCount(db as any)
    const capacity = resolveCapacity(signedUpCount)
    const spotsRemaining = Math.max(0, capacity - signedUpCount)
    const avatars = await fetchSocialProofAvatars(db)

    const data: WaitlistStatsResponse = {
      signedUpCount,
      capacity,
      spotsRemaining,
      avatars,
    }
    statsCache = { expiresAt: now + STATS_CACHE_TTL_MS, data }
    if (fresh) {
      setNoStore(res)
    } else {
      res.setHeader('Cache-Control', 'public, max-age=15, stale-while-revalidate=45')
    }

    return res.status(200).json({ success: true, data } satisfies ApiEnvelope<WaitlistStatsResponse>)
  } catch (error) {
    setNoStore(res)
    if (shouldFailOpenForStats() || shouldFailOpenForDryRun()) {
      return res.status(200).json({ success: true, data: emptyStats() } satisfies ApiEnvelope<WaitlistStatsResponse>)
    }
    const message = error instanceof Error && error.message ? error.message : 'waitlist_stats_failed'
    return res.status(500).json({ success: false, error: message } satisfies ApiEnvelope<never>)
  }
}
