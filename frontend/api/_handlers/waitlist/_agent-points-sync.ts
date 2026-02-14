import { type ApiEnvelope, handleOptions, readJsonBody, setCors, setNoStore } from '../../../server/auth/_shared.js'
import { getDb } from '../../../server/_lib/postgres.js'
import { ensureWaitlistSchema } from '../../../server/_lib/waitlistSchema.js'
import { awardWaitlistPoints, WAITLIST_POINTS } from '../../../server/_lib/waitlistPoints.js'
import { buildReputationGraph } from '../../../server/_lib/reputationGraph.js'
import { readRequestPrincipalAddress } from '../../../server/_lib/requestPrincipal.js'

type Body = { email?: string; agentId?: number | string }

type AgentPointsSyncResponse = {
  email: string
  agentId: number
  feedbackCount: number
  averageValue: number
  awardedFeedbackPoints: number
  awardedReputationPoints: number
}

function normalizeEmail(v: string): string {
  return v.trim().toLowerCase()
}

function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

function safeInt(v: unknown): number {
  const n = Number(v)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.floor(n))
}

export default async function handler(req: any, res: any) {
  setCors(req, res)
  setNoStore(res)
  if (handleOptions(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' } satisfies ApiEnvelope<never>)
  }

  const principalAddress = readRequestPrincipalAddress(req)
  if (!principalAddress) {
    return res.status(401).json({ success: false, error: 'Authentication required' } satisfies ApiEnvelope<never>)
  }

  const body = await readJsonBody<Body>(req)
  const emailRaw = typeof body?.email === 'string' ? body.email : ''
  const email = normalizeEmail(emailRaw)
  if (!isValidEmail(email)) {
    return res.status(400).json({ success: false, error: 'Invalid email' } satisfies ApiEnvelope<never>)
  }

  const db = await getDb()
  if (!db) return res.status(500).json({ success: false, error: 'DB unavailable' } satisfies ApiEnvelope<never>)
  await ensureWaitlistSchema(db as any)

  const me = await db.sql`
    SELECT id, primary_wallet, embedded_wallet, csw_address, erc8004_agent_id
    FROM profiles
    WHERE email = ${email}
    LIMIT 1;
  `
  const row = me?.rows?.[0] ?? null
  const signupId = typeof row?.id === 'number' ? row.id : null
  if (!signupId) {
    return res.status(404).json({ success: false, error: 'Profile not found' } satisfies ApiEnvelope<never>)
  }

  const ownsProfile =
    (typeof row?.primary_wallet === 'string' && row.primary_wallet.toLowerCase() === principalAddress) ||
    (typeof row?.embedded_wallet === 'string' && row.embedded_wallet.toLowerCase() === principalAddress) ||
    (typeof row?.csw_address === 'string' && row.csw_address.toLowerCase() === principalAddress)

  if (!ownsProfile) {
    return res.status(403).json({ success: false, error: 'Not authorized to update this profile' } satisfies ApiEnvelope<never>)
  }

  const agentIdFromBody = safeInt(body?.agentId)
  const agentIdFromDb = safeInt(row?.erc8004_agent_id)
  const agentId = agentIdFromBody || agentIdFromDb
  if (!agentId) {
    return res.status(400).json({ success: false, error: 'Missing agentId (provide one or set erc8004_agent_id on profile)' } satisfies ApiEnvelope<never>)
  }

  const graph = await buildReputationGraph({ agentId })
  const feedbackCount = Math.max(0, safeInt(graph?.summary?.totalFeedback))
  const averageValueRaw = Number(graph?.summary?.averageValue ?? 0)
  const averageValue = Number.isFinite(averageValueRaw) ? Math.max(0, averageValueRaw) : 0

  const awardedFeedbackPoints = feedbackCount * WAITLIST_POINTS.agentFeedback
  // Normalize average into 0..100 style score (4.2 -> 84). Clamp.
  const reputationScore = Math.max(0, Math.min(100, Math.round(averageValue * 20)))
  const awardedReputationPoints = Math.round((reputationScore / 100) * WAITLIST_POINTS.agentReputation)

  await awardWaitlistPoints({
    db,
    signupId,
    source: 'agent_feedback',
    sourceId: `agent:${agentId}:feedback:${feedbackCount}`,
    amount: awardedFeedbackPoints,
  })

  await awardWaitlistPoints({
    db,
    signupId,
    source: 'agent_reputation',
    sourceId: `agent:${agentId}:avg:${averageValue.toFixed(2)}`,
    amount: awardedReputationPoints,
  })

  await db.sql`
    UPDATE profiles
    SET erc8004_agent_id = ${agentId}, updated_at = NOW()
    WHERE id = ${signupId};
  `

  const data: AgentPointsSyncResponse = {
    email,
    agentId,
    feedbackCount,
    averageValue,
    awardedFeedbackPoints,
    awardedReputationPoints,
  }

  return res.status(200).json({ success: true, data } satisfies ApiEnvelope<AgentPointsSyncResponse>)
}
