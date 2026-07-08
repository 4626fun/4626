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

// Read a larger leaderboard slice so the top-points lane can still surface enough
// PFPs even when some high-rank users have no avatar configured.
const TOP_POINTS_PROFILE_SCAN = 300
const RECENT_PROFILE_SCAN = 300
const AVATAR_FETCH_LIMIT = 12
const DEFAULT_IPFS_GATEWAY = 'https://ipfs.decentralized-content.com/ipfs/'
const DEFAULT_ARWEAVE_GATEWAY = 'https://arweave.net/'

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

async function fetchRecentMemberAvatars(db: any): Promise<WaitlistAvatar[]> {
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
          ) AS avatar_url,
          COALESCE(
            NULLIF(TRIM(zp_av.handle), ''),
            NULLIF(TRIM(p.preprov_zora_handle), '')
          ) AS handle,
          NULLIF(TRIM(zp_av.basename), '') AS basename,
          COALESCE(
            NULLIF(TRIM(p.csw_address), ''),
            NULLIF(TRIM(p.primary_wallet), '')
          ) AS link_address
        FROM profiles p
        LEFT JOIN LATERAL (
          SELECT zp.basename_avatar, zp.avatar_image_url, zp.handle, zp.basename
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
      SELECT avatar_url, handle, basename, link_address
      FROM recent
      WHERE avatar_url IS NOT NULL
      LIMIT ${AVATAR_FETCH_LIMIT};
    `
    const rows = Array.isArray(result?.rows) ? result.rows : []
    return rows
      .map((row) => {
        const src = normalizeAvatarSource(row?.avatar_url)
        if (!src) return null
        const handle = (typeof row?.handle === 'string' ? row.handle.trim() : '').replace(/^@/, '')
        const basename = typeof row?.basename === 'string' ? row.basename.trim() : ''
        const linkAddress = typeof row?.link_address === 'string' ? row.link_address.trim() : ''
        const label = handle ? `@${handle}` : basename || null
        const href = handle
          ? `https://zora.co/@${handle}`
          : linkAddress
            ? `https://basescan.org/address/${linkAddress}`
            : null
        return { src, label, href } satisfies WaitlistAvatar
      })
      .filter((avatar): avatar is WaitlistAvatar => avatar !== null)
  } catch {
    return []
  }
}

async function fetchSocialProofAvatars(db: any): Promise<WaitlistAvatar[]> {
  const byPoints = await fetchTopMemberAvatarsByPoints(db)
  if (byPoints.length >= AVATAR_FETCH_LIMIT) return byPoints.slice(0, AVATAR_FETCH_LIMIT)

  const recent = await fetchRecentMemberAvatars(db)
  const merged: WaitlistAvatar[] = []
  const seen = new Set<string>()

  for (const avatar of [...byPoints, ...recent]) {
    const key = avatar.src.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(avatar)
    if (merged.length >= AVATAR_FETCH_LIMIT) break
  }

  return merged
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
    const avatars = await fetchSocialProofAvatars(db)

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
