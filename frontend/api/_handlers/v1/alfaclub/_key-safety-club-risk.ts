import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  RATE_LIMITS,
  checkRateLimit,
  getClientIp,
  getDb,
  rateLimitKey,
} from '@4626/server-core'

type RiskStatus = 'safe' | 'caution' | 'at-risk'

type SnapshotRow = {
  room_id: string
  room_name: string | null
  creator_twitter_username: string | null
  volume_raw: string | null
  pnl_pct_raw: string | null
  supply_raw: string | null
  pot_raw: string | null
}

const CLUB_DIVISOR = 40
const TRADE_FEE_FRACTION = 0.1
const POOL_FEE_FRACTION = 0.06
const NET_PAYOUT_FACTOR = 0.72
const VOTE_THRESHOLD = 0.66

function setPublicCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

function parseString(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  }
  if (Array.isArray(value)) return parseString(value[0] ?? null)
  return null
}

function parseNumber(value: unknown): number | null {
  const parsed = parseString(value)
  if (!parsed) return null
  const n = Number(parsed)
  return Number.isFinite(n) ? n : null
}

function clamp(value: number | null, fallback: number, min: number, max: number): number {
  if (!Number.isFinite(value ?? NaN)) return fallback
  return Math.min(max, Math.max(min, Number(value)))
}

function normalizeMaybeUsdc(raw: number | null): number | null {
  if (!Number.isFinite(raw ?? NaN)) return null
  const value = Number(raw)
  if (value >= 1_000_000) return value / 1_000_000
  return value
}

function sumOfSquares(n: number): number {
  if (n <= 0) return 0
  return (n * (n + 1) * (2 * n + 1)) / 6
}

function curveCost(supply: number, amount: number, divisor: number): number {
  if (amount <= 0) return 0
  const s = Math.max(0, Math.floor(supply))
  const a = Math.floor(amount)
  return (sumOfSquares(s + a - 1) - sumOfSquares(s - 1)) / divisor
}

function poolFeeBaselineUsdcForClubTrading(keySupply: number): number {
  return POOL_FEE_FRACTION * curveCost(0, keySupply, CLUB_DIVISOR)
}

function attackerKeysToPassVote(keySupply: number, yourKeys: number): number {
  const oneMinusT = 1 - VOTE_THRESHOLD
  if (oneMinusT <= 0) return Number.POSITIVE_INFINITY
  const needed = (yourKeys - oneMinusT * keySupply) / oneMinusT
  return Math.max(0, Math.ceil(needed - 1e-9))
}

function buyCostAfterFee(supply: number, amount: number): number {
  return curveCost(supply, amount, CLUB_DIVISOR) * (1 + TRADE_FEE_FRACTION)
}

function estimateClubRisk(params: {
  keySupply: number
  yourKeys: number
  potAtRiskUsdc: number
}): {
  hasVeto: boolean
  minAttackKeys: number
  minAttackCostUsdc: number
  raidUnprofitable: boolean
  maxSafePotUsdc: number
} {
  const hostile = params.keySupply - params.yourKeys
  const hasVeto = hostile < VOTE_THRESHOLD * params.keySupply
  const minAttackKeys = Math.max(1, attackerKeysToPassVote(params.keySupply, params.yourKeys))
  const minAttackCostUsdc = buyCostAfterFee(params.keySupply, minAttackKeys)

  const rawAttackCost = curveCost(params.keySupply, minAttackKeys, CLUB_DIVISOR)
  const poolFeeAddedUsdc = POOL_FEE_FRACTION * rawAttackCost
  const potAfterAttack = Math.max(0, params.potAtRiskUsdc) + poolFeeAddedUsdc
  const eligibleKeys = params.keySupply + minAttackKeys
  const attackerPayoutUsdc =
    eligibleKeys > 0 ? (NET_PAYOUT_FACTOR * potAfterAttack * minAttackKeys) / eligibleKeys : 0
  const feeDragUsdc = 2 * TRADE_FEE_FRACTION * rawAttackCost
  const raidUnprofitable = attackerPayoutUsdc - feeDragUsdc <= 0

  const payoutMultiplier =
    eligibleKeys > 0 ? (NET_PAYOUT_FACTOR * minAttackKeys) / eligibleKeys : 0
  const maxSafePotUsdc =
    payoutMultiplier > 0
      ? Math.max(0, feeDragUsdc / payoutMultiplier - poolFeeAddedUsdc)
      : Number.POSITIVE_INFINITY

  return {
    hasVeto,
    minAttackKeys,
    minAttackCostUsdc,
    raidUnprofitable,
    maxSafePotUsdc,
  }
}

function resolveSafetyStatus(params: {
  raidUnprofitable: boolean
  hasVeto: boolean
  maxSafePotUsdc: number
  potAtRiskUsdc: number
}): RiskStatus {
  if (!params.raidUnprofitable) return 'at-risk'
  const nearThreshold =
    Number.isFinite(params.maxSafePotUsdc) &&
    params.maxSafePotUsdc > 0 &&
    params.potAtRiskUsdc / params.maxSafePotUsdc >= 0.75
  return nearThreshold || !params.hasVeto ? 'caution' : 'safe'
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setPublicCors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS')
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  const limiter = checkRateLimit(
    rateLimitKey('alfaclub-key-safety-club-risk', getClientIp(req)),
    RATE_LIMITS.smartWalletOwnerRead,
  )
  if (!limiter.allowed) {
    res.setHeader(
      'Retry-After',
      String(Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000))),
    )
    return res.status(429).json({ success: false, error: 'Rate limit exceeded' })
  }

  const limit = clamp(parseNumber(req.query.limit), 20, 5, 40)
  const ownerSharePercent = clamp(parseNumber(req.query.ownerSharePercent), 20, 1, 99)
  const donationUsdc = clamp(parseNumber(req.query.donationUsdc), 0, 0, 1_000_000)

  const db = await getDb()
  if (!db) {
    return res.status(503).json({ success: false, error: 'database_unavailable' })
  }

  try {
    const result = await db.sql`
      select
        s.room_id::text as room_id,
        coalesce(
          nullif(s.room_name, ''),
          nullif(s.raw->'room'->>'name', ''),
          nullif(s.raw->'room'->>'title', '')
        ) as room_name,
        s.creator_twitter_username,
        nullif(s.raw->'room'->>'volume', '') as volume_raw,
        nullif(s.raw->'room'->>'pnlPercentageAllTime', '') as pnl_pct_raw,
        coalesce(
          nullif(s.raw->'room'->>'keySupply', ''),
          nullif(s.raw->'room'->>'keysSupply', ''),
          nullif(s.raw->'room'->>'totalSupply', ''),
          nullif(s.raw->'room'->>'holders', ''),
          nullif(s.raw->'room'->>'holdersCount', '')
        ) as supply_raw,
        coalesce(
          nullif(s.raw->'room'->>'tradingFundBalance', ''),
          nullif(s.raw->'room'->>'poolBalance', ''),
          nullif(s.raw->'room'->>'fundBalance', ''),
          nullif(s.raw->'room'->>'stakingPoolBalance', '')
        ) as pot_raw
      from public.alfaclub_rooms_snapshot s
      where lower(coalesce(s.room_type, '')) = 'trading'
        and lower(coalesce(s.tier, '')) = 'club'
        and (s.raw->'room'->>'volume') ~ '^[0-9]+(\\.[0-9]+)?$'
      order by (s.raw->'room'->>'volume')::numeric desc nulls last
      limit ${limit};
    `

    const rows = (result.rows ?? []) as SnapshotRow[]
    const responseRows = rows.map((row) => {
      const supplyRaw = parseNumber(row.supply_raw)
      const supply = Math.max(1, Math.floor(supplyRaw ?? 30))
      const keysHeld = Math.round((ownerSharePercent / 100) * supply)

      const volumeRaw = parseNumber(row.volume_raw)
      const volumeUsdc = normalizeMaybeUsdc(volumeRaw) ?? 0

      const potFromSnapshot = normalizeMaybeUsdc(parseNumber(row.pot_raw))
      const potSource: 'snapshot' | 'curve_baseline' =
        potFromSnapshot !== null ? 'snapshot' : 'curve_baseline'
      const potUsdc = potFromSnapshot ?? poolFeeBaselineUsdcForClubTrading(supply)
      const potAtRiskUsdc = Math.max(0, potUsdc + donationUsdc)

      const risk = estimateClubRisk({
        keySupply: supply,
        yourKeys: keysHeld,
        potAtRiskUsdc,
      })

      return {
        roomId: row.room_id,
        roomName: row.room_name ?? row.creator_twitter_username ?? `Room #${row.room_id}`,
        creatorHandle: row.creator_twitter_username ?? null,
        supply,
        ownerSharePercent,
        keysHeld,
        volumeUsdc,
        pnlPctAllTime: parseNumber(row.pnl_pct_raw),
        modeledPotUsdc: potUsdc,
        potSource,
        minAttackKeys: risk.minAttackKeys,
        minAttackCostUsdc: risk.minAttackCostUsdc,
        status: resolveSafetyStatus({
          raidUnprofitable: risk.raidUnprofitable,
          hasVeto: risk.hasVeto,
          maxSafePotUsdc: risk.maxSafePotUsdc,
          potAtRiskUsdc,
        }),
      }
    })

    res.setHeader('Cache-Control', 'public, s-maxage=45, stale-while-revalidate=120')
    return res.status(200).json({
      success: true,
      data: {
        assumptions: {
          roomTier: 'club',
          ownerSharePercent,
          donationUsdc,
        },
        rows: responseRows,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'key_safety_club_risk_failed'
    return res.status(500).json({ success: false, error: message })
  }
}
