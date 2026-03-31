import {
  type ApiEnvelope,
  handleOptions,
  setCors,
  setNoStore,
  getDb,
  resolveAuthorizedRequestPrincipal,
} from '../../../packages/server-core/src/index.js'



import { ensureWaitlistSchema } from '../../../server/_lib/waitlistSchema.js'
import {
  getWaitlistLeaderboardData,
  type WaitlistLeaderboardPointsType,
  type WaitlistLeaderboardResponse,
} from '../../../server/_lib/waitlistLeaderboard.js'

export default async function handler(req: any, res: any) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const rawPage = typeof (req.query as any)?.page === 'string' ? Number((req.query as any).page) : NaN
  const rawLimit = typeof (req.query as any)?.limit === 'string' ? Number((req.query as any).limit) : NaN
  const page = Number.isFinite(rawPage) ? Math.max(1, Math.floor(rawPage)) : 1
  const limit = Number.isFinite(rawLimit) ? Math.min(100, Math.max(1, Math.floor(rawLimit))) : 10

  const pointsTypeParam = typeof (req.query as any)?.pointsType === 'string' ? String((req.query as any).pointsType).toLowerCase() : ''
  const pointsType: WaitlistLeaderboardPointsType =
    pointsTypeParam === 'total' ? 'total' : pointsTypeParam === 'agent' ? 'agent' : 'invite'

  const db = await getDb()
  if (!db) return res.status(500).json({ success: false, error: 'DB unavailable' } satisfies ApiEnvelope<never>)
  await ensureWaitlistSchema(db as any)
  const authorizedPrincipal = await resolveAuthorizedRequestPrincipal(req)
  const data: WaitlistLeaderboardResponse = await getWaitlistLeaderboardData({
    db,
    page,
    limit,
    pointsType,
    authorizedProfileId: authorizedPrincipal?.profileId ?? null,
  })
  return res.status(200).json({ success: true, data } satisfies ApiEnvelope<WaitlistLeaderboardResponse>)
}
