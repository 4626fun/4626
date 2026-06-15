import { logger } from '../infra/logger.js'

declare const process: { env: Record<string, string | undefined> }

export type CounterTradeBias = 'bullish' | 'bearish' | 'neutral'
export type CounterTradePreset = 'defensive' | 'balanced' | 'aggressive'
export type CounterTradeSide = 'long' | 'short'
export type CounterTradeStrategyKey = 'trend' | 'meanRevert' | 'event'
export type CounterTradeSubaccountMap = Record<CounterTradeStrategyKey, string | null>

export type CounterTradeRiskProfile = {
  riskPerTradeBps: number
  dailyLossCapBps: number
  maxDrawdownPauseBps: number
  stopDistancePctByStrategy: Record<CounterTradeStrategyKey, number>
}

export type CounterTradeRuntimeConfig = {
  enabled: boolean
  /**
   * Mirror exits: when the countered user closes (or is liquidated out of) a
   * position, close the bot's position on that pair. Exits are risk-reducing,
   * so they bypass cooldown/hourly/daily entry gates but still respect the
   * env + DB kill switches and per-fill dedupe.
   */
  exitEnabled: boolean
  /**
   * Liquidation-defense loop: each tick, inspect the bot wallet's open legs.
   * Legs too close to their liquidation price are partially reduced
   * (releasing margin back into the silo's USDC buffer); legs deep in profit
   * are partially taken to refill that buffer. Cross-margin means free USDC
   * in the wallet automatically backs every leg, so the buffer IS the
   * defense. No cross-wallet transfers — each silo defends itself.
   */
  defenseEnabled: boolean
  /** Defend (partial-reduce) a leg when its liq distance falls to/below this %. */
  defendLiqDistancePct: number
  /** Fraction of the losing leg's notional to shave per defense action. */
  defendReduceFraction: number
  /** Harvest (partial take-profit) when unrealized PnL >= this % of the leg's margin. */
  harvestTriggerRoiPct: number
  /** Fraction of the winning leg's notional to realize per harvest action. */
  harvestFraction: number
  /** Floor for any partial reduce/harvest order (HL min order is $10). */
  minReduceNotionalUsd: number
  /** Entry gate: block new counters when withdrawable/accountValue is below this ratio. */
  minBufferRatio: number
  /** Max defense+harvest orders per tick (per identity). */
  maxDefenseActionsPerTick: number
  /**
   * Auto-sweep USDC sitting in the bot wallet's SPOT balance into its perps
   * account each tick (Hyperliquid usdClassTransfer via the ACP signing
   * lane). Deposits sent as HL spot transfers land in spot and are unusable
   * as perps margin until moved. On by default.
   */
  spotSweepEnabled: boolean
  /** Minimum spot USDC required before a sweep fires (avoids dust churn). */
  spotSweepMinUsd: number
  /**
   * Run the same defend/harvest loop on the countered user's own wallet (the
   * other silo). Requires an approved Hyperliquid API-wallet key for that
   * account (userSiloHlAgentPrivateKey) — the key can trade but never
   * withdraw. Off by default; the bot silo is always defended when
   * defenseEnabled is on.
   */
  userSiloDefenseEnabled: boolean
  /** Approved HL API-wallet private key for the user's master account. */
  userSiloHlAgentPrivateKey: string | null
  /**
   * Optional explicit master address for the user silo. Defaults to the
   * fill-source wallet (the wallet whose trades are mirrored).
   */
  userSiloMasterAddress: string | null
  roomId: string
  chatPostEnabled: boolean
  chatPostRoomId: string
  minUserNotionalUsd: number
  cooldownMs: number
  hourlyActionCap: number
  dailyNotionalCapUsd: number
  maxCounterNotionalPerTradeUsd: number
  /** Do not submit counter opens below this HL order-notional floor. */
  minOrderNotionalUsd: number
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
  subaccountsEnabled: boolean
  subaccounts: CounterTradeSubaccountMap
  riskProfile: CounterTradeRiskProfile
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

function readOptionalSecret(name: string): string | null {
  const raw = String(process.env[name] ?? '').trim()
  return raw.length > 0 ? raw : null
}

function readOptionalAddress(name: string): string | null {
  const raw = String(process.env[name] ?? '').trim()
  if (!raw) return null
  if (/^0x[a-fA-F0-9]{40}$/.test(raw)) return raw.toLowerCase()
  logger.warn('[counter-trade] invalid address env; ignoring', { name })
  return null
}

function clampBps(raw: number, fallback: number, minBps: number, maxBps: number): number {
  if (!Number.isFinite(raw)) return fallback
  return Math.min(maxBps, Math.max(minBps, Math.round(raw)))
}

export function readCounterTradeRuntimeConfig(): CounterTradeRuntimeConfig {
  const minUserNotionalUsd = Math.max(
    1,
    readPositiveNumber('ALFACLUB_COUNTER_TRADE_MIN_USER_NOTIONAL_USD', 1),
  )
  const roomId = readRoomId()
  const subaccountsEnabled = readBool('COUNTER_TRADE_HL_SUBACCOUNTS_ENABLED', false)
  const subaccounts: CounterTradeSubaccountMap = {
    trend: readOptionalAddress('ALFACLUB_COUNTER_TRADE_HL_SUBACCOUNT_TREND'),
    meanRevert: readOptionalAddress('ALFACLUB_COUNTER_TRADE_HL_SUBACCOUNT_MEAN_REVERT'),
    event: readOptionalAddress('ALFACLUB_COUNTER_TRADE_HL_SUBACCOUNT_EVENT'),
  }
  const riskProfile: CounterTradeRiskProfile = {
    // Aggressive defaults selected in the implementation plan.
    riskPerTradeBps: clampBps(
      readPositiveNumber('ALFACLUB_COUNTER_TRADE_RISK_PER_TRADE_BPS', 100),
      100,
      1,
      10_000,
    ),
    dailyLossCapBps: clampBps(
      readPositiveNumber('ALFACLUB_COUNTER_TRADE_DAILY_LOSS_CAP_BPS', 300),
      300,
      1,
      10_000,
    ),
    maxDrawdownPauseBps: clampBps(
      readPositiveNumber('ALFACLUB_COUNTER_TRADE_MAX_DRAWDOWN_PAUSE_BPS', 1000),
      1000,
      1,
      10_000,
    ),
    stopDistancePctByStrategy: {
      trend: readPositiveNumber('ALFACLUB_COUNTER_TRADE_STOP_DISTANCE_PCT_TREND', 2.5),
      meanRevert: readPositiveNumber('ALFACLUB_COUNTER_TRADE_STOP_DISTANCE_PCT_MEAN_REVERT', 1.5),
      event: readPositiveNumber('ALFACLUB_COUNTER_TRADE_STOP_DISTANCE_PCT_EVENT', 4),
    },
  }

  return {
    enabled: readBool('ALFACLUB_COUNTER_TRADE_ENABLED', false),
    exitEnabled: readBool('ALFACLUB_COUNTER_TRADE_EXIT_ENABLED', true),
    defenseEnabled: readBool('ALFACLUB_COUNTER_TRADE_DEFENSE_ENABLED', true),
    defendLiqDistancePct: readPositiveNumber('ALFACLUB_COUNTER_TRADE_DEFEND_LIQ_DISTANCE_PCT', 12),
    defendReduceFraction: Math.min(
      0.75,
      readPositiveNumber('ALFACLUB_COUNTER_TRADE_DEFEND_REDUCE_FRACTION', 0.25),
    ),
    harvestTriggerRoiPct: readPositiveNumber('ALFACLUB_COUNTER_TRADE_HARVEST_TRIGGER_ROI_PCT', 50),
    harvestFraction: Math.min(
      0.75,
      readPositiveNumber('ALFACLUB_COUNTER_TRADE_HARVEST_FRACTION', 0.25),
    ),
    minReduceNotionalUsd: readPositiveNumber('ALFACLUB_COUNTER_TRADE_MIN_REDUCE_USD', 15),
    minBufferRatio: Math.min(
      0.9,
      readPositiveNumber('ALFACLUB_COUNTER_TRADE_MIN_BUFFER_RATIO', 0.2),
    ),
    maxDefenseActionsPerTick: readPositiveInt('ALFACLUB_COUNTER_TRADE_MAX_DEFENSE_ACTIONS_PER_TICK', 2),
    spotSweepEnabled: readBool('ALFACLUB_COUNTER_TRADE_SPOT_SWEEP_ENABLED', true),
    spotSweepMinUsd: readPositiveNumber('ALFACLUB_COUNTER_TRADE_SPOT_SWEEP_MIN_USD', 1),
    userSiloDefenseEnabled: readBool('ALFACLUB_COUNTER_TRADE_USER_DEFENSE_ENABLED', false),
    userSiloHlAgentPrivateKey: readOptionalSecret('ALFACLUB_COUNTER_TRADE_USER_HL_AGENT_KEY'),
    userSiloMasterAddress: readOptionalAddress('ALFACLUB_COUNTER_TRADE_USER_DEFENSE_MASTER'),
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
    minOrderNotionalUsd: readPositiveNumber('ALFACLUB_COUNTER_TRADE_MIN_ORDER_NOTIONAL_USD', 10),
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
    subaccountsEnabled,
    subaccounts,
    riskProfile,
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

