import {
  type ApiEnvelope,
  handleOptions,
  setCors,
  setNoStore,
  getDb,
} from '../../../packages/server-core/src/index.js'

import { ensureWaitlistSchema } from '../../../server/_lib/onboarding/waitlistSchema.js'

type WaitlistStatsResponse = {
  signedUpCount: number
  capacity: number
  spotsRemaining: number
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

  const db = await getDb()
  if (!db) {
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

  const data: WaitlistStatsResponse = {
    signedUpCount,
    capacity,
    spotsRemaining,
  }

  return res.status(200).json({ success: true, data } satisfies ApiEnvelope<WaitlistStatsResponse>)
}
