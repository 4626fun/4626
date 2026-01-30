import { type ApiEnvelope, handleOptions, readJsonBody, readSessionFromRequest, setCors, setNoStore } from '../../../server/auth/_shared.js'
import { getDb } from '../../../server/_lib/postgres.js'
import { ensureWaitlistSchema } from '../../../server/_lib/waitlistSchema.js'
import { awardWaitlistPoints, WAITLIST_POINTS } from '../../../server/_lib/waitlistPoints.js'

// Legacy tasks
type LegacyTaskKey = 'shareX' | 'copyLink' | 'share' | 'follow' | 'saveApp'

// Social tasks (verified or honor system)
type SocialTaskKey = 'farcaster' | 'baseApp' | 'zora' | 'x' | 'discord' | 'telegram'

// Bonus tasks (honor system)
type BonusTaskKey = 'github' | 'tiktok' | 'instagram' | 'reddit'

type TaskKey = LegacyTaskKey | SocialTaskKey | BonusTaskKey

const TASK_POINTS: Record<TaskKey, number> = {
  // Legacy
  shareX: 10,
  copyLink: 5,
  share: 7,
  follow: WAITLIST_POINTS.x,
  saveApp: 6,
  // Social (verified)
  farcaster: WAITLIST_POINTS.farcaster,
  baseApp: WAITLIST_POINTS.baseApp,
  zora: WAITLIST_POINTS.zora,
  x: WAITLIST_POINTS.x,
  discord: WAITLIST_POINTS.discord,
  telegram: WAITLIST_POINTS.telegram,
  // Bonus (honor system)
  github: WAITLIST_POINTS.github,
  tiktok: WAITLIST_POINTS.tiktok,
  instagram: WAITLIST_POINTS.instagram,
  reddit: WAITLIST_POINTS.reddit,
}

// Map task keys to point sources for ledger tracking
const TASK_SOURCE_MAP: Record<TaskKey, string> = {
  shareX: 'task',
  copyLink: 'task',
  share: 'task',
  follow: 'social_x',
  saveApp: 'task',
  farcaster: 'social_farcaster',
  baseApp: 'social_base_app',
  zora: 'social_zora',
  x: 'social_x',
  discord: 'social_discord',
  telegram: 'social_telegram',
  github: 'bonus_github',
  tiktok: 'bonus_tiktok',
  instagram: 'bonus_instagram',
  reddit: 'bonus_reddit',
}

type Body = { email?: string; taskKey?: string }

type TaskClaimResponse = { email: string; taskKey: TaskKey; awarded: boolean }

function normalizeEmail(v: string): string {
  return v.trim().toLowerCase()
}
function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

export default async function handler(req: any, res: any) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const body = await readJsonBody<Body>(req)
  const emailRaw = typeof body?.email === 'string' ? body.email : ''
  const email = normalizeEmail(emailRaw)
  if (!isValidEmail(email)) {
    return res.status(400).json({ success: false, error: 'Invalid email' } satisfies ApiEnvelope<never>)
  }

  const taskKeyRaw = typeof body?.taskKey === 'string' ? body.taskKey : ''
  const taskKey = (Object.keys(TASK_POINTS) as TaskKey[]).includes(taskKeyRaw as TaskKey) ? (taskKeyRaw as TaskKey) : null
  if (!taskKey) {
    return res.status(400).json({ success: false, error: 'Invalid task key' } satisfies ApiEnvelope<never>)
  }

  const session = readSessionFromRequest(req)
  if (!session?.address) {
    return res.status(401).json({ success: false, error: 'Authentication required' } satisfies ApiEnvelope<never>)
  }
  const sessionAddress = session.address.toLowerCase()

  const db = await getDb()
  if (!db) return res.status(500).json({ success: false, error: 'DB unavailable' } satisfies ApiEnvelope<never>)
  await ensureWaitlistSchema(db as any)

  const me = await db.sql`
    SELECT id, primary_wallet, embedded_wallet, csw_address
    FROM profiles
    WHERE email = ${email}
    LIMIT 1;
  `
  const row = me?.rows?.[0] ?? null
  const signupId = typeof row?.id === 'number' ? (row.id as number) : null
  if (!signupId) {
    const data: TaskClaimResponse = { email, taskKey, awarded: false }
    return res.status(200).json({ success: true, data } satisfies ApiEnvelope<TaskClaimResponse>)
  }

  const ownsProfile =
    (typeof row?.primary_wallet === 'string' && row.primary_wallet.toLowerCase() === sessionAddress) ||
    (typeof row?.embedded_wallet === 'string' && row.embedded_wallet.toLowerCase() === sessionAddress) ||
    (typeof row?.csw_address === 'string' && row.csw_address.toLowerCase() === sessionAddress)
  if (!ownsProfile) {
    return res.status(403).json({ success: false, error: 'Not authorized to update this profile' } satisfies ApiEnvelope<never>)
  }

  await awardWaitlistPoints({
    db,
    signupId,
    source: TASK_SOURCE_MAP[taskKey] || 'task',
    sourceId: taskKey,
    amount: TASK_POINTS[taskKey],
  })

  const data: TaskClaimResponse = { email, taskKey, awarded: true }
  return res.status(200).json({ success: true, data } satisfies ApiEnvelope<TaskClaimResponse>)
}

