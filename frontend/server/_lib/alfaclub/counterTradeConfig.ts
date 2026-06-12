import { logger } from '../infra/logger.js'

declare const process: { env: Record<string, string | undefined> }

export type CounterTradeBias = 'bullish' | 'bearish' | 'neutral'
export type CounterTradePreset = 'defensive' | 'balanced' | 'aggressive'
export type CounterTradeSide = 'long' | 'short'

export type CounterTradeRuntimeConfig = {
  enabled: boolean
  /**
   * Mirror exits: when the countered user closes (or is liquidated out of) a
   * position, close the bot's position on that pair. Exits are risk-reducing,
   * so they bypass cooldown/hourly/daily entry gates but still respect the
   * env + DB kill switches and per-fill dedupe.
   */
  exitEnabled: boolean
  roomId: string
  chatPostEnabled: boolean
  chatPostRoomId: string
  minUserNotionalUsd: number
  cooldownMs: number
  hourlyActionCap: number
  dailyNotionalCapUsd: number
  maxCounterNotionalPerTradeUsd: number
  globalMaxLeverage: number
  favoredMultiplier: number
  neutralMultiplier: number
  unfavoredMultiplier: number
  favoredNotionalRatio: number
  neutralNotionalRatio: number
  unfavoredNotionalRatio: number
  neutralBiasLeverageCap: number
  favoredBiasLeverageCap: number
  unfavoredBiasLeverageCap: number
  liquidationMinDistancePct: number
  eventLookbackMs: number
  runLimitPerIdentity: number
}

function readBool(name: string, fallback: boolean): boolean {
  const raw = String(process.env[name] ?? '').trim().toLowerCase()
  if (!raw) return fallback
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on'
}

function readPositiveNumber(name: string, fallback: number): number {
  const raw = String(process.env[name] ?? '').trim()
  if (!raw) return fallback
  const parsed = Number(raw)
  if (Number.isFinite(parsed) && parsed > 0) return parsed
  logger.warn('[counter-trade] invalid positive number env; using fallback', { name, raw, fallback })
  return fallback
}

function readPositiveInt(name: string, fallback: number): number {
  return Math.floor(readPositiveNumber(name, fallback))
}

function readRoomId(): string {
  const raw = String(process.env.ALFACLUB_COUNTER_TRADE_ROOM_ID ?? '1659').trim()
  return raw || '1659'
}

export function readCounterTradeRuntimeConfig(): CounterTradeRuntimeConfig {
  const minUserNotionalUsd = Math.max(
    1,
    readPositiveNumber('ALFACLUB_COUNTER_TRADE_MIN_USER_NOTIONAL_USD', 1),
  )
  const roomId = readRoomId()
  return {
    enabled: readBool('ALFACLUB_COUNTER_TRADE_ENABLED', false),
    exitEnabled: readBool('ALFACLUB_COUNTER_TRADE_EXIT_ENABLED', true),
    roomId,
    chatPostEnabled: readBool('ALFACLUB_COUNTER_TRADE_CHAT_POST_ENABLED', true),
    chatPostRoomId: String(process.env.ALFACLUB_COUNTER_TRADE_CHAT_POST_ROOM_ID ?? '').trim() || roomId,
    minUserNotionalUsd,
    cooldownMs: readPositiveInt('ALFACLUB_COUNTER_TRADE_COOLDOWN_MS', 120_000),
    hourlyActionCap: readPositiveInt('ALFACLUB_COUNTER_TRADE_HOURLY_ACTION_CAP', 12),
    dailyNotionalCapUsd: readPositiveNumber('ALFACLUB_COUNTER_TRADE_DAILY_NOTIONAL_CAP_USD', 7_500),
    maxCounterNotionalPerTradeUsd: readPositiveNumber(
      'ALFACLUB_COUNTER_TRADE_MAX_PER_TRADE_USD',
      750,
    ),
    globalMaxLeverage: readPositiveNumber('ALFACLUB_COUNTER_TRADE_GLOBAL_MAX_LEVERAGE', 12),
    favoredMultiplier: readPositiveNumber('ALFACLUB_COUNTER_TRADE_FAVORED_MULTIPLIER', 1.35),
    neutralMultiplier: readPositiveNumber('ALFACLUB_COUNTER_TRADE_NEUTRAL_MULTIPLIER', 1),
    unfavoredMultiplier: readPositiveNumber('ALFACLUB_COUNTER_TRADE_UNFAVORED_MULTIPLIER', 0.75),
    favoredNotionalRatio: readPositiveNumber('ALFACLUB_COUNTER_TRADE_FAVORED_NOTIONAL_RATIO', 0.6),
    neutralNotionalRatio: readPositiveNumber('ALFACLUB_COUNTER_TRADE_NEUTRAL_NOTIONAL_RATIO', 0.45),
    unfavoredNotionalRatio: readPositiveNumber('ALFACLUB_COUNTER_TRADE_UNFAVORED_NOTIONAL_RATIO', 0.3),
    neutralBiasLeverageCap: readPositiveNumber('ALFACLUB_COUNTER_TRADE_NEUTRAL_BIAS_LEVERAGE_CAP', 8),
    favoredBiasLeverageCap: readPositiveNumber('ALFACLUB_COUNTER_TRADE_FAVORED_BIAS_LEVERAGE_CAP', 10),
    unfavoredBiasLeverageCap: readPositiveNumber('ALFACLUB_COUNTER_TRADE_UNFAVORED_BIAS_LEVERAGE_CAP', 6),
    liquidationMinDistancePct: readPositiveNumber(
      'ALFACLUB_COUNTER_TRADE_LIQUIDATION_MIN_DISTANCE_PCT',
      8,
    ),
    eventLookbackMs: readPositiveInt('ALFACLUB_COUNTER_TRADE_EVENT_LOOKBACK_MS', 45 * 60_000),
    runLimitPerIdentity: readPositiveInt('ALFACLUB_COUNTER_TRADE_RUN_LIMIT_PER_IDENTITY', 20),
  }
}

export function isFavoredDirection(params: {
  bias: CounterTradeBias
  userSide: CounterTradeSide
}): boolean {
  if (params.bias === 'bearish') return params.userSide === 'long'
  if (params.bias === 'bullish') return params.userSide === 'short'
  return false
}

export function deriveCounterSide(userSide: CounterTradeSide): CounterTradeSide {
  return userSide === 'long' ? 'short' : 'long'
}

