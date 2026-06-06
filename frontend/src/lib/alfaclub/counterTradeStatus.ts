import { apiFetch } from '@/lib/api/apiBase'
import { resolveApiErrorMessage } from '@/lib/api/apiEnvelope'
import { API_ENDPOINTS } from '@/lib/api/apiEndpoints'

export type CounterTradeBias = 'bullish' | 'bearish' | 'neutral'
export type CounterTradeUserState = 'not_opted_in' | 'active' | 'paused'
export type CounterTradePreset = 'defensive' | 'balanced' | 'aggressive'
export type CounterTradeActionStatus = 'executed' | 'skipped' | 'blocked' | 'failed'

export type CounterTradeRecentAction = {
  id: number
  roomId: string
  senderAddress: string
  eventKey: string
  status: CounterTradeActionStatus
  reason: string
  counterSide: 'long' | 'short' | null
  counterNotionalUsd: number | null
  counterLeverage: number | null
  createdAt: string
}

export type CounterTradeStatusPayload = {
  roomId: string
  engineEnabled: boolean
  strategy: {
    roomId: string
    enabled: boolean
    killSwitch: boolean
    globalBias: CounterTradeBias
    updatedAt: string
  } | null
  user: {
    senderAddress: string
    state: CounterTradeUserState
    preset: CounterTradePreset | null
    pauseReason: string | null
    lastActionAt: string | null
  }
  recentActions: CounterTradeRecentAction[]
}

export class CounterTradeStatusAuthError extends Error {
  readonly code = 'counter_trade_status_auth_required' as const

  constructor(message = 'Sign-in required to load strategy status') {
    super(message)
    this.name = 'CounterTradeStatusAuthError'
  }
}

export function isCounterTradeStatusAuthError(error: unknown): error is CounterTradeStatusAuthError {
  return error instanceof CounterTradeStatusAuthError
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

function isBias(value: unknown): value is CounterTradeBias {
  return value === 'bullish' || value === 'bearish' || value === 'neutral'
}

function isUserState(value: unknown): value is CounterTradeUserState {
  return value === 'not_opted_in' || value === 'active' || value === 'paused'
}

function isPreset(value: unknown): value is CounterTradePreset {
  return value === 'defensive' || value === 'balanced' || value === 'aggressive'
}

function isActionStatus(value: unknown): value is CounterTradeActionStatus {
  return value === 'executed' || value === 'skipped' || value === 'blocked' || value === 'failed'
}

function parseStatusPayload(payload: unknown): CounterTradeStatusPayload {
  if (!isRecord(payload)) throw new Error('Invalid counter-trade status response shape')
  if (payload.success !== true) throw new Error('Counter-trade status request was not successful')
  if (!isRecord(payload.data)) throw new Error('Counter-trade status response is missing data')

  const data = payload.data
  const roomId = typeof data.roomId === 'string' ? data.roomId : ''
  const engineEnabled = data.engineEnabled === true
  if (!roomId) throw new Error('Counter-trade status missing roomId')

  let strategy: CounterTradeStatusPayload['strategy'] = null
  if (isRecord(data.strategy)) {
    const globalBias = data.strategy.globalBias
    if (!isBias(globalBias)) throw new Error('Counter-trade status has invalid strategy bias')
    strategy = {
      roomId: typeof data.strategy.roomId === 'string' ? data.strategy.roomId : roomId,
      enabled: data.strategy.enabled === true,
      killSwitch: data.strategy.killSwitch === true,
      globalBias,
      updatedAt: typeof data.strategy.updatedAt === 'string' ? data.strategy.updatedAt : '',
    }
  }

  if (!isRecord(data.user)) throw new Error('Counter-trade status is missing user block')
  if (!isUserState(data.user.state)) throw new Error('Counter-trade status has invalid user state')
  if (data.user.preset != null && !isPreset(data.user.preset)) {
    throw new Error('Counter-trade status has invalid preset')
  }
  const user = {
    senderAddress: typeof data.user.senderAddress === 'string' ? data.user.senderAddress : '',
    state: data.user.state,
    preset: data.user.preset ?? null,
    pauseReason: typeof data.user.pauseReason === 'string' ? data.user.pauseReason : null,
    lastActionAt: typeof data.user.lastActionAt === 'string' ? data.user.lastActionAt : null,
  }

  const recentActions: CounterTradeRecentAction[] = Array.isArray(data.recentActions)
    ? data.recentActions
        .filter(isRecord)
        .filter((row) => isActionStatus(row.status))
        .map((row) => ({
          id: typeof row.id === 'number' ? row.id : 0,
          roomId: typeof row.roomId === 'string' ? row.roomId : roomId,
          senderAddress: typeof row.senderAddress === 'string' ? row.senderAddress : user.senderAddress,
          eventKey: typeof row.eventKey === 'string' ? row.eventKey : '',
          status: row.status,
          reason: typeof row.reason === 'string' ? row.reason : '',
          counterSide: row.counterSide === 'long' || row.counterSide === 'short' ? row.counterSide : null,
          counterNotionalUsd: typeof row.counterNotionalUsd === 'number' ? row.counterNotionalUsd : null,
          counterLeverage: typeof row.counterLeverage === 'number' ? row.counterLeverage : null,
          createdAt: typeof row.createdAt === 'string' ? row.createdAt : '',
        }))
    : []

  return {
    roomId,
    engineEnabled,
    strategy,
    user,
    recentActions,
  }
}

export async function fetchCounterTradeStatus(): Promise<CounterTradeStatusPayload> {
  const response = await apiFetch(API_ENDPOINTS.alfaclub.counterTradeStatus, {
    method: 'GET',
    withCredentials: true,
  })
  const payload = await response.json().catch(() => null)

  if (response.status === 401 || response.status === 403) {
    throw new CounterTradeStatusAuthError(
      resolveApiErrorMessage(payload, 'Sign-in required to load strategy status'),
    )
  }
  if (!response.ok) {
    throw new Error(resolveApiErrorMessage(payload, `Counter-trade status failed (${response.status})`))
  }
  return parseStatusPayload(payload)
}

