import { getDb } from '../db/postgres.js'
import {
  readInverseAkitaChatReactionRoomIds,
  resolveInverseAkitaRuntimeReactionRoomIds,
  setInverseAkitaRuntimeReactionRoomIds,
} from './inverseAkitaChatReactionPolicy.js'
import { readAlfaClubChatStatusSnapshot } from './alfaclubChatStatus.js'

type RuntimeEventRow = {
  decision_id: string
  room_id: string
  source_timestamp: string
  public_author_label: string | null
  normalized_market: string
  source_side: 'long' | 'short'
  inverse_side: 'long' | 'short'
  execution_phase: string
  terminal_outcome: string | null
  reason_code: string | null
  observed_at: string
  resolved_at: string | null
}

export type HermitRuntimeEvent = {
  decisionId: string
  roomId: string
  sourceTimestamp: string
  authorLabel: string | null
  market: string
  sourceSide: 'long' | 'short'
  inverseSide: 'long' | 'short'
  executionPhase: string
  terminalOutcome: string | null
  reasonCode: string | null
  observedAt: string
  resolvedAt: string | null
  status:
    | 'executed'
    | 'failed'
    | 'blocked'
    | 'rejected'
    | 'incomplete'
    | 'unknown'
    | 'pending'
}

export type HermitRuntimeStatusSnapshot = {
  generatedAt: string
  reactionRooms: {
    configured: string[]
    runtime: string[]
  }
  bridgeAuth: {
    liveJwtMinutesUntilExpiry: number | null
    consecutiveAuthFailures: number
    consecutiveCfChallenges: number
    cfChallengeSustained: boolean
    socketBackoffMs: number
    lastFailureAt: string | null
    lastSuccessAt: string | null
  } | null
  events: {
    last24h: {
      total: number
      executed: number
      failed: number
      blocked: number
      rejected: number
      pending: number
    }
    recent: HermitRuntimeEvent[]
  }
}

function toEventStatus(row: RuntimeEventRow): HermitRuntimeEvent['status'] {
  const phase = String(row.execution_phase ?? '').trim().toLowerCase()
  const outcome = String(row.terminal_outcome ?? '').trim().toLowerCase()
  if (outcome === 'executed') return 'executed'
  if (outcome === 'failed') return 'failed'
  if (outcome === 'blocked') return 'blocked'
  if (outcome === 'rejected') return 'rejected'
  if (phase === 'unknown') return 'unknown'
  if (outcome === 'incomplete') return 'incomplete'
  if (phase === 'resolved') return 'incomplete'
  return 'pending'
}

function rowToRuntimeEvent(row: RuntimeEventRow): HermitRuntimeEvent {
  return {
    decisionId: row.decision_id,
    roomId: row.room_id,
    sourceTimestamp: row.source_timestamp,
    authorLabel: row.public_author_label,
    market: row.normalized_market,
    sourceSide: row.source_side,
    inverseSide: row.inverse_side,
    executionPhase: row.execution_phase,
    terminalOutcome: row.terminal_outcome,
    reasonCode: row.reason_code,
    observedAt: row.observed_at,
    resolvedAt: row.resolved_at,
    status: toEventStatus(row),
  }
}

export async function readHermitRuntimeStatusSnapshot(
  limit = 25,
): Promise<HermitRuntimeStatusSnapshot> {
  const configuredRoomIds = readInverseAkitaChatReactionRoomIds()
  const runtimeRoomIds = await resolveInverseAkitaRuntimeReactionRoomIds(configuredRoomIds)
  setInverseAkitaRuntimeReactionRoomIds(runtimeRoomIds)
  const snapshot = await readAlfaClubChatStatusSnapshot()
  const db = await getDb()
  const cappedLimit = Math.max(5, Math.min(60, Math.floor(limit)))

  const empty = {
    total: 0,
    executed: 0,
    failed: 0,
    blocked: 0,
    rejected: 0,
    pending: 0,
  }

  let recent: HermitRuntimeEvent[] = []
  let counts = { ...empty }

  if (db && runtimeRoomIds.length > 0) {
    try {
      const roomIds = runtimeRoomIds
      const [recentResult, countsResult] = await Promise.all([
        db.sql<RuntimeEventRow>`
          SELECT
            d.decision_id::text AS decision_id,
            s.room_id,
            s.source_timestamp::text AS source_timestamp,
            s.public_author_label,
            d.normalized_market,
            d.source_side,
            d.inverse_side,
            d.execution_phase,
            d.terminal_outcome::text AS terminal_outcome,
            d.reason_code,
            d.observed_at::text AS observed_at,
            d.resolved_at::text AS resolved_at
          FROM alfaclub.inverse_opinion_trade_decisions AS d
          JOIN alfaclub.inverse_opinion_source_messages AS s
            ON s.source_message_id = d.source_message_id
          WHERE s.room_id = ANY(${roomIds})
          ORDER BY d.observed_at DESC, d.decision_id DESC
          LIMIT ${cappedLimit};
        `,
        db.sql<{
          total: string | number | null
          executed: string | number | null
          failed: string | number | null
          blocked: string | number | null
          rejected: string | number | null
          pending: string | number | null
        }>`
          SELECT
            COUNT(*)::text AS total,
            COUNT(*) FILTER (WHERE d.terminal_outcome = 'executed')::text AS executed,
            COUNT(*) FILTER (WHERE d.terminal_outcome = 'failed')::text AS failed,
            COUNT(*) FILTER (WHERE d.terminal_outcome = 'blocked')::text AS blocked,
            COUNT(*) FILTER (WHERE d.terminal_outcome = 'rejected')::text AS rejected,
            COUNT(*) FILTER (
              WHERE d.execution_phase IN ('claimed', 'submitted')
                 OR d.terminal_outcome = 'incomplete'
                 OR d.execution_phase = 'unknown'
            )::text AS pending
          FROM alfaclub.inverse_opinion_trade_decisions AS d
          JOIN alfaclub.inverse_opinion_source_messages AS s
            ON s.source_message_id = d.source_message_id
          WHERE s.room_id = ANY(${roomIds})
            AND d.observed_at >= NOW() - INTERVAL '24 hours';
        `,
      ])
      recent = (recentResult.rows ?? []).map(rowToRuntimeEvent)
      const row = countsResult.rows?.[0]
      if (row) {
        const readCount = (value: string | number | null | undefined): number => {
          const parsed = Number(value ?? 0)
          return Number.isFinite(parsed) ? parsed : 0
        }
        counts = {
          total: readCount(row.total),
          executed: readCount(row.executed),
          failed: readCount(row.failed),
          blocked: readCount(row.blocked),
          rejected: readCount(row.rejected),
          pending: readCount(row.pending),
        }
      }
    } catch {
      recent = []
      counts = { ...empty }
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    reactionRooms: {
      configured: configuredRoomIds,
      runtime: runtimeRoomIds,
    },
    bridgeAuth: snapshot
      ? {
          liveJwtMinutesUntilExpiry: snapshot.liveChatJwt?.minutesUntilExpiry ?? null,
          consecutiveAuthFailures: snapshot.bridge.consecutiveAuthFailures,
          consecutiveCfChallenges: snapshot.bridge.consecutiveCfChallenges,
          cfChallengeSustained: snapshot.bridge.cfChallengeSustained,
          socketBackoffMs: snapshot.bridge.socketBackoffMs,
          lastFailureAt: snapshot.lastFailure?.at ?? null,
          lastSuccessAt: snapshot.lastSuccess?.at ?? null,
        }
      : null,
    events: {
      last24h: counts,
      recent,
    },
  }
}
