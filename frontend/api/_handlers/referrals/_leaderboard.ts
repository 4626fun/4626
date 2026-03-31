import type { VercelRequest, VercelResponse } from '@vercel/node'

import {
  type ApiEnvelope,
  handleOptions,
  setCors,
  setNoStore,
  getDb,
  readRequestPrincipalAddress,
} from '../../../packages/server-core/src/index.js'



import { ensureReferralsSchema } from '../../../server/_lib/referrals.js'
import {
  getProfileIdByPrincipalAddress,
  getReferralLeaderboardTop,
  getReferralRanksForLeaderboardMe,
  getWeekBoundsUtc,
  maskReferralCode,
  type ReferralsPeriod,
} from '../../../server/_lib/referralsLeaderboard.js'

type Period = ReferralsPeriod

type LeaderboardRow = {
  rank: number
  referralCode: string
  conversions: number
  primaryWallet: string | null
}

type LeaderboardResponse = {
  period: Period
  weekStartUtc?: string
  weekEndUtc?: string
  top: LeaderboardRow[]
  me?: { weeklyRank?: number | null; allTimeRank?: number | null } | null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const rawPeriod = typeof req.query?.period === 'string' ? req.query.period : ''
  const period: Period = rawPeriod === 'all_time' ? 'all_time' : 'weekly'
  const limitRaw = typeof req.query?.limit === 'string' ? Number(req.query.limit) : NaN
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(1, Math.floor(limitRaw)), 100) : 50

  const db = await getDb()
  if (!db) return res.status(500).json({ success: false, error: 'DB unavailable' } satisfies ApiEnvelope<never>)
  await ensureReferralsSchema(db)

  const { start, end } = getWeekBoundsUtc()

  const topRows = await getReferralLeaderboardTop(db, { period, limit, week: { start, end } })
  const top: LeaderboardRow[] = topRows.map((row) => ({
    rank: row.rank,
    referralCode: maskReferralCode(row.referralCode),
    conversions: row.conversions,
    primaryWallet: null,
  }))

  const addr = readRequestPrincipalAddress(req)
  let me: LeaderboardResponse['me'] = null
  if (addr) {
    const myId = await getProfileIdByPrincipalAddress(db, addr)
    if (myId) {
      me = await getReferralRanksForLeaderboardMe(db, myId, { start, end })
    }
  }

  const data: LeaderboardResponse = {
    period,
    ...(period === 'weekly' ? { weekStartUtc: start.toISOString(), weekEndUtc: end.toISOString() } : null),
    top,
    ...(me ? { me } : null),
  }

  return res.status(200).json({ success: true, data } satisfies ApiEnvelope<LeaderboardResponse>)
}
