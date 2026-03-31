import {
  type ApiEnvelope,
  handleOptions,
  readJsonBody,
  setCors,
  setNoStore,
  getDb,
  readRequestPrincipalAddress,
} from '../../../packages/server-core/src/index.js'

import { isAuthorizedWalletForProfile } from '../../../server/_lib/canonicalWalletResolver.js'


import { ensureWaitlistSchema } from '../../../server/_lib/waitlistSchema.js'
import { awardWaitlistPoints, WAITLIST_POINTS } from '../../../server/_lib/waitlistPoints.js'

// Bonus tasks (honor system)
type BonusTaskKey = 'github' | 'tiktok' | 'instagram' | 'reddit'

type TaskKey = BonusTaskKey

const TASK_POINTS: Record<TaskKey, number> = {
  // Bonus (honor system)
  github: WAITLIST_POINTS.github,
  tiktok: WAITLIST_POINTS.tiktok,
  instagram: WAITLIST_POINTS.instagram,
  reddit: WAITLIST_POINTS.reddit,
}

// Map task keys to point sources for ledger tracking
const TASK_SOURCE_MAP: Record<TaskKey, string> = {
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
  // X follow is now verified (not honor system). Route callers to the verifier endpoint.
  if (taskKeyRaw === 'x' || taskKeyRaw === 'follow') {
    return res.status(400).json({
      success: false,
      error: 'Use /api/waitlist/verify-x to verify X follow.',
    } satisfies ApiEnvelope<never>)
  }
  const taskKey = (Object.keys(TASK_POINTS) as TaskKey[]).includes(taskKeyRaw as TaskKey) ? (taskKeyRaw as TaskKey) : null
  if (!taskKey) {
    return res.status(400).json({
      success: false,
      error: 'This task requires platform verification. Use the dedicated verify endpoint.',
    } satisfies ApiEnvelope<never>)
  }

  const principalAddress = readRequestPrincipalAddress(req)
  if (!principalAddress) {
    return res.status(401).json({ success: false, error: 'Authentication required' } satisfies ApiEnvelope<never>)
  }

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

  const authorized = await isAuthorizedWalletForProfile({
    db: db as any,
    profileId: signupId,
    address: principalAddress,
  })
  if (!authorized) {
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
