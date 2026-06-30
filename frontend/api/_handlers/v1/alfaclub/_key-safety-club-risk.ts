import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  RATE_LIMITS,
  checkRateLimit,
  getClientIp,
  getDb,
  rateLimitKey,
} from '@4626/server-core'

import { materializeRoomDisplayFields } from '../../../../server/_lib/alfaclub/roomDisplayLabels.js'
import { resolveKeySafetyRoomContext } from '../../../../server/_lib/alfaclub/keySafetyRoomContext.js'
import {
  curveDivisor,
  poolFeeFraction,
  tradeFeeFraction,
  type AlfaRoomTier,
} from '../../../../src/lib/alfaclub/keyDefense.js'

type RiskStatus = 'safe' | 'caution' | 'at-risk'

type SnapshotRow = {
  room_id: string
  room_name: string | null
  creator_twitter_username: string | null
  cached_display_label: string | null
  tier: string | null
  volume_col_raw: string | null
  volume_raw: string | null
  pnl_pct_raw: string | null
  supply_col_raw: string | null
  supply_raw: string | null
  fund_size_raw: string | null
  pot_raw: string | null
}

const TRADE_ROOM_TYPE = 'trading' as const
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

function normalizeTier(raw: string | null): AlfaRoomTier {
  const value = (raw ?? '').trim().toLowerCase()
  switch (value) {
    case 'casual':
      return 'casual'
    case 'exclusive':
      return 'exclusive'
    case 'club':
    default:
      return 'club'
  }
}

function curveCost(supply: number, amount: number, divisor: number): number {
  if (amount <= 0) return 0
  const s = Math.max(0, Math.floor(supply))
  const a = Math.floor(amount)
  return (sumOfSquares(s + a - 1) - sumOfSquares(s - 1)) / divisor
}

function attackerKeysToPassVote(keySupply: number, yourKeys: number): number {
  const oneMinusT = 1 - VOTE_THRESHOLD
  if (oneMinusT <= 0) return Number.POSITIVE_INFINITY
  const needed = (yourKeys - oneMinusT * keySupply) / oneMinusT
  return Math.max(0, Math.ceil(needed - 1e-9))
}

function buyCostAfterFee(supply: number, amount: number, roomTier: AlfaRoomTier): number {
  const divisor = curveDivisor(TRADE_ROOM_TYPE, roomTier)
  const tradeFee = tradeFeeFraction(TRADE_ROOM_TYPE)
  return curveCost(supply, amount, divisor) * (1 + tradeFee)
}

function estimateClubRisk(params: {
  roomTier: AlfaRoomTier
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
  const minAttackCostUsdc = buyCostAfterFee(params.keySupply, minAttackKeys, params.roomTier)
  const divisor = curveDivisor(TRADE_ROOM_TYPE, params.roomTier)
  const tradeFee = tradeFeeFraction(TRADE_ROOM_TYPE)
  const poolFee = poolFeeFraction(TRADE_ROOM_TYPE)

  const rawAttackCost = curveCost(params.keySupply, minAttackKeys, divisor)
  const poolFeeAddedUsdc = poolFee * rawAttackCost
  const potAfterAttack = Math.max(0, params.potAtRiskUsdc) + poolFeeAddedUsdc
  const eligibleKeys = params.keySupply + minAttackKeys
  const attackerPayoutUsdc =
    eligibleKeys > 0 ? (NET_PAYOUT_FACTOR * potAfterAttack * minAttackKeys) / eligibleKeys : 0
  const feeDragUsdc = 2 * tradeFee * rawAttackCost
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
  const roomId = parseString(req.query.roomId)
  const tradingWallet = parseString(req.query.tradingWallet)

  if (roomId) {
    try {
      const room = await resolveKeySafetyRoomContext(roomId, {
        tradingWalletOverride: tradingWallet,
      })
      if (!room) {
        return res.status(404).json({ success: false, error: 'room_not_found' })
      }
      res.setHeader('Cache-Control', 'public, s-maxage=45, stale-while-revalidate=120')
      return res.status(200).json({
        success: true,
        data: { room },
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'key_safety_room_failed'
      return res.status(500).json({ success: false, error: message })
    }
  }

  const db = await getDb()
  if (!db) {
    return res.status(503).json({ success: false, error: 'database_unavailable' })
  }

  try {
    const result = await db.sql`
      select
        s.room_id::text as room_id,
        coalesce(
          nullif(trim(s.room_name), ''),
          nullif(trim(s.raw->'metadata'->>'name'), ''),
          nullif(trim(s.raw->'room'->>'name'), ''),
          nullif(trim(s.raw->'room'->>'title'), ''),
          nullif(trim(e.room_name), ''),
          nullif(trim(lc.display_label), ''),
          case
            when nullif(trim(s.sn), '') is not null and nullif(trim(s.sn), '') !~ '^[0-9]+$'
              then nullif(trim(s.sn), '')
            else null
          end
        ) as room_name,
        coalesce(
          nullif(trim(s.creator_twitter_username), ''),
          nullif(trim(s.raw->'creator'->>'twitter_username'), ''),
          nullif(trim(s.raw->'creator'->>'username'), ''),
          nullif(trim(s.raw->'room'->>'creatorUsername'), ''),
          nullif(trim(s.raw->'room'->>'username'), ''),
          nullif(trim(e.creator_twitter_username), ''),
          nullif(trim(chat.username), '')
        ) as creator_twitter_username,
        lc.display_label as cached_display_label,
        s.tier,
        s.volume::text as volume_col_raw,
        nullif(s.raw->'room'->>'volume', '') as volume_raw,
        nullif(s.raw->'room'->>'pnlPercentageAllTime', '') as pnl_pct_raw,
        s.current_supply::text as supply_col_raw,
        coalesce(
          nullif(s.raw->'room'->>'keySupply', ''),
          nullif(s.raw->'room'->>'keysSupply', ''),
          nullif(s.raw->'room'->>'totalSupply', ''),
          nullif(s.raw->'room'->>'holders', ''),
          nullif(s.raw->'room'->>'holdersCount', '')
        ) as supply_raw,
        s.fund_size::text as fund_size_raw,
        coalesce(
          nullif(s.raw->'room'->>'tradingFundBalance', ''),
          nullif(s.raw->'room'->>'poolBalance', ''),
          nullif(s.raw->'room'->>'fundBalance', ''),
          nullif(s.raw->'room'->>'stakingPoolBalance', '')
        ) as pot_raw
      from public.alfaclub_rooms_snapshot s
      left join alfaclub.room_label_cache lc on lc.room_id = s.room_id::text
      left join lateral (
        select e2.creator_twitter_username, e2.room_name
        from public.alfaclub_explore_latest e2
        where e2.room_id = s.room_id
        order by e2.ingested_at desc nulls last
        limit 1
      ) e on true
      left join lateral (
        select ci.username
        from alfaclub.chat_ingest ci
        where ci.room_id = s.room_id::text
          and lower(ci.sender_address) = lower(s.creator_address)
          and ci.username is not null
          and length(trim(ci.username)) > 0
        order by ci.message_date desc nulls last, ci.ingested_at desc
        limit 1
      ) chat on true
      where lower(coalesce(s.room_type, '')) = 'trading'
        and (
          (s.current_supply is not null and s.current_supply > 0)
          or (
            coalesce(
              nullif(s.raw->'room'->>'keySupply', ''),
              nullif(s.raw->'room'->>'keysSupply', ''),
              nullif(s.raw->'room'->>'totalSupply', ''),
              nullif(s.raw->'room'->>'holders', ''),
              nullif(s.raw->'room'->>'holdersCount', '')
            ) ~ '^[0-9]+(\\.[0-9]+)?$'
            and (
              coalesce(
                nullif(s.raw->'room'->>'keySupply', ''),
                nullif(s.raw->'room'->>'keysSupply', ''),
                nullif(s.raw->'room'->>'totalSupply', ''),
                nullif(s.raw->'room'->>'holders', ''),
                nullif(s.raw->'room'->>'holdersCount', '')
              )::numeric > 0
            )
          )
        )
        and (
          (s.volume is not null and s.volume >= 0)
          or nullif(s.raw->'room'->>'volume', '') ~ '^[0-9]+(\\.[0-9]+)?$'
        )
        and (
          s.fund_size is not null
          or coalesce(
            nullif(s.raw->'room'->>'tradingFundBalance', ''),
            nullif(s.raw->'room'->>'poolBalance', ''),
            nullif(s.raw->'room'->>'fundBalance', ''),
            nullif(s.raw->'room'->>'stakingPoolBalance', '')
          ) ~ '^[0-9]+(\\.[0-9]+)?$'
        )
      order by coalesce(
        s.volume,
        case
          when nullif(s.raw->'room'->>'volume', '') ~ '^[0-9]+(\\.[0-9]+)?$'
            then (s.raw->'room'->>'volume')::numeric
          else null
        end
      ) desc nulls last
      limit ${limit};
    `

    const rows = (result.rows ?? []) as SnapshotRow[]
    const responseRows = rows.flatMap((row) => {
      const supplyRaw = parseNumber(row.supply_col_raw) ?? parseNumber(row.supply_raw)
      if (!Number.isFinite(supplyRaw) || (supplyRaw ?? 0) <= 0) return []
      const supply = Math.max(1, Math.floor(supplyRaw!))
      const keysHeld = Math.round((ownerSharePercent / 100) * supply)
      const roomTier = normalizeTier(row.tier)

      const volumeRaw = parseNumber(row.volume_col_raw) ?? parseNumber(row.volume_raw)
      const volumeUsdc = normalizeMaybeUsdc(volumeRaw)
      if (!Number.isFinite(volumeUsdc ?? NaN) || (volumeUsdc ?? 0) < 0) return []

      const potFromSnapshot = normalizeMaybeUsdc(
        parseNumber(row.fund_size_raw) ?? parseNumber(row.pot_raw),
      )
      if (!Number.isFinite(potFromSnapshot ?? NaN) || (potFromSnapshot ?? 0) < 0) return []
      const potSource = 'snapshot' as const
      const potUsdc = potFromSnapshot!
      const potAtRiskUsdc = Math.max(0, potUsdc + donationUsdc)

      const risk = estimateClubRisk({
        roomTier,
        keySupply: supply,
        yourKeys: keysHeld,
        potAtRiskUsdc,
      })

      const labels = materializeRoomDisplayFields({
        roomId: row.room_id,
        roomName: row.room_name,
        creatorHandle: row.creator_twitter_username,
        cachedDisplayLabel: row.cached_display_label,
      })

      return {
        roomId: row.room_id,
        roomName: labels.roomName,
        displayLabel: labels.displayLabel,
        creatorHandle: labels.creatorHandle,
        tier: roomTier,
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
          roomType: 'trading',
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
