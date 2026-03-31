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
import { getReferralsMeStats, getReferrerProfileByAddressOrCode, getWeekBoundsUtc } from '../../../server/_lib/referralsLeaderboard.js'

type ReferralsMeResponse = {
  referralCode: string | null
  referralLink: string | null
  weeklyConversions: number
  allTimeConversions: number
  weeklyRank: number | null
  allTimeRank: number | null
}

function getOrigin(req: VercelRequest): string {
  const host = typeof req.headers?.host === 'string' ? req.headers.host : '4626.fun'
  const xfProto = typeof req.headers?.['x-forwarded-proto'] === 'string' ? req.headers['x-forwarded-proto'] : 'https'
  const proto = xfProto.toLowerCase() === 'http' ? 'http' : 'https'
  return `${proto}://${host}`
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const db = await getDb()
  if (!db) return res.status(500).json({ success: false, error: 'DB unavailable' } satisfies ApiEnvelope<never>)
  await ensureReferralsSchema(db)

  // Primary: look up by authenticated principal (session or SIWA).
  const address = readRequestPrincipalAddress(req)

  // Fallback: allow clients without a SIWE session (e.g. SIWF-only) to query by referral code.
  const codeParam = typeof req.query?.referralCode === 'string' ? req.query.referralCode : ''

  const profile = await getReferrerProfileByAddressOrCode(db, { address, referralCode: codeParam })
  const signupId = profile.signupId
  const referralCode = profile.referralCode
  if (!signupId) {
    return res.status(200).json({ success: true, data: null } satisfies ApiEnvelope<ReferralsMeResponse | null>)
  }

  const stats = await getReferralsMeStats(db, signupId, getWeekBoundsUtc())

  const origin = getOrigin(req)
  const referralLink = referralCode ? `${origin}/r/${encodeURIComponent(referralCode)}` : null

  const data: ReferralsMeResponse = {
    referralCode,
    referralLink,
    weeklyConversions: stats.weeklyConversions,
    allTimeConversions: stats.allTimeConversions,
    weeklyRank: stats.weeklyRank,
    allTimeRank: stats.allTimeRank,
  }

  return res.status(200).json({ success: true, data } satisfies ApiEnvelope<ReferralsMeResponse>)
}
