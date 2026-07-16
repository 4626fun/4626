import { apiFetch } from '@/lib/api/apiBase'
import { API_ENDPOINTS } from '@/lib/api/apiEndpoints'
import { resolveApiErrorMessage } from '@/lib/api/apiEnvelope'

export type HermitRuntimeEventStatus =
  | 'executed'
  | 'failed'
  | 'blocked'
  | 'rejected'
  | 'incomplete'
  | 'unknown'
  | 'pending'

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
  status: HermitRuntimeEventStatus
}

export type HermitRuntimeStatusPayload = {
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

function parsePayload(payload: unknown): HermitRuntimeStatusPayload {
  if (!isRecord(payload) || payload.success !== true || !isRecord(payload.data)) {
    throw new Error('Invalid Hermit runtime response shape')
  }
  return payload.data as unknown as HermitRuntimeStatusPayload
}

export async function fetchHermitRuntimeStatus(limit = 25): Promise<HermitRuntimeStatusPayload> {
  const response = await apiFetch(
    `${API_ENDPOINTS.alfaclub.hermitRuntime}?limit=${encodeURIComponent(String(limit))}`,
    { method: 'GET' },
  )
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(resolveApiErrorMessage(payload, `Hermit runtime status failed (${response.status})`))
  }
  return parsePayload(payload)
}
