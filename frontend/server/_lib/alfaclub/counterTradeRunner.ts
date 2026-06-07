import { logger } from '../infra/logger.js'
import { readArenaConfig } from '../arena/arenaConfig.js'
import { resolveArenaIdentityForContext } from '../arena/arenaIdentityMappingStore.js'
import { runArenaTrade } from '../arena/arenaClient.js'
import { getClearinghouseState, getUserFillsByTimeDetailed } from './hyperliquid.js'
import { resolveRoom1659HyperliquidUserForSnapshot } from './room1659Market.js'
import { readCounterTradeRuntimeConfig } from './counterTradeConfig.js'
import {
  deriveCounterTradeDecision,
  deriveEventKeyFromFill,
  derivePresetDailyNotionalCap,
  derivePresetHourlyCap,
  deriveUserLeverage,
  deriveUserNotional,
  deriveUserSide,
} from './counterTradeEngine.js'
import {
  listActiveCounterTradeOptIns,
  readCounterTradeUsageWindow,
  readOrCreateCounterTradeRoomStrategy,
  recordCounterTradeAction,
  registerCounterTradeEventIfNew,
} from './counterTradeStore.js'

export type CounterTradeRunResult = {
  ok: boolean
  reason?: string
  roomId: string
  scannedIdentities: number
  scannedEvents: number
  newEvents: number
  executed: number
  skipped: number
  blocked: number
  failed: number
}

declare const process: { env: Record<string, string | undefined> }

function parseIsoMs(value: string | null | undefined): number | null {
  if (!value) return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function computeCounterTradeCooldownRemainingMs(params: {
  lastExecutedAtMs: number | null
  cooldownMs: number
  nowMs?: number
}): number {
  if (params.lastExecutedAtMs == null) return 0
  const nowMs = params.nowMs ?? Date.now()
  const elapsedMs = Math.max(0, nowMs - params.lastExecutedAtMs)
  return Math.max(0, params.cooldownMs - elapsedMs)
}

function isEnabledByEnv(): boolean {
  const raw = String(process.env.ALFACLUB_COUNTER_TRADE_ENABLED ?? '').trim().toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on'
}

export function resolveCounterTradeFillSourceWallet(params: {
  roomId: string
  senderAddress: string
  identityHlApiWalletAddress: string | null
}): string {
  if (params.roomId === '1659') {
    return resolveRoom1659HyperliquidUserForSnapshot(params.senderAddress)
  }
  return params.identityHlApiWalletAddress ?? params.senderAddress
}

export async function runCounterTradeLoop(): Promise<CounterTradeRunResult> {
  const runtime = readCounterTradeRuntimeConfig()
  if (!runtime.enabled || !isEnabledByEnv()) {
    return {
      ok: false,
      reason: 'disabled',
      roomId: runtime.roomId,
      scannedIdentities: 0,
      scannedEvents: 0,
      newEvents: 0,
      executed: 0,
      skipped: 0,
      blocked: 0,
      failed: 0,
    }
  }

  const roomStrategy = await readOrCreateCounterTradeRoomStrategy(runtime.roomId)
  if (!roomStrategy?.enabled || roomStrategy.killSwitch) {
    return {
      ok: false,
      reason: roomStrategy?.killSwitch ? 'kill_switch' : 'room_disabled',
      roomId: runtime.roomId,
      scannedIdentities: 0,
      scannedEvents: 0,
      newEvents: 0,
      executed: 0,
      skipped: 0,
      blocked: 0,
      failed: 0,
    }
  }

  const activeOptIns = await listActiveCounterTradeOptIns({ roomId: runtime.roomId, limit: 300 })
  if (activeOptIns.length === 0) {
    return {
      ok: true,
      roomId: runtime.roomId,
      scannedIdentities: 0,
      scannedEvents: 0,
      newEvents: 0,
      executed: 0,
      skipped: 0,
      blocked: 0,
      failed: 0,
    }
  }

  const baseArenaConfig = readArenaConfig()
  const startTimeMs = Date.now() - runtime.eventLookbackMs
  let scannedEvents = 0
  let newEvents = 0
  let executed = 0
  let skipped = 0
  let blocked = 0
  let failed = 0

  for (const optIn of activeOptIns) {
    try {
      const identity = await resolveArenaIdentityForContext({
        roomId: runtime.roomId,
        senderAddress: optIn.senderAddress,
        baseConfig: baseArenaConfig,
      })

      const userWalletForFills = resolveCounterTradeFillSourceWallet({
        roomId: runtime.roomId,
        senderAddress: optIn.senderAddress,
        identityHlApiWalletAddress: identity.hlApiWalletAddress,
      })
      if (
        runtime.roomId === '1659' &&
        identity.hlApiWalletAddress &&
        identity.hlApiWalletAddress.toLowerCase() !== userWalletForFills.toLowerCase()
      ) {
        logger.info('counter_trade.room_wallet_override', {
          roomId: runtime.roomId,
          senderAddress: optIn.senderAddress,
          mappedHlApiWalletAddress: identity.hlApiWalletAddress,
          overriddenFillSourceWallet: userWalletForFills,
        })
      }

      const fills = await getUserFillsByTimeDetailed(userWalletForFills, startTimeMs)
      if (!fills?.length) continue

      const counterWalletState =
        identity.agentWalletAddress != null ? await getClearinghouseState(identity.agentWalletAddress) : null
      const sorted = [...fills].sort((a, b) => a.time - b.time).slice(-runtime.runLimitPerIdentity)
      let lastExecutedAtMs = parseIsoMs(optIn.lastActionAt)

      for (const fill of sorted) {
        scannedEvents += 1
        const eventKey = deriveEventKeyFromFill({ walletAddress: userWalletForFills, fill })
        const userSide = deriveUserSide(fill)
        const userNotionalUsd = deriveUserNotional(fill)
        const isNewEvent = await registerCounterTradeEventIfNew({
          roomId: runtime.roomId,
          senderAddress: optIn.senderAddress,
          eventKey,
          coin: fill.coin,
          userSide,
          userNotionalUsd,
          eventTimeMs: fill.time,
          rawEvent: fill as unknown as Record<string, unknown>,
        })
        if (!isNewEvent) continue
        newEvents += 1

        const nowMs = Date.now()
        const cooldownRemainingMs = computeCounterTradeCooldownRemainingMs({
          lastExecutedAtMs,
          cooldownMs: runtime.cooldownMs,
          nowMs,
        })
        if (cooldownRemainingMs > 0) {
          blocked += 1
          await recordCounterTradeAction({
            roomId: runtime.roomId,
            senderAddress: optIn.senderAddress,
            eventKey,
            status: 'blocked',
            reason: 'cooldown_active',
            counterSide: null,
            counterNotionalUsd: null,
            counterLeverage: null,
          })
          continue
        }

        const hourlyUsage = await readCounterTradeUsageWindow({
          roomId: runtime.roomId,
          senderAddress: optIn.senderAddress,
          sinceMs: Date.now() - 60 * 60_000,
        })
        const dailyUsage = await readCounterTradeUsageWindow({
          roomId: runtime.roomId,
          senderAddress: optIn.senderAddress,
          sinceMs: Date.now() - 24 * 60 * 60_000,
        })

        const hourlyCap = derivePresetHourlyCap({ preset: optIn.preset, runtime })
        const dailyCap = derivePresetDailyNotionalCap({ preset: optIn.preset, runtime })
        if (hourlyUsage.executedCount >= hourlyCap) {
          blocked += 1
          await recordCounterTradeAction({
            roomId: runtime.roomId,
            senderAddress: optIn.senderAddress,
            eventKey,
            status: 'blocked',
            reason: 'hourly_cap_reached',
            counterSide: null,
            counterNotionalUsd: null,
            counterLeverage: null,
          })
          continue
        }

        const decision = deriveCounterTradeDecision({
          bias: roomStrategy.globalBias,
          preset: optIn.preset,
          fill,
          userNotionalUsd,
          userLeverage: deriveUserLeverage(fill),
          runtime,
          counterWalletState,
        })

        if (!decision.ok) {
          skipped += 1
          await recordCounterTradeAction({
            roomId: runtime.roomId,
            senderAddress: optIn.senderAddress,
            eventKey,
            status: 'skipped',
            reason: decision.reason,
            counterSide: null,
            counterNotionalUsd: null,
            counterLeverage: null,
          })
          continue
        }

        const remainingDailyNotional = Math.max(0, dailyCap - dailyUsage.notionalUsd)
        if (remainingDailyNotional <= 0) {
          blocked += 1
          await recordCounterTradeAction({
            roomId: runtime.roomId,
            senderAddress: optIn.senderAddress,
            eventKey,
            status: 'blocked',
            reason: 'daily_notional_cap_reached',
            counterSide: null,
            counterNotionalUsd: null,
            counterLeverage: null,
          })
          continue
        }

        const counterNotionalUsd = Math.min(decision.counterNotionalUsd, remainingDailyNotional)
        const pair = String(fill.coin ?? '').trim()
        if (!pair) {
          skipped += 1
          await recordCounterTradeAction({
            roomId: runtime.roomId,
            senderAddress: optIn.senderAddress,
            eventKey,
            status: 'skipped',
            reason: 'missing_pair',
            counterSide: null,
            counterNotionalUsd: null,
            counterLeverage: null,
          })
          continue
        }

        const identityConfig = {
          ...baseArenaConfig,
          agentId: identity.agentId,
          agentWalletAddress: identity.agentWalletAddress,
          hlApiWalletAddress: identity.hlApiWalletAddress,
        }

        const tradeResult = await runArenaTrade(
          {
            action: 'open',
            pair,
            side: decision.counterSide,
            sizeUsd: counterNotionalUsd,
            leverage: decision.counterLeverage,
          },
          identityConfig,
        )

        if (tradeResult.ok) {
          executed += 1
          lastExecutedAtMs = nowMs
          await recordCounterTradeAction({
            roomId: runtime.roomId,
            senderAddress: optIn.senderAddress,
            eventKey,
            status: 'executed',
            reason: 'executed',
            counterSide: decision.counterSide,
            counterNotionalUsd,
            counterLeverage: decision.counterLeverage,
          })
        } else {
          failed += 1
          await recordCounterTradeAction({
            roomId: runtime.roomId,
            senderAddress: optIn.senderAddress,
            eventKey,
            status: 'failed',
            reason: String(tradeResult.message ?? 'arena_trade_failed'),
            counterSide: decision.counterSide,
            counterNotionalUsd,
            counterLeverage: decision.counterLeverage,
          })
          logger.warn('counter_trade.execution_failed', {
            roomId: runtime.roomId,
            senderAddress: optIn.senderAddress,
            eventKey,
            pair,
            reason: tradeResult.message,
          })
        }
      }
    } catch (error) {
      logger.warn('counter_trade.identity_scan_failed', {
        roomId: runtime.roomId,
        senderAddress: optIn.senderAddress,
        message: error instanceof Error ? error.message : String(error),
      })
      continue
    }
  }

  return {
    ok: true,
    roomId: runtime.roomId,
    scannedIdentities: activeOptIns.length,
    scannedEvents,
    newEvents,
    executed,
    skipped,
    blocked,
    failed,
  }
}

